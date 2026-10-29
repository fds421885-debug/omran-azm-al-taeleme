import {
  PlatformAIConfig,
  DEFAULT_AI_CONFIG,
  AIGroupKeyAllocation,
  GOOGLE_GEMINI_MODELS,
  AIUsageMetrics,
  DEFAULT_AI_USAGE_METRICS
} from '../types';
import { ApiConfig } from './apiConfig';
import { doc, setDoc } from 'firebase/firestore';

const AI_CONFIG_CACHE_KEY = 'omran_platform_ai_config';
const MASTER_KEY_LOCAL_KEY = 'omran_gemini_api_key';
const AI_USAGE_CACHE_KEY = 'omran_ai_usage_metrics';

export function sanitizeGeminiModelName(modelName?: string): string {
  if (!modelName) return 'gemini-3.8-flash';
  const m = modelName.trim().toLowerCase();
  if (
    m === 'gemini-2.5-flash' ||
    m === 'gemini-1.5-flash' ||
    m === 'gemini-2.0-flash' ||
    m === 'gemini-flash' ||
    m === 'gemini-2.5-pro' ||
    m === 'gemini-1.5-pro' ||
    m === 'gemini-2.0-pro'
  ) {
    return 'gemini-3.8-flash';
  }
  if (m === 'gemini-2.0-flash-lite' || m === 'gemini-flash-lite' || m === 'gemini-lite') {
    return 'gemini-3.1-flash-lite';
  }
  return modelName.trim();
}

export interface GenerateContentOptions {
  prompt: string;
  systemInstruction?: string;
  role?: 'supervisors' | 'teachers' | 'public_placement' | 'assistant' | 'developer';
  userId?: string;
  complexId?: string;
  modelOverride?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

export class OmranAIService {
  private static cachedConfig: PlatformAIConfig | null = null;
  private static listeners: Array<(config: PlatformAIConfig) => void> = [];
  private static usageListeners: Array<(metrics: AIUsageMetrics) => void> = [];

  /**
   * Subscribe to AI Config updates across the platform
   */
  static subscribe(listener: (config: PlatformAIConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribe to real-time AI Usage & Quota updates
   */
  static subscribeUsage(listener: (metrics: AIUsageMetrics) => void): () => void {
    this.usageListeners.push(listener);
    return () => {
      this.usageListeners = this.usageListeners.filter(l => l !== listener);
    };
  }

  private static notifyListeners(config: PlatformAIConfig) {
    this.listeners.forEach(l => {
      try {
        l(config);
      } catch (e) {
        console.warn('[OmranAIService] Listener notification error:', e);
      }
    });
  }

  private static notifyUsageListeners(metrics: AIUsageMetrics) {
    this.usageListeners.forEach(l => {
      try {
        l(metrics);
      } catch (e) {
        console.warn('[OmranAIService] Usage listener notification error:', e);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omran:ai-usage-updated', { detail: metrics }));
    }
  }

  /**
   * Get current AI Usage and Limit metrics
   */
  static getUsageMetrics(): AIUsageMetrics {
    const todayStr = new Date().toISOString().split('T')[0];
    let metrics: AIUsageMetrics = { ...DEFAULT_AI_USAGE_METRICS, date: todayStr };

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(AI_USAGE_CACHE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            if (parsed.date === todayStr) {
              metrics = { ...metrics, ...parsed };
            } else {
              // New day: retain all-time total, tier, limits, but reset daily count
              metrics = {
                ...metrics,
                tier: parsed.tier || 'free',
                dailyLimit: parsed.dailyLimit || 1500,
                rpmLimit: parsed.rpmLimit || 15,
                tpmLimit: parsed.tpmLimit || 1000000,
                totalAllTimeRequests: parsed.totalAllTimeRequests || 0,
                dailyRequestsCount: 0,
                recentTimestamps: [],
                date: todayStr
              };
              localStorage.setItem(AI_USAGE_CACHE_KEY, JSON.stringify(metrics));
            }
          }
        }
      } catch {}
    }

    // Clean timestamps older than 60 seconds
    const now = Date.now();
    metrics.recentTimestamps = (metrics.recentTimestamps || []).filter(t => now - t < 60000);
    return metrics;
  }

  /**
   * Record a new AI Request and update the rolling RPM/RPD quota
   */
  static recordUsage(): AIUsageMetrics {
    const current = this.getUsageMetrics();
    const now = Date.now();
    const updatedTimestamps = [...(current.recentTimestamps || []).filter(t => now - t < 60000), now];

    const updated: AIUsageMetrics = {
      ...current,
      dailyRequestsCount: current.dailyRequestsCount + 1,
      totalAllTimeRequests: (current.totalAllTimeRequests || 0) + 1,
      recentTimestamps: updatedTimestamps,
      lastRequestAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AI_USAGE_CACHE_KEY, JSON.stringify(updated));
      } catch {}
    }

    this.notifyUsageListeners(updated);
    return updated;
  }

  /**
   * Reset today's usage counter manually
   */
  static resetDailyUsage(): AIUsageMetrics {
    const current = this.getUsageMetrics();
    const todayStr = new Date().toISOString().split('T')[0];
    const updated: AIUsageMetrics = {
      ...current,
      dailyRequestsCount: 0,
      recentTimestamps: [],
      date: todayStr
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AI_USAGE_CACHE_KEY, JSON.stringify(updated));
      } catch {}
    }
    this.notifyUsageListeners(updated);
    return updated;
  }

  /**
   * Update AI Tier and Limit
   */
  static setTierOrLimit(tier: 'free' | 'pay_as_you_go' | 'custom', customLimit?: number): AIUsageMetrics {
    const current = this.getUsageMetrics();
    let dailyLimit = 1500;
    let rpmLimit = 15;
    let tpmLimit = 1000000;

    if (tier === 'pay_as_you_go') {
      dailyLimit = 50000;
      rpmLimit = 1000;
      tpmLimit = 4000000;
    } else if (tier === 'custom' && customLimit && customLimit > 0) {
      dailyLimit = customLimit;
      rpmLimit = Math.max(15, Math.round(customLimit / 100));
    }

    const updated: AIUsageMetrics = {
      ...current,
      tier,
      dailyLimit,
      rpmLimit,
      tpmLimit
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AI_USAGE_CACHE_KEY, JSON.stringify(updated));
      } catch {}
    }
    this.notifyUsageListeners(updated);
    return updated;
  }

  /**
   * Load AI Configuration from localStorage and Cloud Firestore
   */
  static async loadConfig(): Promise<PlatformAIConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    let config: PlatformAIConfig = { ...DEFAULT_AI_CONFIG };

    // 1. Read from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(AI_CONFIG_CACHE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          config = { ...config, ...parsed };
        }
      } catch {}

      // Legacy fallback key if stored previously
      if (!config.masterApiKey) {
        const legacyKey =
          localStorage.getItem(MASTER_KEY_LOCAL_KEY) ||
          localStorage.getItem('gemini_api_key') ||
          '';
        if (legacyKey) {
          config.masterApiKey = legacyKey.trim();
        }
      }
    }

    // 2. Fetch from Firestore settings collection in active database if available
    try {
      const { safeGetDoc, OmranDataService } = await import('./firebase');
      const activeDb = OmranDataService.getActiveDb() || OmranDataService.getCentralDb();
      const snap = await safeGetDoc(doc(activeDb, 'settings', 'ai_config'));
      if (snap && snap.exists()) {
        const cloudData = snap.data();
        if (cloudData) {
          config = {
            ...config,
            ...cloudData,
            rolePolicies: {
              ...config.rolePolicies,
              ...(cloudData.rolePolicies || {})
            },
            groupAllocations: Array.isArray(cloudData.groupAllocations)
              ? cloudData.groupAllocations
              : config.groupAllocations
          };
          if (typeof window !== 'undefined') {
            localStorage.setItem(AI_CONFIG_CACHE_KEY, JSON.stringify(config));
            if (config.masterApiKey) {
              localStorage.setItem(MASTER_KEY_LOCAL_KEY, config.masterApiKey);
            }
          }
        }
      }
    } catch (e) {
      // Non-blocking cloud fetch
    }

    config.masterModel = sanitizeGeminiModelName(config.masterModel);
    config.usageMetrics = this.getUsageMetrics();
    this.cachedConfig = config;
    return config;
  }

  /**
   * Save AI Configuration to localStorage and Cloud Firestore (Active DB & Central DB)
   */
  static async saveConfig(updated: PlatformAIConfig): Promise<void> {
    this.cachedConfig = updated;

    // 1. Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(AI_CONFIG_CACHE_KEY, JSON.stringify(updated));
      if (updated.masterApiKey) {
        localStorage.setItem(MASTER_KEY_LOCAL_KEY, updated.masterApiKey);
      }
      window.dispatchEvent(new CustomEvent('omran:ai-config-updated', { detail: updated }));
    }

    this.notifyListeners(updated);

    // Sync to backend Express server if available
    try {
      fetch(ApiConfig.getEndpoint('/api/gemini/sync-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: updated.masterApiKey, model: updated.masterModel })
      }).catch(() => {});
    } catch {}

    // 2. Persist to Firestore settings collection in active database and central database
    try {
      const { OmranDataService, cleanFirestoreData } = await import('./firebase');
      const activeDb = OmranDataService.getActiveDb();
      const centralDb = OmranDataService.getCentralDb();
      const dbs = [activeDb];
      if (centralDb !== activeDb) {
        dbs.push(centralDb);
      }

      const payload = {
        masterApiKey: updated.masterApiKey || '',
        masterModel: sanitizeGeminiModelName(updated.masterModel),
        isMasterEnabled: updated.isMasterEnabled !== false,
        lastVerifiedAt: updated.lastVerifiedAt || new Date().toISOString(),
        lastVerifiedLatencyMs: updated.lastVerifiedLatencyMs || 0,
        lastVerifiedMessage: updated.lastVerifiedMessage || '',
        lastVerifiedModel: sanitizeGeminiModelName(updated.lastVerifiedModel || updated.masterModel),
        groupAllocations: (updated.groupAllocations || []).map(cleanFirestoreData),
        rolePolicies: updated.rolePolicies || DEFAULT_AI_CONFIG.rolePolicies,
        updatedAt: new Date().toISOString()
      };

      await Promise.all(
        dbs.map(async db => {
          try {
            await setDoc(doc(db, 'settings', 'ai_config'), payload, { merge: true });
          } catch (err) {
            console.warn('[OmranAIService] Firestore write notice:', err);
          }
        })
      );
    } catch (e) {
      console.warn('[OmranAIService] Cloud save failed, cached locally:', e);
    }
  }

  /**
   * Test an API Key and Model directly or via server endpoint
   * Returns latency, response text, and verifies connectivity.
   */
  static async testApiKeyAndModel(
    apiKey: string,
    modelName: string
  ): Promise<{
    success: boolean;
    latencyMs: number;
    responseText: string;
    error?: string;
  }> {
    const cleanKey = (apiKey || '').trim();
    const cleanModel = sanitizeGeminiModelName(modelName);

    if (!cleanKey) {
      return {
        success: false,
        latencyMs: 0,
        responseText: '',
        error: 'يرجى إدخال مفتاح Gemini API قبل بدء الاختبار'
      };
    }

    const startTime = performance.now();

    // Server-side proxy endpoint only (keeps API keys off direct browser requests to Google APIs)
    try {
      const serverRes = await fetch(ApiConfig.getEndpoint('/api/gemini/test-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanKey, model: cleanModel })
      });
      const latencyMs = Math.round(performance.now() - startTime);
      if (serverRes.ok) {
        const sData = await serverRes.json();
        if (sData?.success) {
          this.recordUsage();
          return {
            success: true,
            latencyMs: sData.latencyMs || latencyMs,
            responseText: sData.responseText || 'تم الاتصال بنجاح بمنظومة عمران القرآنية'
          };
        }
        return {
          success: false,
          latencyMs,
          responseText: '',
          error: sData?.error || 'فشل الاتصال بخدمة Google Gemini'
        };
      }
      const errData = await serverRes.json().catch(() => ({}));
      return {
        success: false,
        latencyMs,
        responseText: '',
        error: errData?.error || `فشل الاتصال بالخادم (كود ${serverRes.status})`
      };
    } catch (serverErr: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - startTime),
        responseText: '',
        error: `تعذر الوصول لخادم المنظومة: ${serverErr?.message || 'خطأ في الاتصال'}`
      };
    }
  }

  /**
   * Resolve which API key and model to use based on the user's role and ID
   */
  static async resolveKeyAndModel(options: {
    role?: 'supervisors' | 'teachers' | 'public_placement' | 'assistant' | 'developer';
    userId?: string;
    complexId?: string;
    requestedModel?: string;
  }): Promise<{
    apiKey: string;
    model: string;
    source: 'master' | 'group' | 'custom' | 'none';
    isAllowed: boolean;
    failureReason?: string;
  }> {
    const config = await this.loadConfig();
    const role = options.role || 'teachers';

    // Developer always has full master key access
    if (role === 'developer') {
      return {
        apiKey: config.masterApiKey,
        model: options.requestedModel || config.masterModel || 'gemini-3.8-flash',
        source: 'master',
        isAllowed: true
      };
    }

    // Check role policy
    const policyKey =
      role === 'supervisors'
        ? 'supervisors'
        : role === 'public_placement'
        ? 'publicPlacement'
        : role === 'assistant'
        ? 'assistant'
        : 'teachers';

    const policy = config.rolePolicies?.[policyKey] || 'master';

    if (policy === 'disabled') {
      return {
        apiKey: '',
        model: config.masterModel || 'gemini-3.8-flash',
        source: 'none',
        isAllowed: false,
        failureReason: 'تم تعطيل صلاحية استخدام الذكاء الاصطناعي لهذه الفئة من قبل مبرمج المنظومة.'
      };
    }

    // If group policy is chosen, check if a dedicated key is mapped for this role or user
    if (policy === 'group' && Array.isArray(config.groupAllocations)) {
      // 1. Look for user-specific key
      if (options.userId) {
        const userGroup = config.groupAllocations.find(
          g =>
            g.isEnabled &&
            Array.isArray(g.assignedTeacherIds) &&
            g.assignedTeacherIds.includes(options.userId!)
        );
        if (userGroup && userGroup.apiKey) {
          return {
            apiKey: userGroup.apiKey,
            model: options.requestedModel || userGroup.model || config.masterModel,
            source: 'group',
            isAllowed: true
          };
        }
      }

      // 2. Look for role-specific group key
      const roleGroup = config.groupAllocations.find(
        g => g.isEnabled && g.targetRole === role && g.apiKey
      );
      if (roleGroup && roleGroup.apiKey) {
        return {
          apiKey: roleGroup.apiKey,
          model: options.requestedModel || roleGroup.model || config.masterModel,
          source: 'group',
          isAllowed: true
        };
      }
    }

    // Default: use Master Key
    if (!config.isMasterEnabled) {
      return {
        apiKey: '',
        model: config.masterModel,
        source: 'none',
        isAllowed: false,
        failureReason: 'مفتاح الذكاء الاصطناعي الرئيسي للمنصة معطل حالياً بواسطة المبرمج.'
      };
    }

    return {
      apiKey: config.masterApiKey || '',
      model: options.requestedModel || config.masterModel || 'gemini-3.8-flash',
      source: 'master',
      isAllowed: true
    };
  }

  /**
   * Unified Direct Content Generation
   * Works 100% on Netlify, static hosting, GitHub Pages, or with a backend server!
   */
  static async generateContent(
    options: GenerateContentOptions
  ): Promise<{ text: string; success: boolean; model: string; error?: string }> {
    const { apiKey, model, isAllowed, failureReason } = await this.resolveKeyAndModel({
      role: options.role,
      userId: options.userId,
      complexId: options.complexId,
      requestedModel: options.modelOverride
    });

    if (!isAllowed) {
      return {
        text: '',
        success: false,
        model,
        error: failureReason || 'غير مصرح باستخدام الذكاء الاصطناعي'
      };
    }

    // Route exclusively through the server-side Express proxy (/api/gemini/generate)
    try {
      const serverEndpoint = ApiConfig.getEndpoint('/api/gemini/generate');
      const serverRes = await fetch(serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-gemini-api-key': apiKey } : {})
        },
        body: JSON.stringify({
          prompt: options.prompt,
          systemInstruction: options.systemInstruction,
          model,
          temperature: options.temperature,
          maxTokens: options.maxOutputTokens,
          jsonMode: options.jsonMode
        })
      });

      if (serverRes.ok) {
        const sData = await serverRes.json();
        const generatedText = (sData.text || sData.response || '').trim();
        if (generatedText) {
          this.recordUsage();
          return {
            text: generatedText,
            success: true,
            model: sData.model || model
          };
        }
        return {
          text: '',
          success: false,
          model,
          error: sData.error || 'لم يرجع النموذج نصاً صالحاً'
        };
      } else {
        const errPayload = await serverRes.json().catch(() => ({}));
        return {
          text: '',
          success: false,
          model,
          error: errPayload?.error || `تعذر إتمام الطلب عبر الخادم (كود ${serverRes.status})`
        };
      }
    } catch (err: any) {
      // 3. Fallback message if no server and direct call did not succeed
      const errorGuidance =
        !apiKey
          ? 'لم يتم ضبط مفتاح Gemini API الرئيسي في إعدادات المنظومة (تبويب المبرمج والنسخ الاحتياطي). يرجى إضافة المفتاح وتفعيله للعمل على نتفلاي والسيرفر السحابي.'
          : 'تعذر الاتصال بخدمة Google Gemini، يرجى التأكد من اتصال الإنترنت وصلاحية مفتاح API المحدد.';

      return {
        text: '',
        success: false,
        model,
        error: errorGuidance
      };
    }
  }
}

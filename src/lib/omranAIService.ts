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
        masterModel: updated.masterModel || 'gemini-2.5-flash',
        isMasterEnabled: updated.isMasterEnabled !== false,
        lastVerifiedAt: updated.lastVerifiedAt || new Date().toISOString(),
        lastVerifiedLatencyMs: updated.lastVerifiedLatencyMs || 0,
        lastVerifiedMessage: updated.lastVerifiedMessage || '',
        lastVerifiedModel: updated.lastVerifiedModel || updated.masterModel,
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
   * Test an API Key and Model directly with Google's Gemini Endpoint
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
    const cleanModel = (modelName || 'gemini-2.5-flash').trim();

    if (!cleanKey) {
      return {
        success: false,
        latencyMs: 0,
        responseText: '',
        error: 'يرجى إدخال مفتاح Gemini API قبل بدء الاختبار'
      };
    }

    const startTime = performance.now();
    const testPrompt = 'اختبار اتصال: أجب بعبارة قصيرة واحدة باللغة العربية تبدأ بـ "تم الاتصال بنجاح بمنظومة عمران القرآنية".';

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(cleanKey)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: testPrompt }]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 100
            }
          })
        }
      );

      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      if (!response.ok) {
        let errorMsg = `فشل الاتصال بجوجل (كود ${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.error?.message) {
            const raw = errData.error.message;
            if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
              errorMsg = 'مفتاح API غير صالح أو تم إلغاؤه من Google Cloud Console.';
            } else if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('Quota exceeded')) {
              errorMsg = 'تم استنفاد الحصة المجانية الحالية لهذا المفتاح، يرجى فحص الحصص أو استخدام مفتاح آخر.';
            } else if (raw.includes('models/') && raw.includes('is not found')) {
              errorMsg = `النموذج المحدد (${cleanModel}) غير مدعوم على هذا المفتاح، يرجى اختيار نموذج آخر مثل gemini-2.5-flash.`;
            } else {
              errorMsg = `تنبيه من Google Gemini: ${raw}`;
            }
          }
        } catch {}

        return {
          success: false,
          latencyMs,
          responseText: '',
          error: errorMsg
        };
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        'تم الاتصال بنجاح بمنظومة عمران القرآنية';

      this.recordUsage();

      return {
        success: true,
        latencyMs,
        responseText: text.trim()
      };
    } catch (netErr: any) {
      const endTime = performance.now();
      return {
        success: false,
        latencyMs: Math.round(endTime - startTime),
        responseText: '',
        error: `خطأ شبكة أثناء الاتصال المباشر بـ Google Gemini: ${netErr?.message || 'تعذر الوصول للخادم'}`
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
        model: options.requestedModel || config.masterModel || 'gemini-2.5-flash',
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
        model: config.masterModel || 'gemini-2.5-flash',
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
      model: options.requestedModel || config.masterModel || 'gemini-2.5-flash',
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

    // 1. DIRECT CLIENT-SIDE EXECUTION (Works on Netlify / Static without Node.js server)
    if (apiKey && apiKey.trim()) {
      try {
        const bodyPayload: any = {
          contents: [
            {
              parts: [{ text: options.prompt }]
            }
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 2048,
            ...(options.jsonMode ? { responseMimeType: 'application/json' } : {})
          }
        };

        if (options.systemInstruction) {
          bodyPayload.systemInstruction = {
            parts: [{ text: options.systemInstruction }]
          };
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyPayload)
          }
        );

        if (res.ok) {
          const data = await res.json();
          const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          this.recordUsage();
          return {
            text: generatedText,
            success: true,
            model
          };
        } else {
          // If direct call returned error, parse clean message
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Google API status ${res.status}`;
          console.warn('[OmranAIService] Direct Google Gemini notice:', errMsg);
        }
      } catch (directErr) {
        console.warn('[OmranAIService] Direct call attempt failed, checking server fallback:', directErr);
      }
    }

    // 2. SERVER FALLBACK (If Express backend is running on port 3000 / localhost)
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
        this.recordUsage();
        return {
          text: sData.text || sData.response || '',
          success: true,
          model
        };
      }
    } catch {}

    // 3. Fallback message if no key or connectivity
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

/**
 * Omran Platform Dual Deployment API Configuration
 * Supports:
 * 1. Full-Stack Dev / Production: Same-origin Express server routes (/api/*)
 * 2. Static Hosting (GitHub Pages / Netlify / Vercel): Configurable external API URL
 *    via VITE_API_URL, localStorage, or direct client-side cloud fallback.
 */

const STORAGE_KEY_API_URL = 'omran_api_server_url';

export class ApiConfig {
  /**
   * Get the active API Base URL
   */
  static getBaseUrl(): string {
    // 1. Check local storage override if set by admin
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_API_URL);
      if (stored && stored.trim()) {
        return stored.trim().replace(/\/+$/, '');
      }
    }

    // 2. Check environment variable
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }

    // 3. Fallback to current origin (works seamlessly with Express / vite middleware)
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }

    return '';
  }

  /**
   * Resolve a full endpoint path
   */
  static getEndpoint(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const base = ApiConfig.getBaseUrl();
    if (!base) return cleanPath;
    return `${base}${cleanPath}`;
  }

  /**
   * Update the external API server URL (e.g. for GitHub Pages dual deployment)
   */
  static setCustomApiUrl(url: string): void {
    if (typeof window !== 'undefined') {
      if (!url.trim()) {
        localStorage.removeItem(STORAGE_KEY_API_URL);
      } else {
        localStorage.setItem(STORAGE_KEY_API_URL, url.trim().replace(/\/+$/, ''));
      }
    }
  }

  /**
   * Check if current runtime is deployed on GitHub Pages
   */
  static isGitHubPages(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.hostname.endsWith('github.io');
  }
}

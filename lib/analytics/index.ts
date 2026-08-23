/**
 * Landing Firebase Analytics — client-only, fire-and-forget.
 */
import { logEvent, setUserId, setUserProperties, type Analytics } from 'firebase/analytics'
import { initFirebaseAnalytics } from '@/lib/firebase/client'
import {
  AnalyticsEvents,
  sanitizeAnalyticsParams,
  classifyApiDuration,
  classifyPageLoad,
  type AnalyticsEventName,
  type AnalyticsParams,
  type AuthMethod,
  type ApiEndpointName,
  type UserPropertyMap,
} from './types'

let cached: Analytics | null | undefined

function debugEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    String(process.env.NEXT_PUBLIC_ANALYTICS_DEBUG || '').toLowerCase() === 'true'
  )
}

function schedule(fn: () => void): void {
  try {
    if (typeof window !== 'undefined' && typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => fn(), { timeout: 2000 })
    } else {
      setTimeout(fn, 0)
    }
  } catch {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

async function getInstance(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null
  if (cached !== undefined) return cached
  cached = await initFirebaseAnalytics()
  return cached
}

export async function track(
  event: AnalyticsEventName | string,
  params?: AnalyticsParams,
): Promise<void> {
  schedule(() => {
    void (async () => {
      try {
        const instance = await getInstance()
        if (!instance) return
        const safe = sanitizeAnalyticsParams(params)
        if (debugEnabled()) safe.debug_mode = true
        logEvent(instance, event as string, safe)
        if (debugEnabled()) console.info('[analytics]', event, safe)
      } catch (err) {
        if (debugEnabled()) console.warn('[analytics] track failed', event, err)
      }
    })()
  })
}

export async function setAnalyticsUser(uid: string | null): Promise<void> {
  schedule(() => {
    void (async () => {
      try {
        const instance = await getInstance()
        if (!instance) return
        setUserId(instance, uid)
      } catch {
        /* ignore */
      }
    })()
  })
}

export async function setAnalyticsUserProperties(props: UserPropertyMap): Promise<void> {
  schedule(() => {
    void (async () => {
      try {
        const instance = await getInstance()
        if (!instance) return
        const cleaned: Record<string, string> = {}
        for (const [k, v] of Object.entries(props)) {
          if (v == null || v === '') continue
          cleaned[k] = String(v).slice(0, 36)
        }
        if (Object.keys(cleaned).length === 0) return
        setUserProperties(instance, cleaned)
      } catch {
        /* ignore */
      }
    })()
  })
}

export async function clearAnalyticsUser(): Promise<void> {
  await setAnalyticsUser(null)
}

export const analytics = {
  track,
  setUser: setAnalyticsUser,
  setUserProperties: setAnalyticsUserProperties,
  clearUser: clearAnalyticsUser,

  pageView(pagePath: string) {
    void track('page_view', { page_path: pagePath.slice(0, 100) })
  },

  signupStarted(method: AuthMethod) {
    void track(AnalyticsEvents.signup_started, { method })
  },
  signUp(method: AuthMethod) {
    void track(AnalyticsEvents.sign_up, { method })
  },
  signupFailed(method: AuthMethod, errorCode?: string) {
    void track(AnalyticsEvents.signup_failed, { method, error_code: errorCode || 'unknown' })
  },
  loginStarted(method: AuthMethod) {
    void track(AnalyticsEvents.login_started, { method })
  },
  login(method: AuthMethod) {
    void track(AnalyticsEvents.login, { method })
  },
  loginFailed(method: AuthMethod, errorCode?: string) {
    void track(AnalyticsEvents.login_failed, { method, error_code: errorCode || 'unknown' })
  },
  logout() {
    void track(AnalyticsEvents.logout)
    void clearAnalyticsUser()
  },

  modeSelected(mode: string) {
    void track(AnalyticsEvents.mode_selected, { selected_mode: mode })
    void setAnalyticsUserProperties({ selected_mode: mode })
  },

  dashboardView(dashboardType: string, role?: string) {
    void track(AnalyticsEvents.dashboard_view, {
      dashboard_type: dashboardType,
      user_role: role,
    })
  },

  apiPerformance(params: {
    endpointName: ApiEndpointName
    durationMs: number
    statusCode: number
    success: boolean
  }) {
    void track(AnalyticsEvents.api_performance, {
      endpoint_name: params.endpointName,
      api_duration_ms: params.durationMs,
      status_code: params.statusCode,
      success: params.success,
      performance_category: classifyApiDuration(params.durationMs),
    })
  },

  pagePerformance(params: {
    pagePath: string
    ttfbMs?: number
    domInteractiveMs?: number
    domContentLoadedMs?: number
    loadMs?: number
  }) {
    void track(AnalyticsEvents.page_performance, {
      page_path: params.pagePath,
      ttfb_ms: params.ttfbMs,
      dom_interactive_ms: params.domInteractiveMs,
      dom_content_loaded_ms: params.domContentLoadedMs,
      load_ms: params.loadMs,
      performance_category: classifyPageLoad(params.loadMs ?? 0),
    })
  },

  error(params: {
    errorArea: string
    errorType: string
    severity?: string
    route?: string
  }) {
    void track(AnalyticsEvents.app_error, {
      error_area: params.errorArea,
      error_type: params.errorType.slice(0, 80),
      severity: params.severity || 'error',
      route: params.route,
    })
  },

  featureUsed(feature: string) {
    void track(AnalyticsEvents.feature_used, { feature })
  },
}

export function reportNavigationTiming(pagePath: string): void {
  schedule(() => {
    try {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      const nav = entries[0]
      if (!nav) return
      analytics.pagePerformance({
        pagePath,
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
        domInteractiveMs: Math.round(nav.domInteractive),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd || nav.duration),
      })
    } catch {
      /* ignore */
    }
  })
}

export { AnalyticsEvents }
export type { AuthMethod, ApiEndpointName }

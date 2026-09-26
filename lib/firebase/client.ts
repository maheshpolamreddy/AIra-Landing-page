import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth'
import {
  getAnalytics,
  initializeAnalytics,
  isSupported,
  type Analytics,
} from 'firebase/analytics'
import { getFirebaseApp } from '@/lib/firebase/app'
import { firebaseConfig } from '@/lib/firebase/config'

export { getFirebaseApp, getFirebaseDb } from '@/lib/firebase/app'

let auth: Auth | undefined
let analytics: Analytics | undefined
let emulatorConnected = false
let gtagDebugConfigured = false

type GtagFn = (...args: unknown[]) => void

function analyticsDebugEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    String(process.env.NEXT_PUBLIC_ANALYTICS_DEBUG || '').toLowerCase() === 'true'
  )
}

function safeInitErrorCategory(err: unknown): string {
  if (err instanceof Error) return (err.name || 'Error').slice(0, 40)
  return 'init_failed'
}

/**
 * Firebase web DebugView requires gtag config debug_mode (or Chrome extension).
 * Event-param debug_mode alone is not enough for Debug Device count.
 */
function enableGtagDebugMode(measurementId: string): void {
  if (typeof window === 'undefined' || !measurementId || gtagDebugConfigured) return
  const w = window as Window & { gtag?: GtagFn }
  const apply = (): boolean => {
    if (typeof w.gtag !== 'function') return false
    w.gtag('config', measurementId, { debug_mode: true })
    gtagDebugConfigured = true
    if (analyticsDebugEnabled()) {
      console.info('[analytics] gtag debug_mode config applied')
    }
    return true
  }
  if (apply()) return
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    if (apply() || attempts >= 30) window.clearInterval(timer)
  }, 100)
}

function connectEmulatorIfConfigured(authInstance: Auth) {
  if (emulatorConnected || typeof window === 'undefined') return

  const host =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ??
    (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true'
      ? '127.0.0.1:9099'
      : '')

  if (!host) return

  try {
    const protocol = host.startsWith('http') ? '' : 'http://'
    connectAuthEmulator(authInstance, `${protocol}${host}`, {
      disableWarnings: true,
    })
    emulatorConnected = true
  } catch {
    /* already connected (HMR) */
  }
}

/**
 * Browser-safe Auth singleton with durable persistence.
 * Uses initializeAuth (not bare getAuth) so sessions survive refresh in Next.js.
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth

  const app = getFirebaseApp()

  // SSR / RSC: return a lightweight instance (never used for sign-in on server)
  if (typeof window === 'undefined') {
    auth = getAuth(app)
    return auth
  }

  try {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    // Already initialized in this runtime (HMR / second call)
    auth = getAuth(app)
  }

  connectEmulatorIfConfigured(auth)

  return auth
}

/** Warm up Auth on the client (safe to await on mount — not inside a click handler). */
export async function ensureAuthReady(): Promise<Auth> {
  return getFirebaseAuth()
}

export async function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null
  const wantDebug = analyticsDebugEnabled()
  if (analytics) {
    if (wantDebug && firebaseConfig.measurementId) {
      enableGtagDebugMode(firebaseConfig.measurementId)
    }
    return analytics
  }
  try {
    if (wantDebug) {
      console.info('[analytics] Firebase Analytics initialization started')
      console.info(
        '[analytics] debug mode:',
        true,
        '| NEXT_PUBLIC_ANALYTICS_DEBUG=',
        String(process.env.NEXT_PUBLIC_ANALYTICS_DEBUG || ''),
        '| NODE_ENV=',
        String(process.env.NODE_ENV),
      )
    }
    const supported = await isSupported()
    if (wantDebug) console.info('[analytics] isSupported:', supported)
    if (!supported) {
      if (wantDebug) console.warn('[analytics] Analytics initialized: false')
      return null
    }

    const app = getFirebaseApp()
    try {
      if (wantDebug) {
        analytics = initializeAnalytics(app, {
          config: { debug_mode: true },
        })
      } else {
        analytics = getAnalytics(app)
      }
    } catch {
      analytics = getAnalytics(app)
    }

    if (wantDebug && firebaseConfig.measurementId) {
      enableGtagDebugMode(firebaseConfig.measurementId)
    }

    if (wantDebug) {
      console.info('[analytics] Analytics initialized:', !!analytics)
      console.info('[analytics] debug mode:', true)
    }
    return analytics
  } catch (err) {
    if (wantDebug) {
      console.warn('[analytics] Analytics initialized: false', safeInitErrorCategory(err))
    }
    return null
  }
}

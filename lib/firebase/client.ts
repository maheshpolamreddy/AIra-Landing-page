import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'
import { getFirebaseApp } from '@/lib/firebase/app'

export { getFirebaseApp, getFirebaseDb } from '@/lib/firebase/app'

let auth: Auth | undefined
let analytics: Analytics | undefined
let emulatorConnected = false

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
  if (analytics) return analytics
  try {
    const supported = await isSupported()
    if (!supported) return null
    analytics = getAnalytics(getFirebaseApp())
    return analytics
  } catch {
    return null
  }
}

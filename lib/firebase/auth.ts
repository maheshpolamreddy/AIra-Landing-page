import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
  type AuthProvider,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ensureAuthReady, getFirebaseAuth } from '@/lib/firebase/client'
import { getFirebaseDb } from '@/lib/firebase/app'
import { getAuthErrorCode, mapAuthError } from '@/lib/firebase/errors'
import { normalizeAppRole, type AppRole } from '@/lib/auth-redirect'
import { clearRoleHint } from '@/lib/session-hints'

export type SignUpInput = {
  name: string
  email: string
  password: string
  dateOfBirth?: string
  role?: AppRole
}

const WELCOME_HINT_KEY = 'aira:welcome-email-sent'
const WELCOME_TIMEOUT_MS = 12_000

function readWelcomeHint(uid: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(WELCOME_HINT_KEY) === uid
  } catch {
    return false
  }
}

function writeWelcomeHint(uid: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WELCOME_HINT_KEY, uid)
  } catch {
    /* ignore */
  }
}

/**
 * Best-effort welcome email.
 * Must be awaited before hard navigations (`window.location.assign`) — a
 * fire-and-forget call was getting aborted when signup redirected immediately.
 */
async function requestWelcomeEmail(
  user: User,
  name?: string,
  options: { force?: boolean } = {},
): Promise<void> {
  try {
    if (!user.email) return
    if (!options.force && readWelcomeHint(user.uid)) return

    const idToken = await user.getIdToken()
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), WELCOME_TIMEOUT_MS)

    try {
      const res = await fetch('/api/welcome', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name:
            name?.trim() ||
            user.displayName?.trim() ||
            user.email.split('@')[0] ||
            'Learner',
        }),
        keepalive: true,
        signal: controller.signal,
      })

      let payload: { ok?: boolean; skipped?: boolean; sent?: boolean; reason?: string } = {}
      try {
        payload = (await res.json()) as typeof payload
      } catch {
        /* ignore non-json */
      }

      // Mark local hint whenever the server confirms send or already-sent.
      if (res.ok && (payload.sent || payload.skipped || payload.ok)) {
        writeWelcomeHint(user.uid)
      } else {
        console.warn('[auth] welcome email response', res.status, payload)
      }
    } finally {
      window.clearTimeout(timer)
    }
  } catch (err) {
    console.warn('[auth] welcome email request failed', err)
  }
}

async function saveUserProfile(
  user: User,
  extra: { name: string; dateOfBirth?: string; provider: string; role?: AppRole },
) {
  const db = getFirebaseDb()
  const role = normalizeAppRole(extra.role)
  const ref = doc(db, 'users', user.uid)
  const existing = await getDoc(ref)
  const isNew = !existing.exists()

  await setDoc(
    ref,
    {
      uid: user.uid,
      name: extra.name,
      email: user.email,
      dateOfBirth: extra.dateOfBirth ?? null,
      role,
      provider: extra.provider,
      ...(isNew ? { createdAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  return { isNew }
}

/** Read role from Firestore profile; defaults to student. */
export async function getUserAppRole(uid: string): Promise<AppRole> {
  try {
    const snap = await getDoc(doc(getFirebaseDb(), 'users', uid))
    return normalizeAppRole(snap.data()?.role)
  } catch (err) {
    console.warn('[auth] getUserAppRole failed', err)
    return 'student'
  }
}

/**
 * Role for the post-auth redirect, without letting a slow Firestore read hold
 * the navigation open.
 *
 * A cached role from a previous session is almost always right, so we only wait
 * briefly for confirmation. With no cache we wait longer, because guessing
 * wrong would bounce a teacher through a student URL first. Either way the
 * tutor's RoleGuard corrects a wrong guess on arrival.
 */
export async function resolveRoleForRedirect(
  uid: string,
  cachedRole: AppRole | null,
): Promise<AppRole> {
  const budgetMs = cachedRole ? 600 : 2500
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      getUserAppRole(uid),
      new Promise<AppRole>((resolve) => {
        timer = setTimeout(() => resolve(cachedRole ?? 'student'), budgetMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function upsertOAuthProfile(
  cred: UserCredential,
  provider: string,
): Promise<UserCredential> {
  const name =
    cred.user.displayName?.trim() ||
    cred.user.email?.split('@')[0] ||
    'Student'
  const isNewUser = getAdditionalUserInfo(cred)?.isNewUser === true

  let isNewProfile = isNewUser
  try {
    const saved = await saveUserProfile(cred.user, { name, provider })
    isNewProfile = isNewProfile || saved.isNew
  } catch (profileErr) {
    console.error('[auth] profile save failed', profileErr)
  }

  // First-time accounts (Auth or Firestore) — await so redirect cannot abort send.
  // Returning users: still attempt once if this device never confirmed delivery
  // (covers accounts created before welcome mail shipped). API stays idempotent.
  if (isNewUser || isNewProfile || !readWelcomeHint(cred.user.uid)) {
    await requestWelcomeEmail(cred.user, name, { force: isNewUser || isNewProfile })
  }

  return cred
}

async function signInWithProviderPopup(
  provider: AuthProvider,
  providerKey: string,
): Promise<UserCredential> {
  // Must stay synchronous up to signInWithPopup so the browser keeps the user gesture
  // (awaiting before the popup causes silent popup blocking).
  const auth = getFirebaseAuth()
  try {
    const cred = await signInWithPopup(auth, provider)
    return await upsertOAuthProfile(cred, providerKey)
  } catch (err) {
    const code = getAuthErrorCode(err)
    // Avoid logging the Error object — Next.js surfaces that as a Console Error overlay.
    console.warn(`[auth] ${providerKey} sign-in failed:`, code || 'unknown')
    throw new Error(mapAuthError(err, providerKey))
  }
}

export async function signUpWithEmail(
  input: SignUpInput,
): Promise<UserCredential> {
  const auth = await ensureAuthReady()
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password,
    )
    const displayName = input.name.trim()
    await updateProfile(cred.user, { displayName })
    try {
      await saveUserProfile(cred.user, {
        name: displayName,
        dateOfBirth: input.dateOfBirth,
        provider: 'password',
        role: normalizeAppRole(input.role),
      })
    } catch (profileErr) {
      console.error('[auth] profile save failed', profileErr)
    }
    // Await welcome send BEFORE signup page redirects away.
    await requestWelcomeEmail(cred.user, displayName, { force: true })
    return cred
  } catch (err) {
    console.warn('[auth] email signup failed:', getAuthErrorCode(err) || 'unknown')
    throw new Error(mapAuthError(err))
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<UserCredential> {
  const auth = await ensureAuthReady()
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
    // Backfill welcome for accounts that never received it (idempotent API).
    if (!readWelcomeHint(cred.user.uid)) {
      await requestWelcomeEmail(cred.user)
    }
    return cred
  } catch (err) {
    console.warn('[auth] email sign-in failed:', getAuthErrorCode(err) || 'unknown')
    throw new Error(mapAuthError(err))
  }
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  provider.addScope('profile')
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithProviderPopup(provider, 'google')
}

export async function signInWithMicrosoft(): Promise<UserCredential> {
  const provider = new OAuthProvider('microsoft.com')
  provider.setCustomParameters({ prompt: 'select_account' })
  provider.addScope('email')
  provider.addScope('openid')
  provider.addScope('profile')
  return signInWithProviderPopup(provider, 'microsoft')
}

export async function signInWithApple(): Promise<UserCredential> {
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  return signInWithProviderPopup(provider, 'apple')
}

export async function resetPassword(email: string): Promise<void> {
  const auth = await ensureAuthReady()
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (err) {
    console.warn('[auth] reset password failed:', getAuthErrorCode(err) || 'unknown')
    throw new Error(mapAuthError(err))
  }
}

export async function logOut(): Promise<void> {
  const auth = await ensureAuthReady()
  try {
    await signOut(auth)
  } catch (err) {
    throw new Error(mapAuthError(err))
  } finally {
    // Drop the role hint even if sign-out threw, so the next person on this
    // device is never routed as the previous one.
    clearRoleHint()
  }
}

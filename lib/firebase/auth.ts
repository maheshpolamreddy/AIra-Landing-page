import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  sendEmailVerification,
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
import { assertEmailQuality } from '@/lib/email-quality'
import { clearRoleHint } from '@/lib/session-hints'

const PROD_LANDING = 'https://aira-landing-page-elite.vercel.app'

/** Password accounts must click the inbox link; OAuth providers already verified the mailbox. */
export function needsEmailVerification(user: User | null | undefined): boolean {
  if (!user || user.emailVerified) return false
  const ids = user.providerData.map((p) => p.providerId)
  if (ids.includes('password') || ids.length === 0) return true
  return false
}

function verificationContinueUrl(): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : PROD_LANDING
  return `${origin}/login?verified=1`
}

export async function sendVerificationEmail(): Promise<void> {
  const auth = await ensureAuthReady()
  const user = auth.currentUser
  if (!user) {
    throw new Error('Please sign in to verify your email.')
  }
  if (user.emailVerified) return
  try {
    await sendEmailVerification(user, {
      url: verificationContinueUrl(),
      handleCodeInApp: false,
    })
  } catch (err) {
    console.warn('[auth] send verification failed:', getAuthErrorCode(err) || 'unknown')
    throw new Error(mapAuthError(err))
  }
}

export async function reloadCurrentUser(): Promise<User | null> {
  const auth = await ensureAuthReady()
  const user = auth.currentUser
  if (!user) return null
  await user.reload()
  return auth.currentUser
}

export type SignUpInput = {
  name: string
  email: string
  password: string
  dateOfBirth?: string
  role?: AppRole
}

/** Best-effort branded welcome mail; never blocks signup/login. */
async function requestWelcomeEmail(user: User, name?: string): Promise<void> {
  try {
    if (!user.email) return
    const idToken = await user.getIdToken()
    const displayName =
      name?.trim() ||
      user.displayName?.trim() ||
      user.email.split('@')[0] ||
      'there'

    void fetch('/api/welcome', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: displayName }),
      keepalive: true,
    }).catch((err) => {
      console.warn('[auth] welcome email request failed', err)
    })
  } catch (err) {
    console.warn('[auth] welcome email request setup failed', err)
  }
}

async function saveUserProfile(
  user: User,
  extra: { name: string; dateOfBirth?: string; provider: string; role?: AppRole },
  options?: { preserveExistingRole?: boolean },
) {
  const db = getFirebaseDb()
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  const isNew = !snap.exists()

  const payload: Record<string, unknown> = {
    uid: user.uid,
    name: extra.name,
    email: user.email,
    dateOfBirth: extra.dateOfBirth ?? null,
    provider: extra.provider,
    updatedAt: serverTimestamp(),
  }

  if (isNew) {
    payload.createdAt = serverTimestamp()
  }

  if (options?.preserveExistingRole) {
    if (isNew) {
      payload.role = normalizeAppRole(extra.role)
    }
    // Existing docs keep their role — OAuth must not clobber teacher/admin → student.
  } else {
    payload.role = normalizeAppRole(extra.role)
  }

  await setDoc(ref, payload, { merge: true })
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
  try {
    await saveUserProfile(cred.user, { name, provider }, { preserveExistingRole: true })
  } catch (profileErr) {
    console.error('[auth] profile save failed', profileErr)
  }
  if (isNewUser) {
    void requestWelcomeEmail(cred.user, name)
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
  const email = assertEmailQuality(input.email)
  const auth = await ensureAuthReady()
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      input.password,
    )
    await updateProfile(cred.user, { displayName: input.name.trim() })
    try {
      await saveUserProfile(cred.user, {
        name: input.name.trim(),
        dateOfBirth: input.dateOfBirth,
        provider: 'password',
        // Public signup cannot self-assign admin.
        role: normalizeAppRole(input.role) === 'admin' ? 'student' : normalizeAppRole(input.role),
      })
    } catch (profileErr) {
      console.error('[auth] profile save failed', profileErr)
    }
    try {
      await sendEmailVerification(cred.user, {
        url: verificationContinueUrl(),
        handleCodeInApp: false,
      })
    } catch (verifyErr) {
      console.warn(
        '[auth] send verification after signup failed:',
        getAuthErrorCode(verifyErr) || 'unknown',
      )
    }
    void requestWelcomeEmail(cred.user, input.name.trim())
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
  const normalized = assertEmailQuality(email)
  const auth = await ensureAuthReady()
  try {
    return await signInWithEmailAndPassword(auth, normalized, password)
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
  const normalized = assertEmailQuality(email)
  const auth = await ensureAuthReady()
  try {
    await sendPasswordResetEmail(auth, normalized)
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

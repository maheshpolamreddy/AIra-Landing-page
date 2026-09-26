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
import { analytics, type AuthMethod } from '@/lib/analytics'

const PROD_LANDING = 'https://aira-landing-page-elite.vercel.app'
const PROD_TUTOR_HOSTS = ['ai-ra-app.vercel.app', 'localhost:5173', '127.0.0.1:5173']

/** Landing owns transactional email APIs; tutor standalone host does not. */
function emailApiUrl(path: string): string {
  if (typeof window === 'undefined') return path
  const origin = window.location.origin.replace(/\/$/, '')
  const onTutorHost = PROD_TUTOR_HOSTS.some((h) => origin.includes(h))
  if (!onTutorHost) return path
  const landing =
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '')) ||
    PROD_LANDING
  if (origin.includes('5173')) return `http://localhost:3000${path}`
  return `${landing}${path}`
}

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

/** Branded verification via Resend; falls back to Firebase default if API unavailable. */
async function requestVerificationEmail(user: User, name?: string): Promise<void> {
  const displayName =
    name?.trim() ||
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    'there'

  try {
    const idToken = await user.getIdToken()
    const started = performance.now()
    const res = await fetch(emailApiUrl('/api/auth/send-verification'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: displayName }),
    })
    analytics.apiPerformance({
      endpointName: 'send_verification',
      durationMs: Math.round(performance.now() - started),
      statusCode: res.status,
      success: res.ok,
    })
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      sent?: boolean
      code?: string
      error?: string
      retryAfterSec?: number
    }

    if (res.ok && payload.sent) {
      console.info('[auth] branded verification email sent')
      analytics.featureUsed('verification_email_sent')
      return
    }

    if (res.status === 429) {
      throw new Error(
        `Please wait ${payload.retryAfterSec ?? 60} seconds before requesting another email.`,
      )
    }

    if (res.status === 503) {
      console.warn('[auth] branded verification unavailable; using Firebase default')
      await sendEmailVerification(user, {
        url: verificationContinueUrl(),
        handleCodeInApp: false,
      })
      return
    }

    console.warn('[auth] verification API failed', res.status, payload.code || payload.error)
    // Prefer Firebase default over blocking signup when branded send fails
    console.warn('[auth] falling back to Firebase default verification email')
    await sendEmailVerification(user, {
      url: verificationContinueUrl(),
      handleCodeInApp: false,
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('wait')) throw err
    console.warn('[auth] verification request failed; trying Firebase default', err)
    await sendEmailVerification(user, {
      url: verificationContinueUrl(),
      handleCodeInApp: false,
    })
  }
}

export async function sendVerificationEmail(): Promise<void> {
  const auth = await ensureAuthReady()
  const user = auth.currentUser
  if (!user) {
    throw new Error('Please sign in to verify your email.')
  }
  if (user.emailVerified) return
  try {
    await requestVerificationEmail(
      user,
      user.displayName?.trim() || user.email?.split('@')[0],
    )
  } catch (err) {
    console.warn('[auth] send verification failed:', getAuthErrorCode(err) || 'unknown')
    throw err instanceof Error ? err : new Error(mapAuthError(err))
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

/**
 * Best-effort branded welcome mail. Awaits API response (not SMTP) so redirects
 * do not abort the request; failures never throw to callers.
 */
export async function requestWelcomeEmail(user: User, name?: string): Promise<void> {
  try {
    if (!user.email) return
    const idToken = await user.getIdToken()
    const displayName =
      name?.trim() ||
      user.displayName?.trim() ||
      user.email.split('@')[0] ||
      'there'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const started = performance.now()
      const res = await fetch(emailApiUrl('/api/welcome'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: displayName }),
        signal: controller.signal,
        keepalive: true,
      })
      analytics.apiPerformance({
        endpointName: 'welcome',
        durationMs: Math.round(performance.now() - started),
        statusCode: res.status,
        success: res.ok,
      })
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        sent?: boolean
        skipped?: boolean
        code?: string
        error?: string
      }
      if (!res.ok) {
        console.warn('[auth] welcome email HTTP', res.status, payload.code || payload.error || '')
        analytics.error({
          errorArea: 'auth',
          errorType: payload.code || 'welcome_failed',
          severity: 'warning',
        })
      } else if (payload.sent) {
        console.info('[auth] welcome email queued/sent', payload.code)
        analytics.featureUsed('welcome_email_sent')
      } else if (payload.skipped) {
        console.info('[auth] welcome email skipped', payload.code)
      }
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    console.warn(
      '[auth] welcome email request failed',
      err instanceof Error ? err.message : 'unknown',
    )
  }
}

/** Send welcome only when the profile still has welcomeEmailPending. */
export async function maybeSendWelcomeEmail(user: User, name?: string): Promise<void> {
  if (!(await shouldRequestWelcomeEmail(user))) return
  await requestWelcomeEmail(user, name)
}

/** Retry welcome only when a prior signup/OAuth send failed (welcomeEmailPending). */
export async function retryWelcomeEmailIfPending(user: User, name?: string): Promise<void> {
  await maybeSendWelcomeEmail(user, name)
}

async function saveUserProfile(
  user: User,
  extra: { name: string; dateOfBirth?: string; provider: string; role?: AppRole },
  options?: { preserveExistingRole?: boolean },
): Promise<{ isNew: boolean; welcomeEmailPending: boolean; welcomeEmailSent: boolean }> {
  const db = getFirebaseDb()
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  const isNew = !snap.exists()
  const existing = snap.data()

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
    // Lets welcome mail retry after SMTP failures (isNewUser is true only once).
    payload.welcomeEmailPending = true
  }

  if (options?.preserveExistingRole) {
    if (isNew) {
      payload.role = normalizeAppRole(extra.role)
    }
    // Existing docs keep their role — OAuth must not clobber teacher/admin → student.
  } else {
    payload.role = normalizeAppRole(extra.role)
  }

  try {
    await setDoc(ref, payload, { merge: true })
  } catch (err) {
    console.error('[auth] profile save failed', err)
    if (isNew) {
      try {
        await setDoc(
          ref,
          {
            uid: user.uid,
            email: user.email,
            welcomeEmailPending: true,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        )
      } catch (retryErr) {
        console.error('[auth] minimal profile save failed', retryErr)
      }
    }
  }

  return {
    isNew,
    welcomeEmailPending: isNew
      ? true
      : existing?.welcomeEmailPending === true,
    welcomeEmailSent: existing?.welcomeEmailSent === true,
  }
}

/** True when this account still needs a successful welcome send. */
export async function shouldRequestWelcomeEmail(user: User): Promise<boolean> {
  if (!user.email) return false
  try {
    const snap = await getDoc(doc(getFirebaseDb(), 'users', user.uid))
    const data = snap.data()
    if (!data) return false
    if (data.welcomeEmailSent === true) return false
    return data.welcomeEmailPending === true
  } catch (err) {
    console.warn('[auth] shouldRequestWelcomeEmail failed', err)
    return false
  }
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
    await saveUserProfile(
      cred.user,
      { name, provider },
      { preserveExistingRole: true },
    )
  } catch (profileErr) {
    console.error('[auth] profile save failed', profileErr)
  }
  if (isNewUser) {
    await requestWelcomeEmail(cred.user, name)
  } else {
    await maybeSendWelcomeEmail(cred.user, name)
  }
  return cred
}

async function signInWithProviderPopup(
  provider: AuthProvider,
  providerKey: string,
): Promise<UserCredential> {
  const method = (['google', 'apple', 'microsoft'].includes(providerKey)
    ? providerKey
    : 'unknown') as AuthMethod
  analytics.loginStarted(method)
  const auth = getFirebaseAuth()
  try {
    const cred = await signInWithPopup(auth, provider)
    const isNewUser = getAdditionalUserInfo(cred)?.isNewUser === true
    const result = await upsertOAuthProfile(cred, providerKey)
    if (isNewUser) {
      analytics.signUp(method)
    } else {
      analytics.login(method)
    }
    void analytics.setUser(cred.user.uid)
    return result
  } catch (err) {
    const code = getAuthErrorCode(err)
    analytics.loginFailed(method, code || 'unknown')
    console.warn(`[auth] ${providerKey} sign-in failed:`, code || 'unknown')
    throw new Error(mapAuthError(err, providerKey))
  }
}

export async function signUpWithEmail(
  input: SignUpInput,
): Promise<UserCredential & { verificationEmailSent?: boolean }> {
  const email = assertEmailQuality(input.email)
  const auth = await ensureAuthReady()
  console.info('[auth] signup started')
  analytics.signupStarted('email')
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      input.password,
    )
    console.info('[auth] user created')
    await updateProfile(cred.user, { displayName: input.name.trim() })
    try {
      await saveUserProfile(cred.user, {
        name: input.name.trim(),
        dateOfBirth: input.dateOfBirth,
        provider: 'password',
        // Public signup cannot self-assign admin.
        role: normalizeAppRole(input.role) === 'admin' ? 'student' : normalizeAppRole(input.role),
      })
      // welcomeEmailPending is set inside saveUserProfile for new docs.
    } catch (profileErr) {
      console.error('[auth] profile save failed', profileErr)
    }
    let verificationEmailSent = false
    try {
      console.info('[auth] sending verification email')
      await requestVerificationEmail(cred.user, input.name.trim())
      verificationEmailSent = true
      console.info('[auth] verification email sent')
    } catch (verifyErr) {
      console.warn(
        '[auth] verification email failed:',
        getAuthErrorCode(verifyErr) || 'unknown',
      )
    }
    try {
      await requestWelcomeEmail(cred.user, input.name.trim())
    } catch (welcomeErr) {
      console.warn(
        '[auth] send welcome after signup failed:',
        getAuthErrorCode(welcomeErr) || 'unknown',
      )
    }
    analytics.signUp('email')
    void analytics.setUser(cred.user.uid)
    const role =
      normalizeAppRole(input.role) === 'admin' ? 'student' : normalizeAppRole(input.role)
    void analytics.setUserProperties({ user_role: role || 'student' })
    return Object.assign(cred, { verificationEmailSent })
  } catch (err) {
    analytics.signupFailed('email', getAuthErrorCode(err) || 'unknown')
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
  analytics.loginStarted('email')
  try {
    const cred = await signInWithEmailAndPassword(auth, normalized, password)
    analytics.login('email')
    void analytics.setUser(cred.user.uid)
    return cred
  } catch (err) {
    analytics.loginFailed('email', getAuthErrorCode(err) || 'unknown')
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
    analytics.logout()
  } catch (err) {
    console.warn('[auth] logout failed:', getAuthErrorCode(err) || 'unknown')
    analytics.logout()
    throw new Error(mapAuthError(err))
  } finally {
    // Drop the role hint even if sign-out threw, so the next person on this
    // device is never routed as the previous one.
    clearRoleHint()
  }
}

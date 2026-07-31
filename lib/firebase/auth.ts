import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
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

async function saveUserProfile(
  user: User,
  extra: { name: string; dateOfBirth?: string; provider: string; role?: AppRole },
) {
  const db = getFirebaseDb()
  const role = normalizeAppRole(extra.role)
  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      name: extra.name,
      email: user.email,
      dateOfBirth: extra.dateOfBirth ?? null,
      role,
      provider: extra.provider,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
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
  try {
    await saveUserProfile(cred.user, { name, provider })
  } catch (profileErr) {
    console.error('[auth] profile save failed', profileErr)
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
    await updateProfile(cred.user, { displayName: input.name.trim() })
    try {
      await saveUserProfile(cred.user, {
        name: input.name.trim(),
        dateOfBirth: input.dateOfBirth,
        provider: 'password',
        role: normalizeAppRole(input.role),
      })
    } catch (profileErr) {
      console.error('[auth] profile save failed', profileErr)
    }
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
    return await signInWithEmailAndPassword(auth, email.trim(), password)
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

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
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { ensureAuthReady, getFirebaseAuth } from '@/lib/firebase/client'
import { getFirebaseDb } from '@/lib/firebase/app'
import { getAuthErrorCode, mapAuthError } from '@/lib/firebase/errors'

export type SignUpInput = {
  name: string
  email: string
  password: string
  dateOfBirth?: string
}

async function saveUserProfile(
  user: User,
  extra: { name: string; dateOfBirth?: string; provider: string },
) {
  const db = getFirebaseDb()
  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      name: extra.name,
      email: user.email,
      dateOfBirth: extra.dateOfBirth ?? null,
      role: 'student',
      provider: extra.provider,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
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
    console.error(`[auth] ${providerKey} sign-in failed`, getAuthErrorCode(err), err)
    throw new Error(mapAuthError(err))
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
      })
    } catch (profileErr) {
      console.error('[auth] profile save failed', profileErr)
    }
    return cred
  } catch (err) {
    console.error('[auth] email signup failed', getAuthErrorCode(err), err)
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
    console.error('[auth] email sign-in failed', getAuthErrorCode(err), err)
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
    console.error('[auth] reset password failed', getAuthErrorCode(err), err)
    throw new Error(mapAuthError(err))
  }
}

export async function logOut(): Promise<void> {
  const auth = await ensureAuthReady()
  try {
    await signOut(auth)
  } catch (err) {
    throw new Error(mapAuthError(err))
  }
}

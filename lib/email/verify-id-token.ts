import { firebaseConfig } from '@/lib/firebase/config'

export type VerifiedFirebaseUser = {
  uid: string
  email: string | null
  name: string | null
}

type AccountsLookupResponse = {
  users?: Array<{
    localId?: string
    email?: string
    displayName?: string
  }>
  error?: { message?: string }
}

/**
 * Verify a Firebase ID token via Identity Toolkit (no Admin SDK required).
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedFirebaseUser | null> {
  const token = idToken.trim()
  if (!token) return null

  const apiKey = firebaseConfig.apiKey
  if (!apiKey) return null

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    },
  )

  const data = (await res.json()) as AccountsLookupResponse
  if (!res.ok || !data.users?.[0]?.localId) {
    console.warn('[welcome-email] id token verify failed', data.error?.message || res.status)
    return null
  }

  const user = data.users[0]
  return {
    uid: user.localId!,
    email: user.email ?? null,
    name: user.displayName ?? null,
  }
}

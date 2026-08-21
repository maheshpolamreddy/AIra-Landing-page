import { readFileSync } from 'node:fs'
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'aira-landingpage'

/** Ignore stale claims older than this so failed sends can retry. */
const CLAIM_TTL_MS = 5 * 60 * 1000

export type VerifiedIdToken = {
  uid: string
  email?: string
  name?: string
}

function hasServiceAccountCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  )
}

function loadServiceAccount(): ServiceAccount | undefined {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (inline) {
    try {
      return JSON.parse(inline) as ServiceAccount
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.')
    }
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (path) {
    return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount
  }

  return undefined
}

function getAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const credentials = loadServiceAccount()
  if (credentials) {
    return initializeApp({
      credential: cert(credentials),
      projectId: PROJECT_ID,
    })
  }

  // Local ADC only — never rely on this on Vercel (no metadata credentials).
  return initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  })
}

function apiKey(): string {
  const key =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    // Same client default as lib/firebase/config.ts (public web API key).
    'AIzaSyC9L2gJBJI_C0kCy2zVxMfiZqIGEjd-w1o'
  return key
}

function firestoreDocUrl(uid: string): string {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`
}

function readStringField(
  fields: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const raw = fields?.[key] as { stringValue?: string } | undefined
  return typeof raw?.stringValue === 'string' ? raw.stringValue : null
}

function readBoolField(
  fields: Record<string, unknown> | undefined,
  key: string,
): boolean {
  const raw = fields?.[key] as { booleanValue?: boolean } | undefined
  return raw?.booleanValue === true
}

function readTimestampMs(
  fields: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const raw = fields?.[key] as { timestampValue?: string } | undefined
  if (!raw?.timestampValue) return null
  const ms = Date.parse(raw.timestampValue)
  return Number.isFinite(ms) ? ms : null
}

/** Verify Firebase ID token without Admin SDK (works on Vercel when SA is missing). */
async function verifyIdTokenViaRest(idToken: string): Promise<VerifiedIdToken> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Invalid token (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ''}`)
  }

  const data = (await res.json()) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string }>
  }
  const user = data.users?.[0]
  if (!user?.localId) {
    throw new Error('Invalid token: no user')
  }

  return {
    uid: user.localId,
    email: user.email,
    name: user.displayName,
  }
}

async function getUserDocViaRest(
  uid: string,
  idToken: string,
): Promise<{ fields: Record<string, unknown>; exists: boolean }> {
  const res = await fetch(firestoreDocUrl(uid), {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store',
  })

  if (res.status === 404) {
    return { fields: {}, exists: false }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Firestore read failed (${res.status}): ${detail.slice(0, 160)}`)
  }

  const data = (await res.json()) as { fields?: Record<string, unknown> }
  return { fields: data.fields ?? {}, exists: true }
}

async function patchUserDocViaRest(
  uid: string,
  idToken: string,
  fields: Record<string, unknown>,
  fieldPaths: string[],
): Promise<void> {
  const params = new URLSearchParams()
  for (const path of fieldPaths) {
    params.append('updateMask.fieldPaths', path)
  }

  const res = await fetch(`${firestoreDocUrl(uid)}?${params.toString()}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Firestore write failed (${res.status}): ${detail.slice(0, 160)}`)
  }
}

export async function verifyIdToken(idToken: string): Promise<VerifiedIdToken> {
  if (hasServiceAccountCredentials()) {
    try {
      const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken)
      return {
        uid: decoded.uid,
        email: decoded.email,
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
      }
    } catch (err) {
      console.warn(
        '[admin] Admin verifyIdToken failed; falling back to REST',
        err instanceof Error ? err.message : 'unknown',
      )
    }
  }

  return verifyIdTokenViaRest(idToken)
}

export async function getUserWelcomeState(uid: string): Promise<{
  welcomeEmailSent: boolean
  name: string | null
}> {
  const snap = await getFirestore(getAdminApp()).collection('users').doc(uid).get()
  const data = snap.data()
  return {
    welcomeEmailSent: data?.welcomeEmailSent === true,
    name: typeof data?.name === 'string' ? data.name : null,
  }
}

export type WelcomeClaimResult =
  | { status: 'already_sent'; name: string | null }
  | { status: 'claimed'; name: string | null }
  | { status: 'in_flight'; name: string | null }

async function claimWelcomeEmailSendViaRest(
  uid: string,
  idToken: string,
): Promise<WelcomeClaimResult> {
  const { fields } = await getUserDocViaRest(uid, idToken)
  const name = readStringField(fields, 'name')

  if (readBoolField(fields, 'welcomeEmailSent')) {
    return { status: 'already_sent', name }
  }

  const claimedMs = readTimestampMs(fields, 'welcomeEmailClaimedAt')
  if (claimedMs != null) {
    const age = Date.now() - claimedMs
    if (age >= 0 && age < CLAIM_TTL_MS) {
      return { status: 'in_flight', name }
    }
  }

  const now = new Date().toISOString()
  await patchUserDocViaRest(
    uid,
    idToken,
    {
      welcomeEmailClaimedAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
    },
    ['welcomeEmailClaimedAt', 'updatedAt'],
  )

  return { status: 'claimed', name }
}

/**
 * Claim the right to send welcome mail. Never sets welcomeEmailSent here —
 * that happens only after SMTP succeeds.
 *
 * Pass `idToken` so production can claim via Firestore REST when Admin SA is absent.
 */
export async function claimWelcomeEmailSend(
  uid: string,
  idToken?: string,
): Promise<WelcomeClaimResult> {
  if (hasServiceAccountCredentials()) {
    try {
      const ref = getFirestore(getAdminApp()).collection('users').doc(uid)
      return await getFirestore(getAdminApp()).runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        const data = snap.data() ?? {}
        const name = typeof data.name === 'string' ? data.name : null

        if (data.welcomeEmailSent === true) {
          return { status: 'already_sent', name }
        }

        const claimedAt = data.welcomeEmailClaimedAt
        if (claimedAt && typeof claimedAt.toMillis === 'function') {
          const age = Date.now() - claimedAt.toMillis()
          if (age >= 0 && age < CLAIM_TTL_MS) {
            return { status: 'in_flight', name }
          }
        }

        tx.set(
          ref,
          {
            welcomeEmailClaimedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        return { status: 'claimed', name }
      })
    } catch (err) {
      console.warn(
        '[admin] Admin claim failed; falling back to REST',
        err instanceof Error ? err.message : 'unknown',
      )
    }
  }

  if (!idToken) {
    throw new Error('Welcome claim requires idToken when Admin credentials are unavailable')
  }
  return claimWelcomeEmailSendViaRest(uid, idToken)
}

export async function markWelcomeEmailSent(uid: string, idToken?: string): Promise<void> {
  if (hasServiceAccountCredentials()) {
    try {
      await getFirestore(getAdminApp())
        .collection('users')
        .doc(uid)
        .set(
          {
            welcomeEmailSent: true,
            welcomeEmailSentAt: FieldValue.serverTimestamp(),
            welcomeEmailClaimedAt: FieldValue.delete(),
            welcomeEmailPending: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      return
    } catch (err) {
      console.warn(
        '[admin] Admin markWelcomeEmailSent failed; falling back to REST',
        err instanceof Error ? err.message : 'unknown',
      )
    }
  }

  if (!idToken) {
    throw new Error('markWelcomeEmailSent requires idToken when Admin credentials are unavailable')
  }

  const now = new Date().toISOString()
  // Field in updateMask but omitted from fields → deleted.
  await patchUserDocViaRest(
    uid,
    idToken,
    {
      welcomeEmailSent: { booleanValue: true },
      welcomeEmailSentAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
    },
    [
      'welcomeEmailSent',
      'welcomeEmailSentAt',
      'welcomeEmailClaimedAt',
      'welcomeEmailPending',
      'updatedAt',
    ],
  )
}

/** Clear claim after SMTP failure so a later login can retry. */
export async function clearWelcomeEmailClaim(uid: string, idToken?: string): Promise<void> {
  if (hasServiceAccountCredentials()) {
    try {
      await getFirestore(getAdminApp())
        .collection('users')
        .doc(uid)
        .set(
          {
            welcomeEmailClaimedAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      return
    } catch (err) {
      console.warn(
        '[admin] Admin clearWelcomeEmailClaim failed; falling back to REST',
        err instanceof Error ? err.message : 'unknown',
      )
    }
  }

  if (!idToken) {
    throw new Error('clearWelcomeEmailClaim requires idToken when Admin credentials are unavailable')
  }

  const now = new Date().toISOString()
  await patchUserDocViaRest(
    uid,
    idToken,
    {
      updatedAt: { timestampValue: now },
    },
    ['welcomeEmailClaimedAt', 'updatedAt'],
  )
}

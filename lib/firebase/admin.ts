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

  // Last resort for local ADC; production should set FIREBASE_SERVICE_ACCOUNT_JSON.
  return initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  })
}

export async function verifyIdToken(idToken: string) {
  const auth = getAuth(getAdminApp())
  return auth.verifyIdToken(idToken)
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

/**
 * Claim the right to send welcome mail. Never sets welcomeEmailSent here —
 * that happens only after SMTP succeeds.
 */
export async function claimWelcomeEmailSend(uid: string): Promise<WelcomeClaimResult> {
  const ref = getFirestore(getAdminApp()).collection('users').doc(uid)
  return getFirestore(getAdminApp()).runTransaction(async (tx) => {
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
}

export async function markWelcomeEmailSent(uid: string): Promise<void> {
  await getFirestore(getAdminApp())
    .collection('users')
    .doc(uid)
    .set(
      {
        welcomeEmailSent: true,
        welcomeEmailSentAt: FieldValue.serverTimestamp(),
        welcomeEmailClaimedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
}

/** Clear claim after SMTP failure so a later login can retry. */
export async function clearWelcomeEmailClaim(uid: string): Promise<void> {
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
}

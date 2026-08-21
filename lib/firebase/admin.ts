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

export async function markWelcomeEmailSent(uid: string): Promise<void> {
  await getFirestore(getAdminApp())
    .collection('users')
    .doc(uid)
    .set(
      {
        welcomeEmailSent: true,
        welcomeEmailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
}

import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'aira-landingpage'

const VERIFICATION_COOLDOWN_MS = 60_000

function hasCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  )
}

function loadServiceAccount(): ServiceAccount {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (inline) {
    return JSON.parse(inline) as ServiceAccount
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (path) {
    return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount
  }
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required')
}

function getAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing
  return initializeApp({
    credential: cert(loadServiceAccount()),
    projectId: PROJECT_ID,
  })
}

export function isVerificationAdminConfigured(): boolean {
  if (!hasCredentials()) return false
  try {
    loadServiceAccount()
    return true
  } catch {
    return false
  }
}

export async function generateVerificationLink(
  email: string,
  continueUrl: string,
): Promise<string> {
  return getAuth(getAdminApp()).generateEmailVerificationLink(email, {
    url: continueUrl,
    handleCodeInApp: false,
  })
}

export async function verificationCooldownRemaining(uid: string): Promise<number> {
  const snap = await getFirestore(getAdminApp()).collection('users').doc(uid).get()
  const sentAt = snap.data()?.verificationEmailSentAt
  if (!sentAt || typeof sentAt.toMillis !== 'function') return 0
  const elapsed = Date.now() - sentAt.toMillis()
  if (elapsed >= VERIFICATION_COOLDOWN_MS) return 0
  return VERIFICATION_COOLDOWN_MS - elapsed
}

export async function markVerificationEmailSent(uid: string): Promise<void> {
  await getFirestore(getAdminApp())
    .collection('users')
    .doc(uid)
    .set(
      {
        verificationEmailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
}

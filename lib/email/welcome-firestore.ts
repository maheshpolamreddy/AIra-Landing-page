import { firebaseConfig } from '@/lib/firebase/config'

type FirestoreDoc = {
  fields?: Record<string, { booleanValue?: boolean; stringValue?: string }>
}

function docUrl(uid: string): string {
  const projectId = firebaseConfig.projectId
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`
}

/**
 * Read welcomeEmailSent using the caller's Firebase ID token (rules: own doc).
 */
export async function hasWelcomeEmailBeenSent(
  uid: string,
  idToken: string,
): Promise<boolean> {
  const res = await fetch(docUrl(uid), {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store',
  })

  if (res.status === 404) return false
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to read user profile (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as FirestoreDoc
  return data.fields?.welcomeEmailSent?.booleanValue === true
}

/**
 * Mark welcome email as sent on the caller's own Firestore profile.
 */
export async function markWelcomeEmailSent(
  uid: string,
  idToken: string,
): Promise<void> {
  const url = `${docUrl(uid)}?updateMask.fieldPaths=welcomeEmailSent&updateMask.fieldPaths=welcomeEmailSentAt&updateMask.fieldPaths=updatedAt`
  const now = new Date().toISOString()

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        welcomeEmailSent: { booleanValue: true },
        welcomeEmailSentAt: { timestampValue: now },
        updatedAt: { timestampValue: now },
      },
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to mark welcome email sent (${res.status}): ${body.slice(0, 200)}`)
  }
}

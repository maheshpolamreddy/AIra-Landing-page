/**
 * Welcome-mail auth helpers that work without FIREBASE_SERVICE_ACCOUNT_JSON.
 * Uses Identity Toolkit + Firestore REST with the caller's ID token.
 */

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'aira-landingpage'

const API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
  'AIzaSyC9L2gJBJI_C0kCy2zVxMfiZqIGEjd-w1o'

/** Ignore stale claims older than this so failed sends can retry. */
const CLAIM_TTL_MS = 5 * 60 * 1000

export type VerifiedIdToken = {
  uid: string
  email?: string
  name?: string
}

export type WelcomeClaimResult =
  | { status: 'already_sent'; name: string | null }
  | { status: 'claimed'; name: string | null }
  | { status: 'in_flight'; name: string | null }

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

export async function verifyIdToken(idToken: string): Promise<VerifiedIdToken> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(API_KEY)}`,
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

async function getUserDoc(
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

async function createUserDoc(
  uid: string,
  idToken: string,
  email: string,
  name: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  const fields: Record<string, unknown> = {
    uid: { stringValue: uid },
    email: { stringValue: email },
    welcomeEmailPending: { booleanValue: true },
    createdAt: { timestampValue: now },
    updatedAt: { timestampValue: now },
  }
  if (name) {
    fields.name = { stringValue: name }
  }

  const res = await fetch(firestoreDocUrl(uid), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Firestore create failed (${res.status}): ${detail.slice(0, 160)}`)
  }
}

async function patchUserDoc(
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

export async function claimWelcomeEmailSend(
  uid: string,
  idToken: string,
  opts?: { email?: string; name?: string | null },
): Promise<WelcomeClaimResult> {
  let { fields, exists } = await getUserDoc(uid, idToken)
  const name = readStringField(fields, 'name') ?? opts?.name ?? null

  if (!exists) {
    const email = opts?.email?.trim().toLowerCase()
    if (!email) {
      throw new Error('User profile missing and no email on token')
    }
    await createUserDoc(uid, idToken, email, name)
    fields = {}
    exists = true
  }

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
  await patchUserDoc(
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

export async function markWelcomeEmailSent(uid: string, idToken: string): Promise<void> {
  const now = new Date().toISOString()
  await patchUserDoc(
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

export async function clearWelcomeEmailClaim(uid: string, idToken: string): Promise<void> {
  const now = new Date().toISOString()
  await patchUserDoc(
    uid,
    idToken,
    {
      updatedAt: { timestampValue: now },
    },
    ['welcomeEmailClaimedAt', 'updatedAt'],
  )
}

import { NextRequest } from 'next/server'
import { verifyIdToken } from '@/lib/firebase/admin'
import { getAdminFirestore } from '@/lib/content/firestore'

export type AuthResult =
  | { ok: true; uid: string; email?: string; role: 'student' | 'admin' }
  | { ok: false; status: number; error: string }

function getBridgeSecret(): string | null {
  const secret = process.env.CONTENT_BRIDGE_SECRET?.trim()
  return secret || null
}

export function bridgeOk(secret: string | null | undefined): boolean {
  const expected = getBridgeSecret()
  return Boolean(expected) && Boolean(secret) && secret === expected
}

async function getUserRole(uid: string): Promise<'student' | 'admin'> {
  try {
    const snap = await getAdminFirestore().collection('users').doc(uid).get()
    const role = snap.data()?.role
    return role === 'admin' ? 'admin' : 'student'
  } catch {
    return 'student'
  }
}

export async function requireAuth(req: NextRequest, adminOnly = false): Promise<AuthResult> {
  const bridge = req.headers.get('x-aira-content-bridge')
  if (bridgeOk(bridge)) {
    return { ok: true, uid: 'bridge', role: 'admin' }
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    return { ok: false, status: 401, error: 'Authentication required' }
  }

  try {
    const decoded = await verifyIdToken(token)
    const role = await getUserRole(decoded.uid)
    if (adminOnly && role !== 'admin') {
      return { ok: false, status: 403, error: 'Admin access required' }
    }
    return { ok: true, uid: decoded.uid, email: decoded.email, role }
  } catch {
    return { ok: false, status: 401, error: 'Invalid token' }
  }
}

export function firstNameFromProfile(name?: string | null): string {
  if (!name?.trim()) return 'there'
  return name.trim().split(/\s+/)[0] || 'there'
}

export function requireInngestSigningKey(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build' &&
    !process.env.INNGEST_SIGNING_KEY?.trim()
  ) {
    throw new Error('INNGEST_SIGNING_KEY is required in production')
  }
}

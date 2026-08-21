import { sendWelcomeEmail } from '@/lib/email/send-welcome'
import {
  getUserWelcomeState,
  markWelcomeEmailSent,
  verifyIdToken,
} from '@/lib/firebase/admin'

export const runtime = 'nodejs'

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) {
    return Response.json({ ok: false, error: 'Missing bearer token' }, { status: 401 })
  }

  let body: { name?: string } = {}
  try {
    body = (await request.json()) as { name?: string }
  } catch {
    body = {}
  }

  let decoded: Awaited<ReturnType<typeof verifyIdToken>>
  try {
    decoded = await verifyIdToken(token)
  } catch (err) {
    console.warn('[welcome] invalid id token', err instanceof Error ? err.message : 'unknown')
    return Response.json({ ok: false, error: 'Invalid token' }, { status: 401 })
  }

  const email = decoded.email?.trim().toLowerCase()
  if (!email) {
    return Response.json({ ok: false, error: 'Token has no email' }, { status: 400 })
  }

  try {
    const state = await getUserWelcomeState(decoded.uid)
    if (state.welcomeEmailSent) {
      return Response.json({ ok: true, skipped: true })
    }

    const name =
      (typeof body.name === 'string' && body.name.trim()) ||
      state.name ||
      decoded.name ||
      email.split('@')[0] ||
      'there'

    await sendWelcomeEmail({ to: email, name })
    await markWelcomeEmailSent(decoded.uid)

    console.info('[welcome] sent', {
      uid: decoded.uid,
      email: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
    })

    return Response.json({ ok: true, sent: true })
  } catch (err) {
    console.error('[welcome] failed', {
      uid: decoded.uid,
      error: err instanceof Error ? err.message : 'unknown',
    })
    // Do not fail signup UX — client treats this as best-effort.
    return Response.json(
      { ok: false, error: 'Unable to send welcome email' },
      { status: 502 },
    )
  }
}

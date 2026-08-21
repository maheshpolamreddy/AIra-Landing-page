import { sendWelcomeEmail } from '@/lib/email/send-welcome'
import {
  claimWelcomeEmailSend,
  clearWelcomeEmailClaim,
  markWelcomeEmailSent,
  verifyIdToken,
} from '@/lib/firebase/welcome-server'

export const runtime = 'nodejs'

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

export async function POST(request: Request) {
  try {
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

    let claim: Awaited<ReturnType<typeof claimWelcomeEmailSend>>
    try {
      claim = await claimWelcomeEmailSend(decoded.uid, token)
    } catch (err) {
      console.error('[welcome] claim failed', {
        uid: decoded.uid,
        error: err instanceof Error ? err.message : 'unknown',
      })
      return Response.json(
        { ok: false, error: 'Unable to claim welcome email' },
        { status: 502 },
      )
    }

    if (claim.status === 'already_sent') {
      return Response.json({ ok: true, skipped: true })
    }
    if (claim.status === 'in_flight') {
      return Response.json({ ok: true, skipped: true, reason: 'in_flight' })
    }

    const name =
      (typeof body.name === 'string' && body.name.trim()) ||
      claim.name ||
      decoded.name ||
      email.split('@')[0] ||
      'there'

    try {
      await sendWelcomeEmail({ to: email, name })
      await markWelcomeEmailSent(decoded.uid, token)

      console.info('[welcome] sent', {
        uid: decoded.uid,
        email: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      })

      return Response.json({ ok: true, sent: true })
    } catch (err) {
      try {
        await clearWelcomeEmailClaim(decoded.uid, token)
      } catch (clearErr) {
        console.warn(
          '[welcome] clear claim failed',
          clearErr instanceof Error ? clearErr.message : 'unknown',
        )
      }
      console.error('[welcome] failed', {
        uid: decoded.uid,
        error: err instanceof Error ? err.message : 'unknown',
      })
      return Response.json(
        { ok: false, error: 'Unable to send welcome email' },
        { status: 502 },
      )
    }
  } catch (err) {
    console.error('[welcome] unhandled', err instanceof Error ? err.message : 'unknown')
    return Response.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

import { sendWelcomeEmail, isSmtpConfigured } from '@/lib/email/send-welcome'
import { verifyFirebaseIdToken } from '@/lib/email/verify-id-token'
import {
  hasWelcomeEmailBeenSent,
  markWelcomeEmailSent,
} from '@/lib/email/welcome-firestore'

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

/**
 * First-time welcome email.
 * Requires Authorization: Bearer <Firebase ID token>.
 * Idempotent via Firestore `welcomeEmailSent`.
 */
export async function POST(request: Request) {
  const idToken = bearerToken(request)
  if (!idToken) {
    return Response.json({ ok: false, error: 'Missing auth token' }, { status: 401 })
  }

  let bodyName: string | undefined
  try {
    const body = (await request.json()) as { name?: unknown }
    if (typeof body?.name === 'string' && body.name.trim()) {
      bodyName = body.name.trim()
    }
  } catch {
    // Body is optional
  }

  let verified
  try {
    verified = await verifyFirebaseIdToken(idToken)
  } catch (err) {
    console.error('[welcome] token verify error', err)
    return Response.json({ ok: false, error: 'Unable to verify session' }, { status: 401 })
  }

  if (!verified) {
    return Response.json({ ok: false, error: 'Invalid session' }, { status: 401 })
  }

  const email = verified.email?.trim()
  if (!email) {
    return Response.json(
      { ok: false, error: 'Account has no email address' },
      { status: 400 },
    )
  }

  try {
    const alreadySent = await hasWelcomeEmailBeenSent(verified.uid, idToken)
    if (alreadySent) {
      return Response.json({ ok: true, skipped: true, reason: 'already_sent' })
    }
  } catch (err) {
    console.error('[welcome] firestore read failed', err)
    // Continue — better to risk a rare duplicate than block signup UX entirely
  }

  if (!isSmtpConfigured()) {
    console.warn('[welcome] SMTP not configured; skipping send')
    return Response.json({
      ok: false,
      skipped: true,
      reason: 'smtp_not_configured',
    })
  }

  const name =
    bodyName ||
    verified.name ||
    email.split('@')[0] ||
    'Learner'

  const result = await sendWelcomeEmail({ to: email, name })
  if (!result.ok) {
    // Soft failure so signup/login UI is never blocked
    return Response.json({
      ok: false,
      sent: false,
      error: result.error,
      configured: result.configured,
    })
  }

  try {
    await markWelcomeEmailSent(verified.uid, idToken)
  } catch (err) {
    console.error('[welcome] failed to mark welcomeEmailSent', err)
    // Mail already went out — report success so client does not retry forever
    return Response.json({
      ok: true,
      sent: true,
      marked: false,
      messageId: result.messageId,
    })
  }

  console.info('[welcome] sent', {
    uid: verified.uid,
    email: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
    messageId: result.messageId,
  })

  return Response.json({
    ok: true,
    sent: true,
    marked: true,
    messageId: result.messageId,
  })
}

import { isEmailConfigured } from '@/lib/email/send-transactional'
import { sendVerificationEmail } from '@/lib/email/send-verification'
import { verifyIdToken } from '@/lib/firebase/welcome-server'

export const runtime = 'nodejs'

const PROD_LANDING = 'https://aira-landing-page-elite.vercel.app'

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

function continueUrl(request: Request): string {
  const origin =
    request.headers.get('origin')?.trim() ||
    request.headers.get('x-forwarded-host')?.trim()
  if (origin) {
    const scheme = request.headers.get('x-forwarded-proto') || 'https'
    const host = origin.replace(/^https?:\/\//, '')
    return `${scheme}://${host}/login?verified=1`
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '')
  return `${site || PROD_LANDING}/login?verified=1`
}

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) {
    return Response.json(
      { ok: false, error: 'Missing bearer token', code: 'missing_token' },
      { status: 401 },
    )
  }

  try {
    const admin = await import('@/lib/firebase/verification-admin')

    if (!admin.isVerificationAdminConfigured()) {
      return Response.json(
        { ok: false, error: 'Admin credentials not configured', code: 'admin_not_configured' },
        { status: 503 },
      )
    }
    if (!isEmailConfigured()) {
      return Response.json(
        { ok: false, error: 'Email provider not configured', code: 'not_configured' },
        { status: 503 },
      )
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
      console.warn('[verify-email] invalid token', err instanceof Error ? err.message : 'unknown')
      return Response.json(
        { ok: false, error: 'Invalid token', code: 'invalid_token' },
        { status: 401 },
      )
    }

    const email = decoded.email?.trim().toLowerCase()
    if (!email) {
      return Response.json(
        { ok: false, error: 'Token has no email', code: 'no_email' },
        { status: 400 },
      )
    }

    const cooldownMs = await admin.verificationCooldownRemaining(decoded.uid)
    if (cooldownMs > 0) {
      return Response.json(
        {
          ok: false,
          error: 'Please wait before requesting another verification email',
          code: 'rate_limited',
          retryAfterSec: Math.ceil(cooldownMs / 1000),
        },
        { status: 429 },
      )
    }

    const name =
      (typeof body.name === 'string' && body.name.trim()) ||
      decoded.name ||
      email.split('@')[0] ||
      'there'

    const verifyUrl = await admin.generateVerificationLink(email, continueUrl(request))
    await sendVerificationEmail({ to: email, name, verifyUrl })
    await admin.markVerificationEmailSent(decoded.uid)

    console.info('[verify-email] sent', {
      uid: decoded.uid,
      email: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
    })

    return Response.json({ ok: true, sent: true, code: 'sent' })
  } catch (err) {
    console.error('[verify-email] failed', err instanceof Error ? err.message : 'unknown')
    return Response.json(
      { ok: false, error: 'Unable to send verification email', code: 'send_failed' },
      { status: 502 },
    )
  }
}

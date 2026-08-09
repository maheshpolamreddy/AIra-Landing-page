import nodemailer from 'nodemailer'
import { buildWelcomeEmail } from '@/lib/email/welcome-template'

export type SendWelcomeResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; configured: boolean }

function cleanEnv(value: string | undefined): string {
  const raw = value?.trim() || ''
  // Vercel / dotenv sometimes wraps values in quotes
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim()
  }
  return raw
}

function smtpConfig() {
  const host = cleanEnv(process.env.SMTP_HOST) || 'smtp.gmail.com'
  const port = Number(cleanEnv(process.env.SMTP_PORT) || '465')
  const user = cleanEnv(process.env.SMTP_USER)
  const pass = cleanEnv(process.env.SMTP_PASS)
  const from = cleanEnv(process.env.SMTP_FROM) || (user ? `AIra <${user}>` : '')

  return { host, port, user, pass, from }
}

export function isSmtpConfigured(): boolean {
  const { user, pass, from } = smtpConfig()
  return Boolean(user && pass && from)
}

export async function sendWelcomeEmail(options: {
  to: string
  name: string
}): Promise<SendWelcomeResult> {
  const { host, port, user, pass, from } = smtpConfig()
  if (!user || !pass || !from) {
    return {
      ok: false,
      configured: false,
      error: 'SMTP is not configured (SMTP_USER / SMTP_PASS / SMTP_FROM).',
    }
  }

  const to = options.to.trim()
  if (!to) {
    return { ok: false, configured: true, error: 'Missing recipient email.' }
  }

  const content = buildWelcomeEmail(options.name)
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
      replyTo: user,
    })
    return { ok: true, messageId: info.messageId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP send failed'
    console.error('[welcome-email] send failed', message)
    return { ok: false, configured: true, error: message }
  }
}

import nodemailer from 'nodemailer'

export type TransactionalEmailInput = {
  to: string
  subject: string
  html: string
  text: string
}

export type EmailProvider = 'resend' | 'smtp' | 'none'

function cleanFromAddress(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function resolveEmailFrom(): string {
  return cleanFromAddress(
    process.env.EMAIL_FROM?.trim() ||
      process.env.SMTP_FROM?.trim() ||
      `AIra <${process.env.SMTP_USER?.trim() || 'onboarding@resend.dev'}>`,
  )
}

export function resolveEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY?.trim()) return 'resend'
  if (process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()) return 'smtp'
  return 'none'
}

export function isEmailConfigured(): boolean {
  return resolveEmailProvider() !== 'none'
}

async function sendViaResend(input: TransactionalEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const from = resolveEmailFrom()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Resend failed (${res.status}): ${detail.slice(0, 200)}`)
    }
  } finally {
    clearTimeout(timer)
  }
}

function createSmtpTransport(port: number) {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS are required for SMTP delivery')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    family: 4,
  } as nodemailer.TransportOptions)
}

async function sendViaSmtp(input: TransactionalEmailInput): Promise<void> {
  const from = resolveEmailFrom()
  const configuredPort = Number(process.env.SMTP_PORT?.trim() || '465')
  const ports =
    configuredPort === 587 ? [587, 465] : configuredPort === 465 ? [465, 587] : [configuredPort, 587, 465]

  let lastError: unknown
  for (const port of ports) {
    try {
      const transport = createSmtpTransport(port)
      await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      })
      return
    } catch (err) {
      lastError = err
      console.warn(
        '[email] SMTP send failed on port',
        port,
        err instanceof Error ? err.message : 'unknown',
      )
    }
  }

  throw lastError instanceof Error ? lastError : new Error('SMTP send failed')
}

/** Send transactional mail via Resend (preferred) or SMTP fallback. */
export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<void> {
  const to = input.to.trim().toLowerCase()
  if (!to || !to.includes('@')) {
    throw new Error('Invalid recipient email')
  }

  const provider = resolveEmailProvider()
  if (provider === 'none') {
    throw new Error('No email provider configured (set RESEND_API_KEY or SMTP_*)')
  }

  if (provider === 'resend') {
    try {
      await sendViaResend(input)
      return
    } catch (err) {
      if (process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim()) {
        console.warn(
          '[email] Resend failed; falling back to SMTP',
          err instanceof Error ? err.message : 'unknown',
        )
        await sendViaSmtp(input)
        return
      }
      throw err
    }
  }

  await sendViaSmtp(input)
}

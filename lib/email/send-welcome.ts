import nodemailer from 'nodemailer'
import { buildWelcomeEmail } from '@/lib/email/welcome-template'

export type SendWelcomeInput = {
  to: string
  name: string
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

/** Strip accidental wrapping quotes from env values pasted from docs. */
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

function createTransport(port: number) {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const user = requireEnv('SMTP_USER')
  const pass = requireEnv('SMTP_PASS')

  return nodemailer.createTransport({
    host,
    port,
    // 465 = implicit TLS; 587 = STARTTLS (often more reliable on serverless).
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
    // Prefer IPv4 — some hosts hang resolving IPv6 first.
    family: 4,
  } as nodemailer.TransportOptions)
}

export async function sendWelcomeEmail(input: SendWelcomeInput): Promise<void> {
  const to = input.to.trim().toLowerCase()
  if (!to || !to.includes('@')) {
    throw new Error('Invalid recipient email')
  }

  const from = cleanFromAddress(
    process.env.SMTP_FROM?.trim() ||
      `AIra <${process.env.SMTP_USER?.trim() || 'airaaitutor@gmail.com'}>`,
  )

  const template = buildWelcomeEmail({ name: input.name })
  const configuredPort = Number(process.env.SMTP_PORT?.trim() || '465')
  // Try configured port first, then the alternate Gmail port if it fails to connect.
  const ports =
    configuredPort === 587 ? [587, 465] : configuredPort === 465 ? [465, 587] : [configuredPort, 587, 465]

  let lastError: unknown
  for (const port of ports) {
    try {
      const transport = createTransport(port)
      await transport.sendMail({
        from,
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
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

import nodemailer from 'nodemailer'

export type TransactionalEmailInput = {
  to: string
  subject: string
  html: string
  text: string
}

export type EmailProvider = 'resend' | 'smtp' | 'none'

export type EmailDeliveryReport = {
  provider: EmailProvider
  messageId?: string
  usedFallback?: boolean
}

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

/** Resend's onboarding@resend.dev can only deliver to the Resend account owner. */
export function isResendSandboxFrom(from = resolveEmailFrom()): boolean {
  return /@resend\.dev\b/i.test(from)
}

export function hasResendConfig(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export function hasSmtpConfig(): boolean {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim())
}

/**
 * Prefer SMTP when Resend cannot reliably send as EMAIL_FROM
 * (sandbox resend.dev, or consumer Gmail addresses without a Resend domain).
 * Prefer Resend when From looks like a custom verified domain (works on Vercel).
 */
export function resolveEmailProvider(): EmailProvider {
  const resend = hasResendConfig()
  const smtp = hasSmtpConfig()
  const from = resolveEmailFrom()
  const resendCanSendAsFrom =
    resend &&
    !isResendSandboxFrom(from) &&
    !/@gmail\.com\b/i.test(from) &&
    !/@googlemail\.com\b/i.test(from)

  if (resendCanSendAsFrom) return 'resend'
  if (smtp) return 'smtp'
  if (resend) return 'resend'
  return 'none'
}

export function isEmailConfigured(): boolean {
  return resolveEmailProvider() !== 'none'
}

/** Safe diagnostics for health endpoints (no secrets). */
export function getEmailDiagnostics() {
  const from = resolveEmailFrom()
  const provider = resolveEmailProvider()
  const sandboxFrom = isResendSandboxFrom(from)
  return {
    configured: provider !== 'none',
    provider,
    from,
    sandboxFrom,
    resendConfigured: hasResendConfig(),
    smtpConfigured: hasSmtpConfig(),
    /** False when only Resend sandbox is available — external inboxes will not receive mail. */
    canDeliverExternally: provider === 'smtp' || (provider === 'resend' && !sandboxFrom),
    warning: !hasSmtpConfig() && (isResendSandboxFrom(from) || /@gmail\.com\b/i.test(from))
      ? 'EMAIL_FROM is not a Resend-verified custom domain and SMTP is unset — external delivery will fail. Set SMTP_* or verify a domain in Resend.'
      : provider === 'smtp'
        ? 'Using SMTP for delivery (recommended when EMAIL_FROM is Gmail or Resend sandbox).'
        : null,
  }
}

async function sendViaResend(input: TransactionalEmailInput): Promise<string> {
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

    const detail = await res.text().catch(() => '')
    if (!res.ok) {
      throw new Error(`Resend failed (${res.status}): ${detail.slice(0, 300)}`)
    }

    let messageId: string | undefined
    try {
      const parsed = JSON.parse(detail) as { id?: string }
      messageId = typeof parsed.id === 'string' ? parsed.id : undefined
    } catch {
      /* non-JSON success body */
    }
    if (!messageId) {
      throw new Error('Resend returned success without a message id')
    }
    return messageId
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

async function sendViaSmtp(input: TransactionalEmailInput): Promise<string> {
  const from = resolveEmailFrom()
  // Prefer Gmail address as From when EMAIL_FROM is still Resend sandbox
  const effectiveFrom = isResendSandboxFrom(from)
    ? cleanFromAddress(
        process.env.SMTP_FROM?.trim() ||
          `AIra <${process.env.SMTP_USER!.trim()}>`,
      )
    : from

  const configuredPort = Number(process.env.SMTP_PORT?.trim() || '465')
  const ports =
    configuredPort === 587
      ? [587, 465]
      : configuredPort === 465
        ? [465, 587]
        : [configuredPort, 587, 465]

  let lastError: unknown
  for (const port of ports) {
    try {
      const transport = createSmtpTransport(port)
      const info = await transport.sendMail({
        from: effectiveFrom,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      })
      return info.messageId || `smtp:${port}:${Date.now()}`
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

function isResendTestingRestriction(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /only send testing emails|verify a domain|validation_error|403/i.test(msg)
}

/** Send transactional mail via Resend (preferred for verified domains) or SMTP. */
export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<EmailDeliveryReport> {
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
      const messageId = await sendViaResend(input)
      return { provider: 'resend', messageId }
    } catch (err) {
      if (hasSmtpConfig()) {
        console.warn(
          '[email] Resend failed; falling back to SMTP',
          err instanceof Error ? err.message : 'unknown',
        )
        const messageId = await sendViaSmtp(input)
        return { provider: 'smtp', messageId, usedFallback: true }
      }
      if (isResendTestingRestriction(err) || isResendSandboxFrom()) {
        throw new Error(
          'Resend sandbox cannot deliver to this inbox. Verify a custom domain in Resend and set EMAIL_FROM, or configure SMTP_USER/SMTP_PASS.',
        )
      }
      throw err
    }
  }

  // Primary SMTP (also used when Resend From is sandbox)
  try {
    const messageId = await sendViaSmtp(input)
    return { provider: 'smtp', messageId }
  } catch (smtpErr) {
    // Last resort: Resend even with sandbox (may only reach account owner)
    if (hasResendConfig()) {
      console.warn(
        '[email] SMTP failed; attempting Resend',
        smtpErr instanceof Error ? smtpErr.message : 'unknown',
      )
      try {
        const messageId = await sendViaResend(input)
        return { provider: 'resend', messageId, usedFallback: true }
      } catch (resendErr) {
        throw new Error(
          `Email delivery failed via SMTP and Resend. SMTP: ${
            smtpErr instanceof Error ? smtpErr.message : 'unknown'
          }; Resend: ${resendErr instanceof Error ? resendErr.message : 'unknown'}`,
        )
      }
    }
    throw smtpErr
  }
}

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

function createTransport() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT?.trim() || '465')
  const user = requireEnv('SMTP_USER')
  const pass = requireEnv('SMTP_PASS')

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendWelcomeEmail(input: SendWelcomeInput): Promise<void> {
  const to = input.to.trim().toLowerCase()
  if (!to || !to.includes('@')) {
    throw new Error('Invalid recipient email')
  }

  const from =
    process.env.SMTP_FROM?.trim() ||
    `"AIra <${process.env.SMTP_USER?.trim() || 'airaaitutor@gmail.com'}>"`

  const template = buildWelcomeEmail({ name: input.name })
  const transport = createTransport()

  await transport.sendMail({
    from,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
}

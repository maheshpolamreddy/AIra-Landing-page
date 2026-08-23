/**
 * Verify SMTP credentials from .env.local (does not print secrets).
 */
import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (process.env[m[1]] == null || process.env[m[1]] === '') {
      process.env[m[1]] = v
    }
  }
}

loadEnvLocal()

const user = process.env.SMTP_USER?.trim()
const pass = process.env.SMTP_PASS?.trim()
const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
const port = Number(process.env.SMTP_PORT?.trim() || '465')
const from = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim() || user

console.log('SMTP_USER set:', Boolean(user), 'len', user?.length ?? 0)
console.log('SMTP_PASS set:', Boolean(pass), 'len', pass?.length ?? 0)
console.log('HOST', host, 'PORT', port)
console.log('FROM', from)
console.log('RESEND set:', Boolean(process.env.RESEND_API_KEY?.trim()))

if (!user || !pass) {
  console.error('SMTP credentials missing')
  process.exit(1)
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user, pass },
  connectionTimeout: 12_000,
  greetingTimeout: 12_000,
  socketTimeout: 20_000,
  family: 4,
})

try {
  await transport.verify()
  console.log('SMTP verify: OK')
} catch (err) {
  console.error('SMTP verify FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
}

const to = process.argv[2]?.trim()
if (to) {
  try {
    const info = await transport.sendMail({
      from,
      to,
      subject: 'AIra SMTP delivery probe',
      text: 'If you received this, SMTP delivery is working.',
    })
    console.log('SMTP send OK messageId:', info.messageId)
  } catch (err) {
    console.error('SMTP send FAILED:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

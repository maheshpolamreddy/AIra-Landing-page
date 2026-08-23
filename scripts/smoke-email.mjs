import { readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'

execSync('npx vercel env pull .env.vercel.test --environment production --yes', {
  stdio: 'inherit',
})

const dotenv = readFileSync('.env.vercel.test', 'utf8')

function getEnv(key) {
  const line = dotenv.split('\n').find((l) => l.startsWith(`${key}=`))
  if (!line) return null
  let v = line.slice(key.length + 1).trim().replace(/\r$/, '')
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  return v || null
}

const key = getEnv('RESEND_API_KEY')
const from = getEnv('EMAIL_FROM') ?? 'AIra <onboarding@resend.dev>'
const adminLen = getEnv('FIREBASE_SERVICE_ACCOUNT_JSON')?.length ?? 0

console.log('=== Production email config ===')
console.log('RESEND_API_KEY:', key ? `present (${key.length} chars)` : 'MISSING')
console.log('EMAIL_FROM:', from)
console.log('FIREBASE_SERVICE_ACCOUNT_JSON:', adminLen ? `present (${adminLen} chars)` : 'MISSING')

if (!key) {
  console.error('Cannot test Resend without API key')
  process.exit(1)
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from,
    to: ['delivered@resend.dev'],
    subject: 'AIra Resend smoke test',
    html: '<p>Production Resend credentials can send mail.</p>',
    text: 'Production Resend credentials can send mail.',
  }),
})

const body = await res.text()
console.log('\n=== Resend send test (delivered@resend.dev) ===')
console.log('Status:', res.status)
console.log('Response:', body.slice(0, 400))

unlinkSync('.env.vercel.test')

if (!res.ok) {
  console.error('\nResend send FAILED — check API key and EMAIL_FROM domain.')
  process.exit(1)
}

console.log('\nResend send OK — transactional delivery path works.')

/**
 * Temporary diagnostic — prints GA4 error category/body (no secrets).
 */
import { readFileSync, existsSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

function parseSa(raw) {
  if (!raw?.trim()) return null
  let value = raw.trim()
  for (let i = 0; i < 4; i++) {
    if (typeof value !== 'string') break
    let t = value.trim()
    if (t.startsWith("'") && t.endsWith("'")) {
      value = t.slice(1, -1)
      continue
    }
    try {
      const parsed = JSON.parse(t)
      if (typeof parsed === 'string') {
        value = parsed
        continue
      }
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      const start = t.indexOf('{')
      const end = t.lastIndexOf('}')
      if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1))
      throw e
    }
  }
  throw new Error('parse_failed')
}

const env = { ...loadEnvFile('.env.local'), ...process.env }
const propertyId = String(env.GA4_PROPERTY_ID || '').replace(/^properties\//, '').trim()
const sa = parseSa(env.FIREBASE_SERVICE_ACCOUNT_JSON)

console.log('propertyId=', propertyId)
console.log('client_email=', sa?.client_email)
console.log('using_inline_sa=', Boolean(sa))

const auth = new GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
})
const client = await auth.getClient()
const token = await client.getAccessToken()
console.log('token_ok=', Boolean(token.token))

const res = await fetch(
  `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'eventCount' }],
    }),
  },
)

const body = await res.text()
console.log('http_status=', res.status)
console.log('body=', body.slice(0, 800))

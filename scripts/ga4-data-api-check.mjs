/**
 * Safe GA4 Data API connectivity check.
 * Prints: property id, whether SA is present, client_email only, API result category.
 * Never prints private keys.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { GoogleAuth } from 'google-auth-library'

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    out[k] = v
  }
  return out
}

function parseSa(raw) {
  if (!raw?.trim()) return null
  let value = raw.trim()
  if (value.startsWith('"')) {
    try {
      const unwrapped = JSON.parse(value)
      if (typeof unwrapped === 'string') value = unwrapped.trim()
    } catch {
      /* keep */
    }
  }
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start >= 0 && end > start) value = value.slice(start, end + 1)
  return JSON.parse(value)
}

const root = process.cwd()
const env = {
  ...loadEnvFile(resolve(root, '.env')),
  ...loadEnvFile(resolve(root, '.env.local')),
  ...process.env,
}

const propertyId = String(env.GA4_PROPERTY_ID || '').replace(/^properties\//, '').trim()
const sa = parseSa(env.FIREBASE_SERVICE_ACCOUNT_JSON)
const adcPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim()

console.log('GA4_PROPERTY_ID:', propertyId || 'MISSING')
console.log('FIREBASE_SERVICE_ACCOUNT_JSON:', sa ? 'present' : 'MISSING')
console.log('GOOGLE_APPLICATION_CREDENTIALS:', adcPath ? 'set' : 'not set')
if (sa?.client_email) console.log('service_account_email:', sa.client_email)
if (sa?.project_id) console.log('service_account_project:', sa.project_id)

if (!propertyId) {
  console.log('RESULT: NOT_CONFIGURED (missing GA4_PROPERTY_ID)')
  process.exit(2)
}

if (!sa && !adcPath) {
  console.log('RESULT: NOT_CONFIGURED (missing service account credentials)')
  console.log(
    'ACTION: Add FIREBASE_SERVICE_ACCOUNT_JSON to Landing .env.local, then grant Analytics Viewer on GA4 property',
    propertyId,
  )
  process.exit(2)
}

const auth = new GoogleAuth({
  credentials: sa || undefined,
  keyFile: sa ? undefined : adcPath,
  scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
})

try {
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) throw new Error('token_failed')

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
        metrics: [{ name: 'activeUsers' }, { name: 'eventCount' }],
      }),
    },
  )

  if (res.status === 403 || res.status === 401) {
    const body = (await res.text()).slice(0, 240)
    console.log('RESULT: PERMISSION_DENIED', res.status)
    console.log('detail_category:', body.includes('PERMISSION_DENIED') ? 'PERMISSION_DENIED' : 'auth_error')
    console.log(
      'ACTION: Google Analytics → Admin → Property access management → Add',
      sa?.client_email || 'service account',
      'with role Analytics Viewer on property',
      propertyId,
    )
    process.exit(3)
  }

  if (!res.ok) {
    console.log('RESULT: API_ERROR', res.status)
    console.log('detail_category:', `ga4_${res.status}`)
    process.exit(4)
  }

  const json = await res.json()
  const activeUsers = Number(json.rows?.[0]?.metricValues?.[0]?.value ?? json.totals?.[0]?.metricValues?.[0]?.value ?? 0)
  const eventCount = Number(json.rows?.[0]?.metricValues?.[1]?.value ?? json.totals?.[0]?.metricValues?.[1]?.value ?? 0)
  console.log('RESULT: OK')
  console.log('activeUsers_7d:', Number.isFinite(activeUsers) ? activeUsers : 0)
  console.log('eventCount_7d:', Number.isFinite(eventCount) ? eventCount : 0)
  process.exit(0)
} catch (err) {
  console.log('RESULT: FAILED')
  console.log('error_category:', err instanceof Error ? err.name || 'Error' : 'unknown')
  process.exit(1)
}

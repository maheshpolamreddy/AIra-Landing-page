/**
 * Attempt to enable analyticsdata.googleapis.com (no secrets printed).
 */
import { readFileSync, existsSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

function loadEnv(path) {
  const o = {}
  if (!existsSync(path)) return o
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    o[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return o
}

function parseSa(raw) {
  let v = raw.trim()
  if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1)
  let p = JSON.parse(v)
  if (typeof p === 'string') p = JSON.parse(p)
  return p
}

const env = loadEnv('.env.local')
const sa = parseSa(env.FIREBASE_SERVICE_ACCOUNT_JSON)
const projectNumber = '993289285952'

const auth = new GoogleAuth({
  credentials: sa,
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/service.management',
  ],
})
const client = await auth.getClient()
const token = (await client.getAccessToken()).token

const res = await fetch(
  `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services/analyticsdata.googleapis.com:enable`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  },
)
const body = await res.text()
console.log('enable_status=', res.status)
console.log('enable_body=', body.slice(0, 600))

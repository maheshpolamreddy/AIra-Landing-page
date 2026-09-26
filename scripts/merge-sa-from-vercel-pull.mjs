/**
 * Pull SA email + merge FIREBASE_SERVICE_ACCOUNT_JSON into .env.local from .env.vercel.ga4
 * Never logs private_key.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'

function parseEnvValue(raw) {
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

const pullPath = '.env.vercel.ga4'
if (!existsSync(pullPath)) {
  console.log('MISSING_PULL_FILE')
  process.exit(1)
}

const pulled = readFileSync(pullPath, 'utf8')
const m = pulled.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.+)/)
if (!m) {
  console.log('SA_NOT_IN_PULL')
  process.exit(1)
}

const sa = parseEnvValue(m[1])
console.log('client_email=', sa.client_email || 'n/a')
console.log('project_id=', sa.project_id || 'n/a')

const localPath = '.env.local'
const local = existsSync(localPath) ? readFileSync(localPath, 'utf8') : ''
if (/FIREBASE_SERVICE_ACCOUNT_JSON=/.test(local)) {
  console.log('MERGED=already_present')
} else {
  appendFileSync(
    localPath,
    `\n# Pulled for local GA4 Data API (do not commit)\nFIREBASE_SERVICE_ACCOUNT_JSON=${JSON.stringify(JSON.stringify(sa))}\n`,
  )
  console.log('MERGED=yes')
}

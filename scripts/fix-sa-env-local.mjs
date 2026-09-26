/**
 * Rewrite FIREBASE_SERVICE_ACCOUNT_JSON for Next.js dotenv:
 * FIREBASE_SERVICE_ACCOUNT_JSON='{...one line json...}'
 * Never prints private_key.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

function parseSa(raw) {
  let value = raw.trim()
  for (let i = 0; i < 4; i++) {
    if (typeof value !== 'string') break
    const t = value.trim()
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
      throw new Error('parse_failed')
    }
  }
  throw new Error('parse_failed')
}

const path = '.env.local'
const lines = readFileSync(path, 'utf8').split(/\r?\n/)
let found = false
const out = lines.map((line) => {
  if (!line.startsWith('FIREBASE_SERVICE_ACCOUNT_JSON=')) return line
  found = true
  const sa = parseSa(line.slice('FIREBASE_SERVICE_ACCOUNT_JSON='.length))
  console.log('client_email=', sa.client_email)
  // Single-quoted JSON so dotenv keeps escapes intact
  const json = JSON.stringify(sa)
  return `FIREBASE_SERVICE_ACCOUNT_JSON='${json.replace(/'/g, "\\'")}'`
})
if (!found) {
  console.log('NO_SA_LINE')
  process.exit(2)
}
writeFileSync(path, out.join('\n') + '\n')
console.log('REWRITTEN=single_quoted_json')

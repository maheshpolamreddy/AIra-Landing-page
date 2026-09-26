import { readFileSync, existsSync } from 'node:fs'

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

const env = loadEnvFile('.env.local')
const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || ''
console.log('len=', raw.length)
console.log('startsWith=', JSON.stringify(raw.slice(0, 3)))

function tryParse(label, value) {
  try {
    const v = JSON.parse(value)
    if (v && typeof v === 'object') {
      console.log(label, 'object', 'email=', v.client_email)
      return v
    }
    console.log(label, typeof v, typeof v === 'string' ? 'str_len=' + v.length : '')
    return v
  } catch (e) {
    console.log(label, 'FAIL', String(e.message).slice(0, 100))
    return null
  }
}

let v = tryParse('parse1', raw)
if (typeof v === 'string') v = tryParse('parse2', v)
if (!(v && typeof v === 'object')) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  console.log('brace', start, end)
  if (start >= 0) tryParse('slice', raw.slice(start, end + 1))
}

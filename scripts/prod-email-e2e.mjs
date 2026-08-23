/**
 * Production email send test — creates a throwaway Firebase user and hits both mail APIs.
 * Does not print secrets. Safe to run locally (uses public Firebase web API key).
 */
const API_KEY = 'AIzaSyC9L2gJBJI_C0kCy2zVxMfiZqIGEjd-w1o'
const BASE = 'https://aira-landing-page-elite.vercel.app'
const ts = Date.now()
const email = `aira-mail-test-${ts}@example.com`
const password = `TestPass!${ts}`
const name = 'Email Test'

async function firebaseSignUp() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const body = await res.json()
  if (!res.ok) {
    throw new Error(`Firebase signUp ${res.status}: ${body.error?.message || JSON.stringify(body)}`)
  }
  return { idToken: body.idToken, localId: body.localId }
}

async function postApi(path, idToken) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Origin: BASE,
    },
    body: JSON.stringify({ name }),
  })
  const text = await res.text()
  let json = {}
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 300) }
  }
  return { status: res.status, json }
}

console.log('=== AIra production email E2E ===')
console.log('Test email:', email)

const { idToken, localId } = await firebaseSignUp()
console.log('Firebase user created:', localId)

const verify = await postApi('/api/auth/send-verification', idToken)
console.log('\nVerification API:', verify.status, JSON.stringify(verify.json))

const welcome = await postApi('/api/welcome', idToken)
console.log('Welcome API:', welcome.status, JSON.stringify(welcome.json))

const verify2 = await postApi('/api/auth/send-verification', idToken)
console.log('Verification retry (expect rate limit or skip):', verify2.status, JSON.stringify(verify2.json))

const welcome2 = await postApi('/api/welcome', idToken)
console.log('Welcome retry (expect already_sent):', welcome2.status, JSON.stringify(welcome2.json))

const verifyOk = verify.status === 200 && verify.json.sent === true
const welcomeOk = welcome.status === 200 && welcome.json.sent === true

console.log('\n=== Result ===')
console.log('Verification send:', verifyOk ? 'OK' : 'FAILED')
console.log('Welcome send:', welcomeOk ? 'OK' : 'FAILED')

if (!verifyOk || !welcomeOk) {
  process.exit(1)
}

console.log('Both transactional emails accepted by production APIs.')

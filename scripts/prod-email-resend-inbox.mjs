/**
 * Resend-compatible production test — uses delivered@resend.dev (Resend sandbox inbox).
 */
const API_KEY = 'AIzaSyC9L2gJBJI_C0kCy2zVxMfiZqIGEjd-w1o'
const BASE = 'https://aira-landing-page-elite.vercel.app'
const email = 'delivered@resend.dev'
const password = 'AiraResendTest!2026'
const name = 'Resend Test'

async function getIdToken() {
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const signUpBody = await signUp.json()
  if (signUp.ok) return signUpBody.idToken

  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const signInBody = await signIn.json()
  if (!signIn.ok) {
    throw new Error(signInBody.error?.message || 'auth failed')
  }
  return signInBody.idToken
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
  return { status: res.status, json: await res.json() }
}

console.log('=== Resend inbox test (delivered@resend.dev) ===')
const idToken = await getIdToken()

const verify = await postApi('/api/auth/send-verification', idToken)
console.log('Verification:', verify.status, JSON.stringify(verify.json))

const welcome = await postApi('/api/welcome', idToken)
console.log('Welcome:', welcome.status, JSON.stringify(welcome.json))

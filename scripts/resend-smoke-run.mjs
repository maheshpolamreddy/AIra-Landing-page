const key = process.env.RESEND_API_KEY?.trim()
const from = process.env.EMAIL_FROM?.trim() || 'AIra <onboarding@resend.dev>'

console.log('RESEND_API_KEY len:', key?.length ?? 0)
console.log('EMAIL_FROM:', from)

if (!key) {
  console.error('No RESEND_API_KEY in environment')
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
    subject: 'AIra production Resend smoke test',
    html: '<p>If you see this in Resend dashboard, delivery works.</p>',
    text: 'If you see this in Resend dashboard, delivery works.',
  }),
})

const body = await res.text()
console.log('Status:', res.status)
console.log('Body:', body.slice(0, 500))
process.exit(res.ok ? 0 : 1)

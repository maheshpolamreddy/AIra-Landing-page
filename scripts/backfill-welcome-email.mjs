#!/usr/bin/env node
/**
 * One-time backfill: send welcome emails to users with welcomeEmailPending=true
 * and welcomeEmailSent != true.
 *
 * Requires:
 *   FIREBASE_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS)
 *   RESEND_API_KEY or SMTP_USER + SMTP_PASS
 *
 * Usage: node scripts/backfill-welcome-email.mjs [--dry-run]
 */

import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'aira-landingpage'

const dryRun = process.argv.includes('--dry-run')

function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (inline) return JSON.parse(inline)
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (path) return JSON.parse(readFileSync(path, 'utf8'))
  throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS')
}

function resolveFrom() {
  const raw =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    'AIra <onboarding@resend.dev>'
  return raw.replace(/^["']|["']$/g, '')
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) throw new Error('RESEND_API_KEY required for backfill')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resolveFrom(),
      to: [to],
      subject,
      html,
      text,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 200)}`)
  }
}

function buildWelcomeEmail(name) {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '') ||
    'https://aira-landing-page-elite.vercel.app'
  const safeName = name?.trim() || 'there'
  const subject = 'Welcome to AIra — your AI learning companion'
  const text = `Hi ${safeName},\n\nWelcome to AIra! Start learning at ${origin}/student/mode-selection\n\n— The AIra team`
  const html = `<p>Hi ${safeName},</p><p>Welcome to <strong>AIra</strong>!</p><p><a href="${origin}/student/mode-selection">Open AIra</a></p>`
  return { subject, text, html }
}

function getAdminApp() {
  if (getApps()[0]) return getApps()[0]
  return initializeApp({
    credential: cert(loadServiceAccount()),
    projectId: PROJECT_ID,
  })
}

async function main() {
  const db = getFirestore(getAdminApp())
  const snap = await db
    .collection('users')
    .where('welcomeEmailPending', '==', true)
    .get()

  const pending = snap.docs.filter((d) => d.data().welcomeEmailSent !== true)
  console.log(`Found ${pending.length} user(s) pending welcome email`)

  let sent = 0
  let failed = 0

  for (const doc of pending) {
    const data = doc.data()
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) {
      console.warn(`Skip ${doc.id}: no valid email`)
      failed++
      continue
    }

    const name = typeof data.name === 'string' ? data.name : email.split('@')[0]
    const template = buildWelcomeEmail(name)

    if (dryRun) {
      console.log(`[dry-run] would send to ${email}`)
      sent++
      continue
    }

    try {
      await sendViaResend({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
      await doc.ref.set(
        {
          welcomeEmailSent: true,
          welcomeEmailSentAt: FieldValue.serverTimestamp(),
          welcomeEmailPending: FieldValue.delete(),
          welcomeEmailClaimedAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      console.log(`Sent welcome to ${email.replace(/(.{2}).+(@.+)/, '$1***$2')}`)
      sent++
    } catch (err) {
      console.error(`Failed ${doc.id}:`, err instanceof Error ? err.message : err)
      failed++
    }
  }

  console.log(`Done. sent=${sent} failed=${failed}${dryRun ? ' (dry-run)' : ''}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

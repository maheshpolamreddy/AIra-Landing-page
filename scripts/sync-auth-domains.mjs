#!/usr/bin/env node
/**
 * Sync Firebase Authentication authorized domains via Identity Toolkit Admin API.
 *
 * Requires one of:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON (full JSON string)
 *   - GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON file)
 *   - gcloud auth application-default login
 *
 * Usage: node scripts/sync-auth-domains.mjs
 */

import { readFileSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'aira-landingpage'

const STATIC_DOMAINS = [
  'localhost',
  '127.0.0.1',
  `${PROJECT_ID}.firebaseapp.com`,
  `${PROJECT_ID}.web.app`,
  'aira-landing-page-elite.vercel.app',
]

function collectDesiredDomains() {
  const extra = [
    process.env.VERCEL_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
  ]
    .filter(Boolean)
    .map((raw) =>
      String(raw)
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .toLowerCase(),
    )

  return [...new Set([...STATIC_DOMAINS, ...extra])].sort()
}

function loadServiceAccountCredentials() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (inline) {
    try {
      return JSON.parse(inline)
    } catch {
      console.error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.',
      )
      process.exit(1)
    }
  }

  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (path) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch (err) {
      console.error(`Failed to read GOOGLE_APPLICATION_CREDENTIALS at ${path}:`, err)
      process.exit(1)
    }
  }

  return undefined
}

async function getAccessToken() {
  const credentials = loadServiceAccountCredentials()
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) {
    throw new Error('Could not obtain Google access token.')
  }
  return token.token
}

async function fetchConfig(token) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Goog-User-Project': PROJECT_ID,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GET config failed (${res.status}): ${body}`)
  }
  return res.json()
}

async function updateConfig(token, authorizedDomains) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Goog-User-Project': PROJECT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authorizedDomains }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PATCH config failed (${res.status}): ${body}`)
  }
  return res.json()
}

async function main() {
  const desired = collectDesiredDomains()
  console.log(`Project: ${PROJECT_ID}`)
  console.log(`Ensuring authorized domains:\n  ${desired.join('\n  ')}`)

  let token
  try {
    token = await getAccessToken()
  } catch (err) {
    console.warn('\n[auth:sync-domains] Skipped — no Google credentials configured.')
    console.warn(
      'Add FIREBASE_SERVICE_ACCOUNT_JSON to auto-authorize domains on deploy.',
    )
    console.warn(
      'Manual fix: Firebase Console → Authentication → Settings → Authorized domains\n',
    )
    if (process.env.VERCEL === '1' || process.env.CI === 'true') {
      // Never fail production builds when credentials are not yet configured.
      process.exit(0)
    }
    process.exit(0)
  }

  const current = await fetchConfig(token)
  const existing = current.authorizedDomains ?? []
  const merged = [...new Set([...existing, ...desired])].sort()

  const added = merged.filter((d) => !existing.includes(d))
  if (added.length === 0) {
    console.log('\nAll domains already authorized. Nothing to update.')
    return
  }

  console.log(`\nAdding: ${added.join(', ')}`)
  const updated = await updateConfig(token, merged)
  console.log('\nAuthorized domains now:')
  for (const d of updated.authorizedDomains ?? merged) {
    console.log(`  • ${d}`)
  }
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

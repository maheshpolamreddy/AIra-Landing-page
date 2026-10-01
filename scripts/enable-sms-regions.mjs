#!/usr/bin/env node
/**
 * Enable Firebase Phone Auth SMS regions (default new projects allow none).
 *
 * Usage:
 *   node --env-file=.env.local scripts/enable-sms-regions.mjs
 *   node --env-file=.env.local scripts/enable-sms-regions.mjs IN US
 */

import { readFileSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

const PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'aira-landingpage'

const DEFAULT_REGIONS = ['IN']

function loadServiceAccountCredentials() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (inline) {
    try {
      return JSON.parse(inline)
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.')
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
  if (!credentials) {
    throw new Error(
      'No credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.',
    )
  }
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) throw new Error('Could not obtain Google access token.')
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
    throw new Error(`GET config failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

async function updateSmsRegions(token, regions) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=smsRegionConfig`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Goog-User-Project': PROJECT_ID,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      smsRegionConfig: {
        allowlistOnly: {
          allowedRegions: regions,
        },
      },
    }),
  })
  if (!res.ok) {
    throw new Error(`PATCH config failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

function printSmsPolicy(config) {
  const sms = config.smsRegionConfig
  if (!sms) {
    console.log('  (no smsRegionConfig — Firebase may still be using default block-all)')
    return
  }
  console.log(JSON.stringify(sms, null, 2))
}

async function main() {
  const regions = (
    process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_REGIONS
  ).map((r) => String(r).trim().toUpperCase())

  console.log(`Project: ${PROJECT_ID}`)
  console.log(`Allowlisting SMS regions: ${regions.join(', ')}`)

  const token = await getAccessToken()
  const before = await fetchConfig(token)
  console.log('\nCurrent SMS region policy:')
  printSmsPolicy(before)

  const after = await updateSmsRegions(token, regions)
  console.log('\nUpdated SMS region policy:')
  printSmsPolicy(after)

  console.log(
    '\nDone. Hard-refresh login and try Send code with +91… (or a Phone test number).',
  )
  console.log(
    'If real SMS still fails, enable Blaze billing or add a test number in Authentication → Sign-in method → Phone.',
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const workerPort = process.env.CONTENT_WORKER_PORT || '3001'
const workerUrl = process.env.CONTENT_WORKER_URL || `http://127.0.0.1:${workerPort}/api/inngest`

/**
 * Landing does NOT execute content-pipeline Inngest functions.
 * Heavy work runs in worker/server.ts (separate Node process) to keep this server responsive.
 * Point inngest-cli dev at CONTENT_WORKER_URL, not this route.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Content pipeline functions are served by the dedicated content worker, not the landing app.',
      workerUrl,
      hint: `npx inngest-cli@latest dev -u ${workerUrl} --no-discovery`,
    },
    { status: 410 },
  )
}

export async function POST() {
  return GET()
}

export async function PUT() {
  return GET()
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Parity with tutor `/api/tts/health` — used by settings / diagnostics. */
export async function GET() {
  const sarvam = Boolean(process.env.SARVAM_API_KEY)
  return NextResponse.json({
    ok: true,
    providers: {
      sarvam: {
        configured: sarvam,
        models: ['bulbul:v2', 'bulbul:v3'],
      },
    },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

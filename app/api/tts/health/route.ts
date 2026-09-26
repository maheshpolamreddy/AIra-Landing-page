import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hasEnvLocalKey(name: string): boolean {
  try {
    const envPath = join(process.cwd(), '.env.local')
    if (!existsSync(envPath)) return false
    const txt = readFileSync(envPath, 'utf8')
    const re = new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm')
    const m = txt.match(re)
    return Boolean(m?.[1]?.trim())
  } catch {
    return false
  }
}

/** Parity with tutor `/api/tts/health` — used by settings / diagnostics. */
export async function GET() {
  const sarvam =
    Boolean(process.env.SARVAM_API_KEY?.trim()) || hasEnvLocalKey('SARVAM_API_KEY')
  const rumik =
    Boolean(process.env.RUMIK_API_KEY?.trim()) || hasEnvLocalKey('RUMIK_API_KEY')
  const elevenlabs =
    Boolean(process.env.ELEVENLABS_API_KEY?.trim()) ||
    Boolean(process.env.XI_API_KEY?.trim()) ||
    hasEnvLocalKey('ELEVENLABS_API_KEY') ||
    hasEnvLocalKey('XI_API_KEY')

  return NextResponse.json({
    ok: true,
    providers: {
      elevenlabs: {
        configured: elevenlabs,
        models: ['eleven_multilingual_v2'],
        endpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
        outputFormat: 'mp3_44100_128',
      },
      rumik: {
        configured: rumik,
        models: ['muga', 'mulberry'],
        endpoint: 'https://silk-api.rumik.ai/v1/tts',
      },
      sarvam: {
        configured: sarvam,
        models: ['bulbul:v3'],
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

import { NextRequest, NextResponse } from 'next/server'

// Node.js runtime — more stable for Vercel production
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const V2_SPEAKERS = new Set([
  'anushka', 'abhilash', 'manisha', 'vidya', 'arya', 'karun', 'hitesh',
])
const V3_SPEAKERS = new Set([
  'aditya', 'ritu', 'priya', 'neha', 'rahul', 'pooja', 'rohan', 'simran',
  'kavya', 'amit', 'dev', 'ishita', 'shreya', 'ratan', 'varun', 'manan',
  'sumit', 'roopa', 'kabir', 'aayan', 'shubh', 'ashutosh', 'advait',
  'amelia', 'sophia', 'anand', 'tanya', 'tarun', 'sunny', 'mani', 'gokul',
  'vijay', 'shruti', 'suhani', 'mohit', 'kavitha', 'rehan', 'soham', 'rupali',
])

// Language → best Sarvam female speaker mapping (defaults)
const LANG_SPEAKER_MAP: Record<string, { speaker: string; lang: string }> = {
  'en-IN': { speaker: 'pooja', lang: 'en-IN' },
  'hi-IN': { speaker: 'pooja', lang: 'hi-IN' },
  'te-IN': { speaker: 'pooja', lang: 'te-IN' },
  'ta-IN': { speaker: 'pooja', lang: 'ta-IN' },
  'kn-IN': { speaker: 'pooja', lang: 'kn-IN' },
  'ml-IN': { speaker: 'pooja', lang: 'ml-IN' },
  'mr-IN': { speaker: 'pooja', lang: 'mr-IN' },
  'bn-IN': { speaker: 'pooja', lang: 'bn-IN' },
  en: { speaker: 'pooja', lang: 'en-IN' },
  hi: { speaker: 'pooja', lang: 'hi-IN' },
  te: { speaker: 'pooja', lang: 'te-IN' },
  ta: { speaker: 'pooja', lang: 'ta-IN' },
  kn: { speaker: 'pooja', lang: 'kn-IN' },
  ml: { speaker: 'pooja', lang: 'ml-IN' },
  mr: { speaker: 'pooja', lang: 'mr-IN' },
  bn: { speaker: 'pooja', lang: 'bn-IN' },
}

function normalizeLanguage(language: unknown): string {
  const raw = String(language || 'en-IN').trim().replace('_', '-')
  if (!raw) return 'en-IN'
  const mapped = LANG_SPEAKER_MAP[raw] || LANG_SPEAKER_MAP[raw.toLowerCase()]
  if (mapped) return mapped.lang
  const base = raw.split('-')[0].toLowerCase()
  return LANG_SPEAKER_MAP[base]?.lang || 'en-IN'
}

function normalizeSpeaker(speaker: unknown, language: string): string {
  const s = String(speaker || '').trim().toLowerCase()
  if (s && s !== 'default' && (V2_SPEAKERS.has(s) || V3_SPEAKERS.has(s))) return s
  return LANG_SPEAKER_MAP[language]?.speaker || 'pooja'
}

function modelForSpeaker(speaker: string): string {
  if (V3_SPEAKERS.has(speaker)) return 'bulbul:v3'
  return 'bulbul:v2'
}

/**
 * Returns raw audio/wav bytes so the tutor teaching panel (and landing assistant)
 * can play via blob URL. Also supports Accept: application/json for older clients.
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Sarvam AI API Key is not configured on the server.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'Invalid text provided.' }, { status: 400 })
    }

    const lang = normalizeLanguage(body?.language)
    const speaker = normalizeSpeaker(body?.speaker, lang)
    const pace =
      typeof body?.pace === 'number' && Number.isFinite(body.pace) ? body.pace : 1.0
    const model = modelForSpeaker(speaker)

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: lang,
        speaker,
        model,
        pace,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        output_audio_codec: 'wav',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Sarvam AI TTS API Error:', errText)
      return NextResponse.json(
        { error: `Error from Sarvam AI TTS API: ${response.status} ${errText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const base64Audio = data.audios?.[0] || ''

    if (!base64Audio) {
      return NextResponse.json(
        { error: 'No audio returned from Sarvam AI.' },
        { status: 500 }
      )
    }

    const accept = (req.headers.get('accept') || '').toLowerCase()
    const wantJson = accept.includes('application/json') && !accept.includes('audio/')

    if (wantJson) {
      return NextResponse.json({ audio: base64Audio })
    }

    const bytes = Buffer.from(base64Audio, 'base64')
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(bytes.length),
      },
    })
  } catch (err: unknown) {
    console.error('TTS API Route Error:', err)
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

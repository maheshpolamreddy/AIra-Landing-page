import { NextRequest, NextResponse } from 'next/server'

// Node.js runtime — more stable for Vercel production
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Language → best Sarvam female speaker mapping
const LANG_SPEAKER_MAP: Record<string, { speaker: string; lang: string }> = {
  'en-IN': { speaker: 'pooja',    lang: 'en-IN' },  // encouraging Indian English female
  'hi-IN': { speaker: 'pooja',    lang: 'hi-IN' },  // Hindi
  'te-IN': { speaker: 'pooja',    lang: 'te-IN' },  // Telugu
  'ta-IN': { speaker: 'pooja',    lang: 'ta-IN' },  // Tamil
  'kn-IN': { speaker: 'pooja',    lang: 'kn-IN' },  // Kannada
  'ml-IN': { speaker: 'pooja',    lang: 'ml-IN' },  // Malayalam
  'mr-IN': { speaker: 'pooja',    lang: 'mr-IN' },  // Marathi
  'bn-IN': { speaker: 'pooja',    lang: 'bn-IN' },  // Bengali
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Sarvam AI API Key is not configured on the server.' },
        { status: 500 }
      )
    }

    const { text, language = 'en-IN' } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid text provided.' },
        { status: 400 }
      )
    }

    const { speaker, lang } = LANG_SPEAKER_MAP[language] ?? LANG_SPEAKER_MAP['en-IN']

    // Call Sarvam AI REST TTS API
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        text: text,
        speaker,
        target_language_code: lang,
        speech_sample_rate: 24000,
        model: 'bulbul:v3',
        output_audio_codec: 'wav'
      })
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

    return NextResponse.json({ audio: base64Audio })
  } catch (err: any) {
    console.error('TTS API Route Error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

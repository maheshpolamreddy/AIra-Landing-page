import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function addKey(keys: string[], raw?: string) {
  const v = String(raw || '').replace(/^["']|["']$/g, '').trim()
  if (v && !keys.includes(v)) keys.push(v)
}

function readEnvLocalValue(name: string): string | undefined {
  try {
    const envPath = join(process.cwd(), '.env.local')
    if (!existsSync(envPath)) return undefined
    const txt = readFileSync(envPath, 'utf8')
    const re = new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm')
    const m = txt.match(re)
    return m?.[1]?.trim()
  } catch {
    return undefined
  }
}

function loadSarvamKeys(): string[] {
  const keys: string[] = []
  addKey(keys, readEnvLocalValue('SARVAM_API_KEY'))
  addKey(keys, process.env.SARVAM_API_KEY)
  addKey(keys, process.env.VITE_SARVAM_API_KEY)
  return keys
}

function loadRumikKey(): string | null {
  const key =
    readEnvLocalValue('RUMIK_API_KEY') ||
    process.env.RUMIK_API_KEY?.trim() ||
    process.env.VITE_RUMIK_API_KEY?.trim() ||
    ''
  return key || null
}

function loadElevenLabsKey(): string | null {
  const key =
    readEnvLocalValue('ELEVENLABS_API_KEY') ||
    process.env.ELEVENLABS_API_KEY?.trim() ||
    process.env.XI_API_KEY?.trim() ||
    ''
  return key || null
}

const RUMIK_SPEAKERS = new Set(['siya', 'ira', 'adam', 'muga'])

/** Premade ElevenLabs voices (same set as tutor Settings). */
const ELEVENLABS_VOICES: Record<string, string> = {
  el_rachel: '21m00Tcm4TlvDq8ikWAM',
  el_drew: '29vD33N1CtxCmqQRPOHJ',
  el_clyde: '2EiwWnXFnvU5JabPnv8n',
  el_paul: '5Q0t7uMcjvnagumLfvZi',
  el_domi: 'AZnzlk1XvdvUeBnXmlld',
  el_dave: 'CYw3kZ02Hs0563khs1Fj',
  el_fin: 'D38z5RcWu1voky8WS1ja',
  el_sarah: 'EXAVITQu4vr4xnSDxMaL',
  el_antoni: 'ErXwobaYiN019PkySvjV',
  el_thomas: 'GBv7mTt0atIp3Br8iCZE',
  el_charlie: 'IKne3meq5aSn9XLyUdCD',
  el_george: 'JBFqnCBsd6RMkjVDRZzb',
  el_emily: 'LcfcDJNUP1GaeZkavlrm',
  el_elli: 'MF3mGyEYCl7XYWbV9V6O',
  el_callum: 'N2lVS1w4EtoT3dr4eOWO',
  el_patrick: 'ODq5zmih8GrVes37Dizd',
  el_harry: 'SOYHLrjzK2X1ezoPC6cr',
  el_liam: 'TX3LPaxmHKxFdv7VOQHJ',
  el_dorothy: 'ThT5KcBeYPX3keUQqHPh',
  el_josh: 'TxGEqnHWrfWFTfGW9XjX',
  el_arnold: 'VR6AewLTigWG4xSOukaG',
  el_charlotte: 'XB0fDUnXU5powFXDhCwa',
  el_matilda: 'XrExE9yKIg1WjnnlVkGX',
  el_matthew: 'Yko7PKHZNXotIFUBGPv8',
  el_james: 'ZQe5CZNOzWyzPSCn5a3c',
  el_joseph: 'Zlb1dXrM653N07WRdFW3',
  el_jeremy: 'bVMeCyTHy58xNoL34h3p',
  el_michael: 'flq6f7yk4E4fJM5XTYuZ',
  el_ethan: 'g5CIjZEefAph4nQFvHAz',
  el_chris: 'iP95p4xoKVk53GoZ742B',
  el_gigi: 'jBpfuIE2acCO8z3wKNLl',
  el_freya: 'jsCqWAovK2LkecY7zXl4',
  el_brian: 'nPczCjzI2devNBz1zQrb',
  el_grace: 'oWAxZDx7w5VEj9dCyTzz',
  el_daniel: 'onwK4e9ZLuTAKqWW03F9',
  el_lily: 'pFZP5JQG7iQjIQuC4Bku',
  el_serena: 'pMsXgVXv3BLzUgSXRplE',
  el_adam_el: 'pNInz6obpgDQGcFmaJgB',
  el_nicole: 'piTKgcLEGmPE4e6mEKli',
  el_bill: 'pqHfZKP75CvOlQylNhV4',
  el_jessie: 't0jbNlBVZ17f02VDIeMI',
  el_sam: 'yoZ06aMxZJJ28mfd3POQ',
  el_glinda: 'z9fAnlkpzviPz146aGWa',
  el_giovanni: 'zcAOhr0xsAt61XvaWFkw',
  el_mimi: 'zrHiDhphv9ZnVXBqCLjz',
}

const LEGACY_TO_RUMIK: Record<string, string> = {
  anushka: 'siya',
  manisha: 'ira',
  vidya: 'ira',
  arya: 'siya',
  abhilash: 'adam',
  karun: 'adam',
  hitesh: 'adam',
  pooja: 'siya',
  priya: 'siya',
  neha: 'ira',
  ritu: 'siya',
  simran: 'siya',
  kavya: 'ira',
  ishita: 'ira',
  shreya: 'siya',
  aditya: 'adam',
  rahul: 'adam',
  rohan: 'adam',
  amit: 'adam',
  default: 'siya',
}

const RUMIK_TO_SARVAM: Record<string, string> = {
  siya: 'pooja',
  ira: 'priya',
  adam: 'aditya',
  muga: 'pooja',
}

const LANG_MAP: Record<string, string> = {
  'en-IN': 'en-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN',
  'ta-IN': 'ta-IN',
  'kn-IN': 'kn-IN',
  'ml-IN': 'ml-IN',
  'mr-IN': 'mr-IN',
  'bn-IN': 'bn-IN',
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
}

function normalizeLanguage(language: unknown): string {
  const raw = String(language || 'en-IN').trim().replace('_', '-')
  if (!raw) return 'en-IN'
  if (LANG_MAP[raw]) return LANG_MAP[raw]
  if (LANG_MAP[raw.toLowerCase()]) return LANG_MAP[raw.toLowerCase()]
  const base = raw.split('-')[0].toLowerCase()
  return LANG_MAP[base] || 'en-IN'
}

function isElevenLabsSpeaker(speaker: string): boolean {
  return Boolean(ELEVENLABS_VOICES[speaker]) || speaker.startsWith('el:')
}

function resolveElevenLabsVoiceId(speaker: string): string | null {
  if (ELEVENLABS_VOICES[speaker]) return ELEVENLABS_VOICES[speaker]
  if (speaker.startsWith('el:') && speaker.length > 3) return speaker.slice(3)
  return null
}

function normalizeSpeaker(speaker: unknown, language: string): string {
  const s = String(speaker || '').trim().toLowerCase()
  if (isElevenLabsSpeaker(s) || ELEVENLABS_VOICES[s]) return s
  if (s.startsWith('el:')) return s
  if (RUMIK_SPEAKERS.has(s)) return s
  if (LEGACY_TO_RUMIK[s]) return LEGACY_TO_RUMIK[s]
  if (!s || s === 'default') {
    return language.startsWith('hi') ? 'muga' : 'siya'
  }
  return 'siya'
}

function rumikDescription(lang: string, speaker: string): string {
  if (speaker === 'adam') {
    return lang.startsWith('hi')
      ? 'clear Indian male tutor voice, warm and confident, natural Hindi classroom pacing'
      : 'clear Indian male tutor voice, warm and confident, calm teaching pace'
  }
  if (speaker === 'ira') {
    return lang.startsWith('hi')
      ? 'clear Indian female tutor voice, precise and friendly, natural Hindi delivery'
      : 'clear Indian female tutor voice, precise and friendly, calm teaching pace'
  }
  return lang.startsWith('hi')
    ? 'warm Indian female teacher voice, clear and friendly, natural Hindi classroom pacing'
    : 'warm Indian female teacher voice, clear and friendly, calm teaching pace like a friendly AI tutor'
}

function audioResponse(bytes: Buffer, req: NextRequest, provider: string, contentType: string) {
  const accept = (req.headers.get('accept') || '').toLowerCase()
  const wantJson = accept.includes('application/json') && !accept.includes('audio/')
  if (wantJson) {
    return NextResponse.json({
      audio: bytes.toString('base64'),
      provider,
      contentType,
    })
  }
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': String(bytes.length),
      'X-Aira-TTS-Provider': provider,
    },
  })
}

async function synthesizeElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string,
): Promise<{ ok: true; bytes: Buffer; contentType: string } | { ok: false; status: number; errText: string }> {
  const clipped = text.slice(0, 5000)
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: clipped,
      model_id: 'eleven_multilingual_v2',
    }),
    signal: AbortSignal.timeout(55_000),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    console.error('ElevenLabs TTS Error:', response.status, errText.slice(0, 300))
    return { ok: false, status: response.status, errText }
  }

  const ab = await response.arrayBuffer()
  if (!ab.byteLength) {
    return { ok: false, status: 502, errText: 'Empty audio from ElevenLabs.' }
  }
  return {
    ok: true,
    bytes: Buffer.from(ab),
    contentType: 'audio/mpeg',
  }
}

async function synthesizeSarvam(
  text: string,
  lang: string,
  rumikSpeaker: string,
  pace: number,
  apiKeys: string[],
): Promise<{ ok: true; bytes: Buffer } | { ok: false; status: number; errText: string; quota: boolean }> {
  const speaker = RUMIK_TO_SARVAM[rumikSpeaker] || 'pooja'
  const payload = {
    text,
    target_language_code: lang,
    speaker,
    model: 'bulbul:v3',
    pace,
    speech_sample_rate: 22050,
    output_audio_codec: 'wav',
  }

  let response: Response | null = null
  let errText = ''
  for (const apiKey of apiKeys) {
    response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    })
    if (response.ok) break
    errText = await response.text()
    console.error('Sarvam AI TTS API Error:', errText.slice(0, 300))
    if (response.status !== 401 && response.status !== 402 && response.status !== 403) break
  }

  if (!response || !response.ok) {
    const status = response?.status || 502
    const quota = status === 402 || /insufficient_quota|no credits/i.test(errText)
    return { ok: false, status, errText, quota }
  }

  const data = (await response.json()) as { audios?: string[] }
  const base64Audio = data.audios?.[0] || ''
  if (!base64Audio) {
    return { ok: false, status: 500, errText: 'No audio returned from Sarvam AI.', quota: false }
  }
  return { ok: true, bytes: Buffer.from(base64Audio, 'base64') }
}

async function synthesizeRumik(
  text: string,
  lang: string,
  speaker: string,
  apiKey: string,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; status: number; errText: string }> {
  const clipped = text.slice(0, 2000)
  const mulberrySpeaker =
    speaker === 'adam' || speaker === 'ira' || speaker === 'siya' ? speaker : 'siya'

  const body =
    speaker === 'muga'
      ? {
          model: 'muga',
          text: clipped.startsWith('[') ? clipped : `[neutral] ${clipped}`,
        }
      : {
          model: 'mulberry',
          text: clipped,
          description: rumikDescription(lang, mulberrySpeaker),
          speaker: mulberrySpeaker,
        }

  const response = await fetch('https://silk-api.rumik.ai/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55_000),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    console.error('Rumik TTS API Error:', response.status, errText.slice(0, 300))
    return { ok: false, status: response.status, errText }
  }

  const ab = await response.arrayBuffer()
  if (!ab.byteLength) {
    return { ok: false, status: 502, errText: 'Empty audio from Rumik TTS.' }
  }
  return { ok: true, bytes: Buffer.from(ab) }
}

/**
 * Returns audio bytes. Route by selected speaker:
 * ElevenLabs voice → ElevenLabs; else Rumik → Sarvam fallback.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'Invalid text provided.' }, { status: 400 })
    }

    const lang = normalizeLanguage(body?.language)
    const speaker = normalizeSpeaker(body?.speaker, lang)
    const pace =
      typeof body?.pace === 'number' && Number.isFinite(body.pace) ? body.pace : 1.0

    const sarvamKeys = loadSarvamKeys()
    const rumikKey = loadRumikKey()
    const elevenKey = loadElevenLabsKey()

    if (!sarvamKeys.length && !rumikKey && !elevenKey) {
      return NextResponse.json(
        {
          error: 'No TTS provider configured. Set ELEVENLABS_API_KEY, RUMIK_API_KEY, and/or SARVAM_API_KEY.',
          code: 'NO_KEYS',
        },
        { status: 503 },
      )
    }

    // Preferred path when user picked an ElevenLabs voice
    if (isElevenLabsSpeaker(speaker) || resolveElevenLabsVoiceId(speaker)) {
      const voiceId = resolveElevenLabsVoiceId(speaker)
      if (!voiceId) {
        return NextResponse.json({ error: 'Unknown ElevenLabs voice.' }, { status: 400 })
      }
      if (!elevenKey) {
        return NextResponse.json(
          {
            error: 'ElevenLabs voice selected but ELEVENLABS_API_KEY is not set on the server.',
            code: 'NO_KEYS',
          },
          { status: 503 },
        )
      }
      const el = await synthesizeElevenLabs(text, voiceId, elevenKey)
      if (el.ok) return audioResponse(el.bytes, req, 'elevenlabs', el.contentType)

      // Soft fallback to Rumik if ElevenLabs fails
      if (rumikKey) {
        console.warn('[tts] ElevenLabs failed; falling back to Rumik', el.status)
        const rumik = await synthesizeRumik(text, lang, 'siya', rumikKey)
        if (rumik.ok) return audioResponse(rumik.bytes, req, 'rumik', 'audio/wav')
      }

      return NextResponse.json(
        {
          error: `ElevenLabs TTS failed: ${el.status} ${el.errText.slice(0, 220)}`,
          code: 'TTS_PROVIDER',
        },
        { status: el.status >= 400 && el.status < 600 ? el.status : 502 },
      )
    }

    if (rumikKey) {
      const rumik = await synthesizeRumik(text, lang, speaker, rumikKey)
      if (rumik.ok) return audioResponse(rumik.bytes, req, 'rumik', 'audio/wav')

      if (sarvamKeys.length) {
        console.warn('[tts] Rumik failed; falling back to Sarvam', rumik.status)
        const sarvam = await synthesizeSarvam(text, lang, speaker, pace, sarvamKeys)
        if (sarvam.ok) return audioResponse(sarvam.bytes, req, 'sarvam', 'audio/wav')
        return NextResponse.json(
          {
            error: `TTS providers failed. Rumik: ${rumik.status}. Sarvam: ${sarvam.status}`,
            code: 'TTS_PROVIDER',
          },
          { status: 502 },
        )
      }

      return NextResponse.json(
        {
          error: `Rumik TTS failed: ${rumik.status} ${rumik.errText.slice(0, 220)}`,
          code: 'TTS_PROVIDER',
        },
        { status: rumik.status >= 400 && rumik.status < 600 ? rumik.status : 502 },
      )
    }

    if (elevenKey) {
      const el = await synthesizeElevenLabs(text, ELEVENLABS_VOICES.el_george, elevenKey)
      if (el.ok) return audioResponse(el.bytes, req, 'elevenlabs', el.contentType)
    }

    if (sarvamKeys.length) {
      const sarvam = await synthesizeSarvam(text, lang, speaker, pace, sarvamKeys)
      if (sarvam.ok) return audioResponse(sarvam.bytes, req, 'sarvam', 'audio/wav')
      return NextResponse.json(
        {
          error: sarvam.quota
            ? 'Sarvam TTS has no credits remaining. Add ELEVENLABS_API_KEY or RUMIK_API_KEY.'
            : `Error from Sarvam AI TTS API: ${sarvam.status} ${sarvam.errText}`,
          code: sarvam.quota ? 'TTS_QUOTA' : 'TTS_PROVIDER',
        },
        { status: sarvam.status },
      )
    }

    return NextResponse.json({ error: 'No TTS provider available.' }, { status: 503 })
  } catch (err: unknown) {
    console.error('TTS API Route Error:', err)
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

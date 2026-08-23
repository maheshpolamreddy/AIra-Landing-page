import type { SupportedLanguage } from './types'

const V2_SPEAKERS = new Set([
  'anushka', 'abhilash', 'manisha', 'vidya', 'arya', 'karun', 'hitesh',
])
const V3_SPEAKERS = new Set([
  'aditya', 'ritu', 'priya', 'neha', 'rahul', 'pooja', 'rohan', 'simran',
])

const TTS_MAX_CHARS = 2500

const LANG_SPEAKER_MAP: Record<string, { speaker: string; lang: string }> = {
  'en-IN': { speaker: 'pooja', lang: 'en-IN' },
  'hi-IN': { speaker: 'pooja', lang: 'hi-IN' },
  'te-IN': { speaker: 'pooja', lang: 'te-IN' },
}

function normalizeLanguage(language: string): string {
  const raw = language.trim().replace('_', '-')
  return LANG_SPEAKER_MAP[raw]?.lang || LANG_SPEAKER_MAP[raw.split('-')[0]]?.lang || 'en-IN'
}

function modelForSpeaker(speaker: string): string {
  return V3_SPEAKERS.has(speaker) ? 'bulbul:v3' : 'bulbul:v2'
}

/** Parse duration in seconds from a PCM WAV buffer. */
export function parseWavDurationSeconds(buffer: Buffer): number {
  if (buffer.length < 44) return 0

  const byteRate = buffer.readUInt32LE(28)
  if (byteRate <= 0) return 0

  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkId === 'data') {
      return Math.max(0.1, chunkSize / byteRate)
    }
    offset += 8 + chunkSize
    if (chunkSize <= 0) break
  }

  const dataSize = Math.max(0, buffer.length - 44)
  return Math.max(0.1, dataSize / byteRate)
}

export interface TtsResult {
  audioBuffer: Buffer
  durationSeconds: number
}

/** Minimal PCM WAV for local pipeline verification when Sarvam quota is unavailable. */
function generateDevStubWav(durationSeconds: number): Buffer {
  const sampleRate = 22050
  const seconds = Math.max(0.5, Math.min(durationSeconds, 30))
  const numSamples = Math.floor(sampleRate * seconds)
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  return buffer
}

function devStubEnabled(): boolean {
  if (process.env.TTS_DEV_STUB === '1') return true
  return process.env.INNGEST_DEV === '1' && process.env.NODE_ENV !== 'production'
}

function estimateDurationFromText(text: string): number {
  return Math.max(1, text.split(/\s+/).filter(Boolean).length / 2.5)
}

export async function synthesizeSegmentAudio(
  text: string,
  language: SupportedLanguage,
  speaker = 'pooja',
  speed = 1.0,
): Promise<TtsResult> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('TTS text is empty')
  if (trimmed.length > TTS_MAX_CHARS) {
    throw new Error(`TTS text exceeds ${TTS_MAX_CHARS} characters (${trimmed.length}) — split into smaller segments`)
  }

  if (devStubEnabled()) {
    const durationSeconds = estimateDurationFromText(trimmed)
    return { audioBuffer: generateDevStubWav(durationSeconds), durationSeconds }
  }

  const apiKey = process.env.SARVAM_API_KEY
  if (!apiKey) throw new Error('SARVAM_API_KEY not configured')

  const lang = normalizeLanguage(language)
  const spk = V2_SPEAKERS.has(speaker) || V3_SPEAKERS.has(speaker) ? speaker : 'pooja'
  const model = modelForSpeaker(spk)

  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [trimmed],
      target_language_code: lang,
      speaker: spk,
      model,
      speech_sample_rate: 22050,
      pace: speed,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Sarvam TTS failed (${res.status}): ${err.slice(0, 200)}`)
  }

  const json = (await res.json()) as { audios?: string[] }
  const b64 = json.audios?.[0]
  if (!b64) throw new Error('Sarvam TTS returned no audio')

  const audioBuffer = Buffer.from(b64, 'base64')
  const measured = parseWavDurationSeconds(audioBuffer)
  const durationSeconds = measured > 0 ? measured : Math.max(2, trimmed.split(/\s+/).length / 2.5)

  return { audioBuffer, durationSeconds }
}

export async function synthesizeWithRetry(
  text: string,
  language: SupportedLanguage,
  maxRetries = 3,
): Promise<TtsResult> {
  let lastError: Error | null = null
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await synthesizeSegmentAudio(text, language)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)))
    }
  }
  throw lastError || new Error('TTS failed')
}

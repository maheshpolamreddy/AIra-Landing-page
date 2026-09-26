import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Premade voices shipped in Settings (work with eleven_multilingual_v2). */
const PREMADE = [
  { value: 'el_rachel', voiceId: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel — Calm Female' },
  { value: 'el_drew', voiceId: '29vD33N1CtxCmqQRPOHJ', label: 'Drew — Well-rounded Male' },
  { value: 'el_clyde', voiceId: '2EiwWnXFnvU5JabPnv8n', label: 'Clyde — War Veteran Male' },
  { value: 'el_paul', voiceId: '5Q0t7uMcjvnagumLfvZi', label: 'Paul — Ground Reporter Male' },
  { value: 'el_domi', voiceId: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi — Strong Female' },
  { value: 'el_dave', voiceId: 'CYw3kZ02Hs0563khs1Fj', label: 'Dave — Conversational Male' },
  { value: 'el_fin', voiceId: 'D38z5RcWu1voky8WS1ja', label: 'Fin — Sailor Male' },
  { value: 'el_sarah', voiceId: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — Soft Female' },
  { value: 'el_antoni', voiceId: 'ErXwobaYiN019PkySvjV', label: 'Antoni — Well-rounded Male' },
  { value: 'el_thomas', voiceId: 'GBv7mTt0atIp3Br8iCZE', label: 'Thomas — Calm Male' },
  { value: 'el_charlie', voiceId: 'IKne3meq5aSn9XLyUdCD', label: 'Charlie — Casual Male' },
  { value: 'el_george', voiceId: 'JBFqnCBsd6RMkjVDRZzb', label: 'George — Warm British Male' },
  { value: 'el_emily', voiceId: 'LcfcDJNUP1GaeZkavlrm', label: 'Emily — Calm Female' },
  { value: 'el_elli', voiceId: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli — Emotional Female' },
  { value: 'el_callum', voiceId: 'N2lVS1w4EtoT3dr4eOWO', label: 'Callum — Hoarse Male' },
  { value: 'el_patrick', voiceId: 'ODq5zmih8GrVes37Dizd', label: 'Patrick — Shouty Male' },
  { value: 'el_harry', voiceId: 'SOYHLrjzK2X1ezoPC6cr', label: 'Harry — Anxious Male' },
  { value: 'el_liam', voiceId: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam — Articulate Male' },
  { value: 'el_dorothy', voiceId: 'ThT5KcBeYPX3keUQqHPh', label: 'Dorothy — Pleasant Female' },
  { value: 'el_josh', voiceId: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh — Deep Male' },
  { value: 'el_arnold', voiceId: 'VR6AewLTigWG4xSOukaG', label: 'Arnold — Crisp Male' },
  { value: 'el_charlotte', voiceId: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte — Seductive Female' },
  { value: 'el_matilda', voiceId: 'XrExE9yKIg1WjnnlVkGX', label: 'Matilda — Warm Female' },
  { value: 'el_matthew', voiceId: 'Yko7PKHZNXotIFUBGPv8', label: 'Matthew — Audiobook Male' },
  { value: 'el_james', voiceId: 'ZQe5CZNOzWyzPSCn5a3c', label: 'James — Calm Male' },
  { value: 'el_joseph', voiceId: 'Zlb1dXrM653N07WRdFW3', label: 'Joseph — Ground Reporter Male' },
  { value: 'el_jeremy', voiceId: 'bVMeCyTHy58xNoL34h3p', label: 'Jeremy — Excited Male' },
  { value: 'el_michael', voiceId: 'flq6f7yk4E4fJM5XTYuZ', label: 'Michael — Orotund Male' },
  { value: 'el_ethan', voiceId: 'g5CIjZEefAph4nQFvHAz', label: 'Ethan — Soft Male' },
  { value: 'el_chris', voiceId: 'iP95p4xoKVk53GoZ742B', label: 'Chris — Charming Male' },
  { value: 'el_gigi', voiceId: 'jBpfuIE2acCO8z3wKNLl', label: 'Gigi — Childish Female' },
  { value: 'el_freya', voiceId: 'jsCqWAovK2LkecY7zXl4', label: 'Freya — Expressive Female' },
  { value: 'el_brian', voiceId: 'nPczCjzI2devNBz1zQrb', label: 'Brian — Deep Male' },
  { value: 'el_grace', voiceId: 'oWAxZDx7w5VEj9dCyTzz', label: 'Grace — Southern Female' },
  { value: 'el_daniel', voiceId: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel — Deep Male' },
  { value: 'el_lily', voiceId: 'pFZP5JQG7iQjIQuC4Bku', label: 'Lily — Warm Female' },
  { value: 'el_serena', voiceId: 'pMsXgVXv3BLzUgSXRplE', label: 'Serena — Pleasant Female' },
  { value: 'el_adam_el', voiceId: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (EL) — Deep Male' },
  { value: 'el_nicole', voiceId: 'piTKgcLEGmPE4e6mEKli', label: 'Nicole — Whisper Female' },
  { value: 'el_bill', voiceId: 'pqHfZKP75CvOlQylNhV4', label: 'Bill — Stoic Male' },
  { value: 'el_jessie', voiceId: 't0jbNlBVZ17f02VDIeMI', label: 'Jessie — Raspy Male' },
  { value: 'el_sam', voiceId: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam — Raspy Male' },
  { value: 'el_glinda', voiceId: 'z9fAnlkpzviPz146aGWa', label: 'Glinda — Witch Female' },
  { value: 'el_giovanni', voiceId: 'zcAOhr0xsAt61XvaWFkw', label: 'Giovanni — Foreigner Male' },
  { value: 'el_mimi', voiceId: 'zrHiDhphv9ZnVXBqCLjz', label: 'Mimi — Childish Female' },
]

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

function loadElevenLabsKey(): string | null {
  return (
    readEnvLocalValue('ELEVENLABS_API_KEY') ||
    process.env.ELEVENLABS_API_KEY?.trim() ||
    process.env.XI_API_KEY?.trim() ||
    null
  )
}

/**
 * Lists workable ElevenLabs voices for Settings.
 * If ELEVENLABS_API_KEY is set, merges account voices from GET /v1/voices
 * with the premade multilingual set (deduped by voiceId).
 */
export async function GET() {
  const apiKey = loadElevenLabsKey()
  const premade = PREMADE.map((v) => ({ ...v, source: 'premade' as const, workable: true }))

  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      configured: false,
      model: 'eleven_multilingual_v2',
      voices: premade,
      note: 'Set ELEVENLABS_API_KEY to verify account voices live.',
    })
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json({
        ok: true,
        configured: true,
        model: 'eleven_multilingual_v2',
        voices: premade,
        accountError: `${res.status} ${errText.slice(0, 180)}`,
      })
    }

    const data = (await res.json()) as {
      voices?: Array<{ voice_id?: string; name?: string; category?: string }>
    }
    const byId = new Map(premade.map((v) => [v.voiceId, v]))

    for (const v of data.voices || []) {
      const voiceId = String(v.voice_id || '').trim()
      if (!voiceId) continue
      if (byId.has(voiceId)) continue
      const name = String(v.name || 'Custom').trim()
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'custom'
      byId.set(voiceId, {
        value: `el:${voiceId}`,
        voiceId,
        label: `${name} — Account voice`,
        source: 'account' as const,
        workable: true,
      })
      void slug
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      model: 'eleven_multilingual_v2',
      voices: Array.from(byId.values()),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'voices fetch failed'
    return NextResponse.json({
      ok: true,
      configured: true,
      model: 'eleven_multilingual_v2',
      voices: premade,
      accountError: message,
    })
  }
}

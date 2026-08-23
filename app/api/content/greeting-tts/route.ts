import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, firstNameFromProfile } from '@/lib/content/auth'
import {
  normalizeLanguage,
  normalizeTeachingStyle,
  GREETING_TEMPLATES,
} from '@/lib/content/constants'
import type { SupportedLanguage, TeachingStyle } from '@/lib/content/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const V2_SPEAKERS = new Set(['anushka', 'abhilash', 'manisha', 'vidya', 'arya', 'karun', 'hitesh'])
const V3_SPEAKERS = new Set(['pooja', 'ritu', 'priya', 'neha', 'rahul'])

function modelForSpeaker(speaker: string): string {
  return V3_SPEAKERS.has(speaker) ? 'bulbul:v3' : 'bulbul:v2'
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const firstName = firstNameFromProfile(
    typeof body.firstName === 'string' ? body.firstName : auth.email?.split('@')[0],
  )
  const language = normalizeLanguage(typeof body.language === 'string' ? body.language : undefined)
  const style = normalizeTeachingStyle(typeof body.teachingStyle === 'string' ? body.teachingStyle : undefined)

  const template = GREETING_TEMPLATES[style][language]
  const text = template.replace('{firstName}', firstName)

  const apiKey = process.env.SARVAM_API_KEY
  if (!apiKey) {
    return NextResponse.json({ text, audioUrl: null, fallback: true })
  }

  const speaker = 'pooja'
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: language,
      speaker,
      model: modelForSpeaker(speaker),
      speech_sample_rate: 22050,
      pace: 1.0,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ text, audioUrl: null, fallback: true })
  }

  const json = (await res.json()) as { audios?: string[] }
  const b64 = json.audios?.[0]
  if (!b64) {
    return NextResponse.json({ text, audioUrl: null, fallback: true })
  }

  const dataUri = `data:audio/wav;base64,${b64}`
  return NextResponse.json({ text, audioUrl: dataUri, fallback: false })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/content/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const PRIMARY_MODEL = process.env.GROQ_CHAT_MODEL?.trim() || 'openai/gpt-oss-20b'
const FALLBACK_MODEL = 'groq/compound'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<Response> {
  return fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(55_000),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: 'AUTH' }, { status: auth.status })
  }

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured on the landing server.', code: 'NO_KEYS' },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.', code: 'invalid_request' }, { status: 400 })
  }

  const temperature = clampFloat(body.temperature, 0, 0, 2)
  const maxTokens = Math.round(clampFloat(body.max_tokens, 8192, 256, 8192))

  let messages: ChatMessage[] = []
  if (Array.isArray(body.messages)) {
    messages = body.messages
      .filter((m): m is ChatMessage => {
        if (!m || typeof m !== 'object') return false
        const rec = m as { role?: unknown; content?: unknown }
        return (
          (rec.role === 'system' || rec.role === 'user' || rec.role === 'assistant') &&
          typeof rec.content === 'string' &&
          rec.content.trim().length > 0
        )
      })
      .map((m) => ({ role: m.role, content: m.content.slice(0, 48_000) }))
  } else if (typeof body.prompt === 'string' && body.prompt.trim()) {
    messages = [{ role: 'user', content: body.prompt.trim().slice(0, 48_000) }]
  }

  if (!messages.length) {
    return NextResponse.json(
      { error: 'Provide a prompt string or a messages array.', code: 'invalid_request' },
      { status: 400 },
    )
  }

  try {
    let response = await callGroq(apiKey, PRIMARY_MODEL, messages, temperature, maxTokens)
    if (!response.ok) {
      const failedPrimary = await response.text().catch(() => '')
      console.warn('[ai/complete] primary model failed', response.status, failedPrimary.slice(0, 200))
      response = await callGroq(apiKey, FALLBACK_MODEL, messages, temperature, maxTokens)
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      const code = response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER'
      console.warn('[ai/complete] Groq error', response.status)
      return NextResponse.json(
        { error: 'AI provider request failed.', code, status: response.status },
        { status: response.status === 429 ? 429 : 502 },
      )
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    const text = typeof content === 'string' ? content.trim() : ''
    if (!text) {
      return NextResponse.json({ error: 'Empty AI response.', code: 'PROVIDER' }, { status: 502 })
    }

    return NextResponse.json({ content: text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    const timedOut = /timeout|aborted/i.test(message)
    console.warn('[ai/complete]', timedOut ? 'timeout' : 'error')
    return NextResponse.json(
      { error: timedOut ? 'AI request timed out.' : 'Internal Server Error', code: timedOut ? 'NETWORK' : 'SERVER' },
      { status: timedOut ? 504 : 500 },
    )
  }
}

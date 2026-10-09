import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/content/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** Models this org can use — keep in sync with live Groq access. */
const PRIMARY_MODEL = process.env.GROQ_CHAT_MODEL?.trim() || 'openai/gpt-oss-20b'
const FALLBACK_MODELS = [
  process.env.GROQ_CHAT_MODEL_FALLBACK?.trim(),
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
].filter((m): m is string => Boolean(m))

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function clampFloat(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function groqKeys(): string[] {
  return [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_FALLBACK]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k))
}

function groqModels(): string[] {
  return [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS])]
}

/** Rough token estimate so we stay under free-tier TPM (~8k). */
function estimateTokens(messages: ChatMessage[]): number {
  const chars = messages.reduce((n, m) => n + m.content.length, 0)
  return Math.ceil(chars / 3.5) + messages.length * 6
}

function budgetMaxTokens(messages: ChatMessage[], requested: number): number {
  const input = estimateTokens(messages)
  // Leave headroom under ~8000 TPM budgets on free/on_demand tiers.
  const room = Math.max(256, 7500 - input)
  return Math.min(requested, room, 4096)
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<{ ok: boolean; status: number; text: string; content?: string }> {
  const res = await fetch(GROQ_API_URL, {
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
  const raw = await res.text().catch(() => '')
  if (!res.ok) {
    return { ok: false, status: res.status, text: raw }
  }
  try {
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    const text = typeof content === 'string' ? content.trim() : ''
    return { ok: true, status: res.status, text: raw, content: text }
  } catch {
    return { ok: false, status: res.status, text: 'Invalid JSON from Groq' }
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: 'AUTH' }, { status: auth.status })
  }

  const keys = groqKeys()
  if (!keys.length) {
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
  const requestedMax = Math.round(clampFloat(body.max_tokens, 2048, 256, 8192))

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
      .map((m) => ({ role: m.role, content: m.content.slice(0, 24_000) }))
  } else if (typeof body.prompt === 'string' && body.prompt.trim()) {
    messages = [{ role: 'user', content: body.prompt.trim().slice(0, 24_000) }]
  }

  if (!messages.length) {
    return NextResponse.json(
      { error: 'Provide a prompt string or a messages array.', code: 'invalid_request' },
      { status: 400 },
    )
  }

  // If the prompt itself blows the TPM budget, trim the last user/system blob.
  let maxTokens = budgetMaxTokens(messages, requestedMax)
  if (maxTokens < 256) {
    const last = messages[messages.length - 1]
    last.content = last.content.slice(0, 12_000)
    messages = [...messages.slice(0, -1), last]
    maxTokens = budgetMaxTokens(messages, Math.min(requestedMax, 1024))
  }

  const models = groqModels()
  let lastStatus = 502
  let lastDetail = ''
  let sawRateLimit = false

  try {
    for (const apiKey of keys) {
      for (const model of models) {
        // Retry once with a tighter token budget on 413 / 429.
        const budgets = [maxTokens, Math.min(maxTokens, 1024), 512]
        for (const budget of [...new Set(budgets)]) {
          const result = await callGroq(apiKey, model, messages, temperature, budget)
          if (result.ok && result.content) {
            console.info('[ai/complete] ok', model, 'max_tokens', budget)
            return NextResponse.json({ content: result.content })
          }
          lastStatus = result.status
          lastDetail = result.text.slice(0, 180)
          console.warn('[ai/complete] stage failed', model, result.status, lastDetail)

          if (result.status === 429) {
            sawRateLimit = true
            continue
          }
          if (result.status === 413) {
            continue // try smaller budget
          }
          if (result.status === 401 || result.status === 403) {
            break // bad key — try next key
          }
          if (result.status === 404 || result.status === 400) {
            break // bad/decommissioned model — next model
          }
        }
      }
    }

    const code = sawRateLimit || lastStatus === 429 ? 'RATE_LIMIT' : 'PROVIDER'
    return NextResponse.json(
      {
        error: sawRateLimit
          ? 'AI rate limit reached. Please wait a few seconds and try again.'
          : 'AI provider request failed.',
        code,
        status: lastStatus,
      },
      { status: code === 'RATE_LIMIT' ? 429 : 502 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    const timedOut = /timeout|aborted/i.test(message)
    console.warn('[ai/complete]', timedOut ? 'timeout' : 'error')
    return NextResponse.json(
      {
        error: timedOut ? 'AI request timed out.' : 'Internal Server Error',
        code: timedOut ? 'NETWORK' : 'SERVER',
      },
      { status: timedOut ? 504 : 500 },
    )
  }
}

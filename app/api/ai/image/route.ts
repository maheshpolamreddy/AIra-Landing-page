import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/content/auth'
import {
  buildEduImagePrompt,
  buildFallbackDiagram,
  extractVisualSubject,
  looksEducational,
  parseDiagramJson,
  type EduDiagram,
} from '@/lib/ai/edu-image'
import { trySpecializedEduSvg } from '@/lib/ai/edu-svg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

/**
 * Hosted image models on NVIDIA GenAI (ai.api.nvidia.com).
 * Note: `/v1/images/generations` on integrate.api.nvidia.com is not available for
 * trial keys — Qwen-Image / FLUX NIMs there are downloadable-only. Use GenAI paths.
 */
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_CHAT_MODEL?.trim() || 'openai/gpt-oss-20b'

// Prefer flux.1-dev for prompt adherence; klein as fast secondary.
const DEFAULT_MODELS = [
  'black-forest-labs/flux.1-dev',
  'black-forest-labs/flux.2-klein-4b',
]

/** Hosted GenAI base — integrate.api.nvidia.com has no /v1/images/generations for trial keys. */
function nvidiaGenaiBase(): string {
  const raw = process.env.NVIDIA_IMAGE_BASE_URL?.trim().replace(/\/$/, '') || ''
  if (!raw || /integrate\.api\.nvidia\.com/i.test(raw)) {
    return 'https://ai.api.nvidia.com'
  }
  return raw
}

type ImageSuccess = {
  imageUrl: string
  provider: 'nvidia-primary' | 'nvidia-fallback' | 'svg-precise'
  model: string
  caption?: string
}

type SvgFallback = {
  fallback: 'svg'
  diagram: EduDiagram
  provider: 'svg-fallback'
  caption?: string
}

function nvidiaKeys(): string[] {
  return [process.env.NVIDIA_API_KEY, process.env.NVIDIA_API_KEY_FALLBACK]
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k))
}

function nvidiaModels(): string[] {
  const primary = process.env.NVIDIA_IMAGE_MODEL?.trim()
  const secondary = process.env.NVIDIA_IMAGE_MODEL_FALLBACK?.trim()
  const list = [primary, secondary, ...DEFAULT_MODELS].filter((m): m is string => Boolean(m))
  // Skip downloadable-only / broken hosted ids (404 or empty on GenAI).
  const skip = /qwen\/qwen-image|\/v1\/images\/generations/i
  return [...new Set(list.filter((m) => !skip.test(m)))]
}

function extractB64(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const data = Array.isArray(p.data) ? p.data : null
  if (data?.[0] && typeof data[0] === 'object') {
    const first = data[0] as Record<string, unknown>
    if (typeof first.b64_json === 'string' && first.b64_json.trim()) return first.b64_json.trim()
    if (typeof first.base64 === 'string' && first.base64.trim()) return first.base64.trim()
    if (typeof first.url === 'string' && first.url.startsWith('data:')) return first.url
    if (typeof first.url === 'string' && /^https?:\/\//i.test(first.url)) return first.url
  }
  const artifacts = Array.isArray(p.artifacts) ? p.artifacts : null
  if (artifacts?.[0] && typeof artifacts[0] === 'object') {
    const a = artifacts[0] as Record<string, unknown>
    if (typeof a.base64 === 'string' && a.base64.trim()) return a.base64.trim()
    if (typeof a.b64_json === 'string' && a.b64_json.trim()) return a.b64_json.trim()
    if (typeof a.bytes === 'string' && a.bytes.trim()) return a.bytes.trim()
  }
  if (typeof p.b64_json === 'string') return p.b64_json
  if (typeof p.image === 'string') return p.image
  return null
}

function toDataUrl(raw: string): string {
  if (raw.startsWith('data:') || /^https?:\/\//i.test(raw)) return raw
  const compact = raw.replace(/\s+/g, '')
  // FLUX GenAI returns JPEG; PNG base64 starts with iVBOR
  const mime = compact.startsWith('iVBOR') ? 'image/png' : 'image/jpeg'
  return `data:${mime};base64,${compact}`
}

/**
 * FLUX sometimes returns a successful but blank white JPEG (~5–12KB).
 * Real textbook diagrams are typically much larger.
 */
function isLikelyBlankRaster(dataUrl: string): boolean {
  if (!dataUrl.startsWith('data:image/')) return true
  if (dataUrl.startsWith('data:image/svg')) return false
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return true
  const b64 = dataUrl.slice(comma + 1).replace(/\s+/g, '')
  const bytes = Math.floor((b64.length * 3) / 4)
  return bytes < 20_000
}

function pickCanvasSize(prompt: string): { width: number; height: number } {
  // Wide canvas for number lines / timelines; square for most diagrams.
  if (/\b(number\s*line|timeline|axis)\b/i.test(prompt)) {
    return { width: 1344, height: 768 }
  }
  return { width: 1024, height: 1024 }
}

function buildGenaiBody(model: string, prompt: string): Record<string, unknown> {
  const id = model.toLowerCase()
  const { width, height } = pickCanvasSize(prompt)
  const seed = Math.floor(Math.random() * 2_147_483_647)
  if (id.includes('flux.1-schnell')) {
    return {
      prompt,
      width,
      height,
      cfg_scale: 0,
      mode: 'base',
      samples: 1,
      seed,
      steps: 4,
    }
  }
  if (id.includes('flux.1-dev') || id.includes('flux_1-dev')) {
    return {
      prompt,
      width,
      height,
      // Higher guidance = closer match to the student's request.
      cfg_scale: 5.5,
      seed,
      steps: 28,
    }
  }
  // flux.2-klein-4b and similar distilled models
  return {
    prompt,
    width,
    height,
    seed,
    steps: 8,
  }
}

/**
 * Rewrite the student ask into a precise FLUX prompt (exact labels + diagram type).
 * Falls back to buildEduImagePrompt when Groq is unavailable.
 */
async function refinePromptViaGroq(input: {
  prompt: string
  topic?: string
  subject?: string
  purpose: 'chat' | 'notes'
}): Promise<string> {
  const base = buildEduImagePrompt(input)
  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (!groqKey) return base

  const focus = extractVisualSubject(input.prompt).slice(0, 600)
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.35,
        max_tokens: 450,
        messages: [
          {
            role: 'system',
            content: `You write ONE image-generation prompt for a school textbook diagram.
Rules:
- Output ONLY the prompt text (no quotes, no markdown, no preamble).
- The PRIMARY subject is what the student asked to see — never replace it with the lesson title.
- If the student asks for photosynthesis while the lesson is "Number Line", draw photosynthesis.
- Each request must describe a DISTINCT diagram matching that ask (not a recycled poster).
- Specify diagram type (labeled cycle, flowchart, cross-section, map, geometry figure, etc.).
- List concrete labels that MUST appear (part names, equations, steps).
- Style: flat NCERT textbook, white background, black outlines, large readable English labels.
- Forbid: photorealism, people, posters, watermarks, random scenery, abstract art.
- Keep under 90 words.`,
          },
          {
            role: 'user',
            content: [
              `MUST illustrate (primary): ${focus}`,
              input.subject ? `Subject area: ${input.subject}` : '',
              input.topic
                ? `Lesson title (secondary context only — ignore if it conflicts with primary): ${input.topic}`
                : '',
              `Purpose: ${input.purpose}`,
              `Helper notes: ${base.slice(0, 500)}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return base
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const refined = (data.choices?.[0]?.message?.content || '')
      .trim()
      .replace(/^```[\s\S]*?```$/g, '')
      .replace(/^["']|["']$/g, '')
      .trim()
    if (refined.length < 40) return base
    return refined.slice(0, 1400)
  } catch {
    return base
  }
}

async function callNvidiaGenai(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `${nvidiaGenaiBase()}/v1/genai/${model}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      // Allow NVCF to wait for the job instead of returning 202 immediately.
      'NVCF-POLL-SECONDS': '75',
    },
    body: JSON.stringify(buildGenaiBody(model, prompt)),
    signal: AbortSignal.timeout(80_000),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`NVIDIA genai ${model} ${res.status}: ${errText.slice(0, 180)}`)
  }
  const json = await res.json()
  const b64 = extractB64(json)
  if (!b64) throw new Error(`NVIDIA genai ${model}: empty payload`)
  const dataUrl = toDataUrl(b64)
  if (isLikelyBlankRaster(dataUrl)) {
    throw new Error(`NVIDIA genai ${model}: blank/white image rejected`)
  }
  return dataUrl
}

async function generateSvgViaGroq(prompt: string, topic?: string): Promise<EduDiagram> {
  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (!groqKey) return buildFallbackDiagram(prompt, topic)

  const system = `Return ONLY JSON for an educational diagram:
{"type":"process"|"hierarchy"|"cycle"|"compare"|"concept-map","title":"...","caption":"...","nodes":[{"id":"n1","label":"...","detail":"..."}],"edges":[{"from":"n1","to":"n2","label":"..."}]}
Use 3-6 nodes. School textbook style. No markdown.`

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Topic: ${topic || 'lesson'}\nVisualize: ${prompt.slice(0, 1500)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(40_000),
    })
    if (!res.ok) return buildFallbackDiagram(prompt, topic)
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const text = data.choices?.[0]?.message?.content || ''
    return parseDiagramJson(text) || buildFallbackDiagram(prompt, topic)
  } catch {
    return buildFallbackDiagram(prompt, topic)
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: 'AUTH' }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.', code: 'invalid_request' }, { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return NextResponse.json({ error: 'Provide a prompt string.', code: 'invalid_request' }, { status: 400 })
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim() : undefined
  const subject = typeof body.subject === 'string' ? body.subject.trim() : undefined
  const purpose = body.purpose === 'notes' ? 'notes' : 'chat'

  if (!looksEducational(prompt, topic, subject)) {
    return NextResponse.json(
      {
        error:
          'Image generation is limited to educational diagrams related to your lesson or school topics.',
        code: 'NOT_EDUCATIONAL',
      },
      { status: 403 },
    )
  }

  // Precise labeled diagrams (number lines, etc.): deterministic SVG beats FLUX text.
  const specialized = trySpecializedEduSvg(prompt, topic)
  if (specialized) {
    console.info('[ai/image] ok svg-precise', specialized.kind)
    const payload: ImageSuccess = {
      imageUrl: specialized.imageUrl,
      provider: 'svg-precise',
      model: specialized.kind,
      caption: specialized.caption,
    }
    return NextResponse.json(payload)
  }

  const eduPrompt = await refinePromptViaGroq({ prompt, topic, subject, purpose })
  console.info('[ai/image] prompt', eduPrompt.slice(0, 180))
  const keys = nvidiaKeys()
  const models = nvidiaModels()

  for (let ki = 0; ki < keys.length; ki++) {
    const stage = ki === 0 ? 'nvidia-primary' : 'nvidia-fallback'
    for (const model of models) {
      try {
        const imageUrl = await callNvidiaGenai(keys[ki], model, eduPrompt)
        console.info('[ai/image] ok', stage, model)
        const payload: ImageSuccess = {
          imageUrl,
          provider: stage,
          model,
        }
        return NextResponse.json(payload)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        console.warn('[ai/image] stage failed', stage, model, msg.slice(0, 160))
      }
    }
  }

  const diagram = await generateSvgViaGroq(prompt, topic)
  const fallback: SvgFallback = {
    fallback: 'svg',
    diagram,
    provider: 'svg-fallback',
    caption: 'Illustration unavailable — showing a structured diagram instead.',
  }
  console.info('[ai/image] ok svg-fallback')
  return NextResponse.json(fallback)
}

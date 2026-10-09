/**
 * Education-only image generation helpers for /api/ai/image.
 * Keeps NVIDIA keys server-side; never log full secrets.
 */

export type NoteDiagramType = 'process' | 'hierarchy' | 'cycle' | 'compare' | 'concept-map'

export type EduDiagram = {
  type: NoteDiagramType
  title: string
  caption?: string
  nodes: Array<{ id: string; label: string; detail?: string }>
  edges?: Array<{ from: string; to: string; label?: string }>
}

const BLOCKED_PATTERNS =
  /\b(celebrity|celebrities|nude|nsfw|porn|sexual|gore|weapon|gun|kill|assassin|terror|drug|cocaine|meth|hate\s*speech|racist|swastika|deepfake|onlyfans|dating\s*app|meme\s*of\s*(trump|modi|biden)|logo\s*of\s*(nike|adidas|apple\s*inc)|brand\s*logo)\b/i

const EDU_HINTS =
  /\b(explain|diagram|figure|illustrat|visual|process|cycle|concept|map|structure|photosynthesis|equation|molecule|atom|cell|organ|anatomy|circuit|force|motion|triangle|theorem|history|map of|timeline|flow|compare|contrast|board|exam|jee|neet|ncert|class\s*\d|grade|chapter|lesson|science|math|physics|chemistry|biology|geography|economics|number\s*line|fraction|rational|integer|algebra|geometry|solar\s*system|planet|orbit|astronomy|galaxy|electric\s*field|magnet)\b/i

const EXPLICIT_IMAGE =
  /\b(generate|draw|create|show|make|illustrate|sketch)\b.{0,40}\b(image|picture|diagram|figure|illustration|visual|chart)\b|\b(image|picture|diagram|figure|illustration)\b.{0,40}\b(of|for|showing)\b/i

const META_ASK =
  /^\s*(please\s+)?(can\s+you\s+)?(generate|draw|create|show|make|illustrate|sketch|give\s+me)\s+(an?\s+)?(image|picture|diagram|figure|illustration|visual|chart)\s+(of|for|showing|about)?\s*/i

export function wantsExplicitImage(text: string): boolean {
  return EXPLICIT_IMAGE.test(text)
}

/** Strip "generate image of …" wrappers so the model sees the real subject. */
export function extractVisualSubject(raw: string): string {
  let text = raw.trim()
  text = text.replace(META_ASK, '').trim()
  text = text
    .replace(/^(an?\s+)?(image|picture|diagram|figure|illustration)\s+(of|for|showing)\s+/i, '')
    .trim()
  return text || raw.trim()
}

export function looksEducational(text: string, topic?: string, subject?: string): boolean {
  const blob = `${topic || ''} ${subject || ''} ${text}`.trim()
  if (!blob) return false
  if (BLOCKED_PATTERNS.test(blob)) return false
  if (EDU_HINTS.test(blob)) return true
  // Explicit image asks during a lesson always count as educational when topic/subject exists.
  if (
    ((topic && topic.length > 2) || (subject && subject.length > 2)) &&
    (EXPLICIT_IMAGE.test(text) || META_ASK.test(text))
  ) {
    return true
  }
  if ((topic && topic.length > 2) || (subject && subject.length > 2)) {
    return !BLOCKED_PATTERNS.test(blob)
  }
  return false
}

/** Subject-specific layout hints from the ASK (not the lesson title). */
export function diagramStyleHint(subjectText: string, topic?: string): string {
  const blob = `${subjectText} ${topic || ''}`.toLowerCase()

  if (/\b(number\s*line|on\s+(a\s+)?(number\s*)?line)\b/.test(blob)) {
    return [
      'Draw ONE horizontal number line as the main figure.',
      'Show a straight black line with arrowheads on both ends.',
      'Mark and clearly label the ticks the student requested.',
      'Do NOT draw random boxes, mind maps, posters, or decorative scenes.',
    ].join(' ')
  }

  if (/\b(photosynthesis|chloroplast|leaf)\b/.test(blob)) {
    return 'Draw a labeled biological process diagram with arrows showing inputs/outputs (CO2, H2O, sunlight → glucose, O2). Clear part labels.'
  }

  if (/\b(cell|mitochondria|nucleus|organelle|membrane)\b/.test(blob)) {
    return 'Draw a labeled scientific cross-section diagram of the structure with arrows pointing to named parts. Textbook style.'
  }

  if (/\b(cycle|water\s*cycle|rock\s*cycle|carbon\s*cycle|krebs|nitrogen)\b/.test(blob)) {
    return 'Draw a circular cycle diagram with 4–6 labeled stages and curved arrows connecting them in order.'
  }

  if (/\b(circuit|resistor|current|voltage|ohm)\b/.test(blob)) {
    return 'Draw a clean electrical circuit schematic with standard symbols and labels for each component.'
  }

  if (/\b(triangle|circle|angle|geometry|pythagoras|coordinate)\b/.test(blob)) {
    return 'Draw a precise geometry figure with labeled vertices, sides, and angles. Use ruler-straight lines.'
  }

  if (/\b(compare|versus|vs\.?|difference)\b/.test(blob)) {
    return 'Draw a two-column comparison diagram with clear headings and 3–5 labeled points each side.'
  }

  if (/\b(flow|process|steps|how\s+.+\s+works)\b/.test(blob)) {
    return 'Draw a left-to-right process flowchart with 4–6 labeled boxes and arrows between them.'
  }

  if (/\b(solar\s*system|planets?|orbit)\b/.test(blob)) {
    return 'Draw a labeled solar-system schematic: bright yellow Sun at center, concentric orbital circles, colored planet dots with clear English name labels (Mercury through Neptune). High contrast, not blank, not photorealistic space photo.'
  }

  return 'Draw a clear textbook diagram that directly illustrates the requested concept with readable labels on every important part. Must be high-contrast and fill most of the frame — never return a blank white image.'
}

export function buildEduImagePrompt(input: {
  prompt: string
  topic?: string
  subject?: string
  purpose: 'chat' | 'notes'
}): string {
  const topic = input.topic?.trim() || ''
  const subject = input.subject?.trim() || ''
  const focus = extractVisualSubject(input.prompt).slice(0, 900)
  // Style from the ask only — lesson topic must not force a wrong diagram type.
  const style = diagramStyleHint(focus)
  const topicHint =
    topic && !focus.toLowerCase().includes(topic.toLowerCase())
      ? `Optional lesson context (do NOT override the primary request): ${topic}.`
      : ''

  return [
    `Primary request (follow exactly, unique to this ask): illustrate "${focus}".`,
    `Create a NEW diagram for this request only — do not reuse a generic lesson poster.`,
    subject ? `School subject: ${subject}.` : '',
    topicHint,
    style,
    'Style: NCERT / school textbook diagram, flat vector look, pure white background, dark black outlines, high contrast colored labels.',
    'Typography: large readable printed English labels in black or dark navy — never white text on white, no blurry text, no watermark.',
    'Accuracy: every label must match the requested concept; do not invent unrelated objects or scenery; fill the frame with the diagram (not empty whitespace).',
    'Forbidden: blank/empty canvas, photorealistic people, celebrities, brands, logos, violence, NSFW, decorative posters, random abstract art.',
    input.purpose === 'notes' ? 'Use case: study notes figure.' : 'Use case: chat explanation figure.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildFallbackDiagram(prompt: string, topic?: string): EduDiagram {
  const focus = extractVisualSubject(prompt)
  const title = (focus || topic || 'Concept overview').slice(0, 80)
  const words = focus
    .replace(/[^\w\s+-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6)

  const skip =
    /^(generate|image|picture|diagram|figure|show|make|create|draw|of|for|the|and|with)$/i
  const labels = words.filter((w) => !skip.test(w)).slice(0, 5)
  const nodesSource =
    labels.length >= 3
      ? labels
      : focus
        ? [focus.slice(0, 40), 'Key idea', 'Example', 'Remember']
        : ['Start', 'Key idea', 'Process', 'Result']

  const nodes = nodesSource.map((label, i) => ({
    id: `n${i + 1}`,
    label: label.slice(0, 40),
    detail: i === 0 ? title : undefined,
  }))
  const edges = nodes.slice(0, -1).map((n, i) => ({
    from: n.id,
    to: nodes[i + 1].id,
  }))
  return {
    type: 'process',
    title,
    caption: 'Structured diagram (image API unavailable)',
    nodes,
    edges,
  }
}

export function parseDiagramJson(raw: string): EduDiagram | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
    const type = (
      ['process', 'hierarchy', 'cycle', 'compare', 'concept-map'] as NoteDiagramType[]
    ).includes(obj.type as NoteDiagramType)
      ? (obj.type as NoteDiagramType)
      : 'process'
    const title = typeof obj.title === 'string' ? obj.title.trim() : ''
    const nodesRaw = Array.isArray(obj.nodes) ? obj.nodes : []
    const nodes = nodesRaw
      .map((n, i) => {
        if (!n || typeof n !== 'object') return null
        const node = n as Record<string, unknown>
        const label = typeof node.label === 'string' ? node.label.trim() : ''
        if (!label) return null
        return {
          id: typeof node.id === 'string' && node.id.trim() ? node.id.trim() : `n${i + 1}`,
          label,
          detail: typeof node.detail === 'string' ? node.detail.trim() : undefined,
        }
      })
      .filter(Boolean) as EduDiagram['nodes']
    if (!title || nodes.length < 2) return null
    const edges = Array.isArray(obj.edges)
      ? (obj.edges
          .map((e) => {
            if (!e || typeof e !== 'object') return null
            const edge = e as Record<string, unknown>
            const from = typeof edge.from === 'string' ? edge.from : ''
            const to = typeof edge.to === 'string' ? edge.to : ''
            if (!from || !to) return null
            return {
              from,
              to,
              label: typeof edge.label === 'string' ? edge.label : undefined,
            }
          })
          .filter(Boolean) as EduDiagram['edges'])
      : undefined
    return {
      type,
      title,
      caption: typeof obj.caption === 'string' ? obj.caption.trim() : undefined,
      nodes: nodes.slice(0, 10),
      edges,
    }
  } catch {
    return null
  }
}

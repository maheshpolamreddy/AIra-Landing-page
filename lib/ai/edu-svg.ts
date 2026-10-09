/**
 * Deterministic educational SVG diagrams.
 * Used when label accuracy matters more than photorealistic generation.
 * Detection is always based on the student PROMPT (never lesson topic alone).
 */

import { extractVisualSubject } from '@/lib/ai/edu-image'

export type SvgImageResult = {
  imageUrl: string
  caption: string
  kind:
    | 'number-line'
    | 'water-cycle'
    | 'photosynthesis'
    | 'circuit'
    | 'solar-system'
    | 'generic-svg'
}

/** Prefer base64 — utf-8 data URLs often render as blank white boxes in <img>. */
function svgDataUrl(svg: string): string {
  const compact = svg.replace(/\r\n/g, '\n').trim()
  return `data:image/svg+xml;base64,${Buffer.from(compact, 'utf8').toString('base64')}`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function focusOf(prompt: string): string {
  return extractVisualSubject(prompt).toLowerCase()
}

/** Detect asks that need a precise number-line figure (prompt only). */
export function wantsNumberLine(prompt: string, _topic?: string): boolean {
  const focus = focusOf(prompt)
  if (/\bnumber\s*line\b/.test(focus)) return true
  if (/\b(plot|mark|place|show)\b.{0,40}\b(on\s+)?(a\s+)?(number\s*)?line\b/.test(focus)) {
    return true
  }
  if (
    /\b(rational|integer|fraction|real)\s+numbers?\b/.test(focus) &&
    /\b(line|ticks?|axis)\b/.test(focus)
  ) {
    return true
  }
  return false
}

export function wantsWaterCycle(prompt: string): boolean {
  return /\bwater\s*cycle\b/.test(focusOf(prompt))
}

export function wantsPhotosynthesis(prompt: string): boolean {
  return /\bphotosynthesis\b/.test(focusOf(prompt))
}

export function wantsCircuit(prompt: string): boolean {
  const f = focusOf(prompt)
  return /\b(electric\s*)?circuit\b/.test(f) || /\bseries\s+circuit\b|\bparallel\s+circuit\b/.test(f)
}

export function wantsSolarSystem(prompt: string): boolean {
  const f = focusOf(prompt)
  return (
    /\bsolar\s*system\b/.test(f) ||
    /\b(planets?\s+around\s+(the\s+)?sun|sun\s+and\s+planets)\b/.test(f) ||
    (/\b(mercury|venus|earth|mars|jupiter|saturn|uranus|neptune)\b/.test(f) &&
      /\b(orbit|planet|solar)\b/.test(f))
  )
}

function parseToken(tok: string): number {
  if (tok.includes('/')) {
    const [a, b] = tok.split('/').map(Number)
    if (!b) return NaN
    return a / b
  }
  return Number(tok)
}

function parseRequestedMarks(prompt: string): number[] | null {
  const focus = extractVisualSubject(prompt)

  const range = focus.match(
    /\bfrom\s+(-?\d+(?:\/\d+)?)\s+to\s+(-?\d+(?:\/\d+)?)/i,
  )
  if (range) {
    const a = parseToken(range[1])
    const b = parseToken(range[2])
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) {
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      const marks: number[] = []
      const step = hi - lo <= 2 ? 0.5 : 1
      for (let v = lo; v <= hi + 1e-9; v += step) {
        marks.push(Math.round(v * 1000) / 1000)
      }
      if (!marks.includes(0) && lo < 0 && hi > 0) marks.push(0)
      return [...new Set(marks)].sort((x, y) => x - y)
    }
  }

  const found = focus.match(/-?\d+(?:\/\d+)?/g)
  if (!found || found.length < 3) return null
  const vals = found.map(parseToken).filter((n) => Number.isFinite(n))
  const uniq = [...new Set(vals)].sort((a, b) => a - b)
  return uniq.length >= 3 ? uniq : null
}

function formatMark(n: number): string {
  if (Number.isInteger(n)) return String(n)
  const table: Record<string, string> = {
    '-0.5': '-1/2',
    '0.5': '1/2',
    '-1.5': '-3/2',
    '1.5': '3/2',
    '-0.25': '-1/4',
    '0.25': '1/4',
    '-0.75': '-3/4',
    '0.75': '3/4',
  }
  const key = String(n)
  if (table[key]) return table[key]
  for (const den of [2, 3, 4, 5, 8]) {
    const num = Math.round(n * den)
    if (Math.abs(num / den - n) < 1e-9) {
      const g = gcd(Math.abs(num), den)
      const nn = num / g
      const dd = den / g
      return dd === 1 ? String(nn) : `${nn}/${dd}`
    }
  }
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function buildNumberLineSvg(prompt: string, topic?: string): SvgImageResult {
  const requested = parseRequestedMarks(prompt)
  const marks =
    requested && requested.length >= 3
      ? requested
      : [-2, -1, -0.5, 0, 0.5, 1, 2]

  const min = Math.min(...marks)
  const max = Math.max(...marks)
  const pad = Math.max(0.5, (max - min) * 0.08)
  const domainMin = min - pad
  const domainMax = max + pad
  const span = domainMax - domainMin || 1

  const W = 960
  const H = 280
  const left = 56
  const right = W - 56
  const y = 140
  const usable = right - left
  const xOf = (v: number) => left + ((v - domainMin) / span) * usable

  const title = escapeXml(
    /\brational\b/i.test(prompt)
      ? 'Number Line — Rational Numbers'
      : topic?.trim() && /\bnumber\s*line\b/i.test(topic)
        ? `Number Line — ${topic.trim()}`
        : 'Number Line',
  )

  const ticks = marks
    .map((v) => {
      const x = xOf(v)
      const label = escapeXml(formatMark(v))
      const isZero = Math.abs(v) < 1e-9
      return `
      <line x1="${x}" y1="${y - (isZero ? 18 : 12)}" x2="${x}" y2="${y + (isZero ? 18 : 12)}" stroke="#111" stroke-width="${isZero ? 2.5 : 2}"/>
      <text x="${x}" y="${y + 42}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="18" fill="#111">${label}</text>
      ${isZero ? `<circle cx="${x}" cy="${y}" r="4.5" fill="#1d4ed8"/>` : ''}`
    })
    .join('')

  const minors: string[] = []
  for (let v = Math.ceil(domainMin); v <= Math.floor(domainMax); v++) {
    for (const f of [0.25, 0.5, 0.75]) {
      const mv = v + f
      if (mv <= domainMin || mv >= domainMax) continue
      if (marks.some((m) => Math.abs(m - mv) < 1e-9)) continue
      const x = xOf(mv)
      minors.push(
        `<line x1="${x}" y1="${y - 7}" x2="${x}" y2="${y + 7}" stroke="#666" stroke-width="1.25"/>`,
      )
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${W / 2}" y="42" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" fill="#0f172a">${title}</text>
  <text x="${W / 2}" y="68" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#475569">Labeled ticks match your request · textbook style</text>
  <line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#111" stroke-width="3" stroke-linecap="round"/>
  <polygon points="${left - 14},${y} ${left + 6},${y - 9} ${left + 6},${y + 9}" fill="#111"/>
  <polygon points="${right + 14},${y} ${right - 6},${y - 9} ${right - 6},${y + 9}" fill="#111"/>
  ${minors.join('\n')}
  ${ticks}
  <text x="${left}" y="${H - 28}" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#64748b">← negative</text>
  <text x="${right}" y="${H - 28}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#64748b">positive →</text>
</svg>`

  return {
    imageUrl: svgDataUrl(svg),
    caption: `Textbook number line for: ${extractVisualSubject(prompt).slice(0, 120)}`,
    kind: 'number-line',
  }
}

export function buildWaterCycleSvg(prompt: string): SvgImageResult {
  const stages = [
    { x: 480, y: 70, label: 'Evaporation' },
    { x: 780, y: 180, label: 'Condensation' },
    { x: 620, y: 340, label: 'Precipitation' },
    { x: 280, y: 340, label: 'Collection' },
    { x: 180, y: 180, label: 'Transpiration' },
  ]
  const nodes = stages
    .map(
      (s) => `
    <circle cx="${s.x}" cy="${s.y}" r="52" fill="#e0f2fe" stroke="#0369a1" stroke-width="2.5"/>
    <text x="${s.x}" y="${s.y + 5}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#0c4a6e">${escapeXml(s.label)}</text>`,
    )
    .join('')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="440" viewBox="0 0 960 440" role="img" aria-label="Water Cycle">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="480" y="36" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" fill="#0f172a">Water Cycle</text>
  <path d="M520 90 Q700 90 760 150" fill="none" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>
  <path d="M760 220 Q760 300 660 320" fill="none" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>
  <path d="M560 360 Q420 390 320 360" fill="none" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>
  <path d="M240 300 Q180 250 190 220" fill="none" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>
  <path d="M210 140 Q320 80 430 85" fill="none" stroke="#0284c7" stroke-width="2.5" marker-end="url(#arrow)"/>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#0284c7"/>
    </marker>
  </defs>
  ${nodes}
  <text x="480" y="420" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#475569">Continuous cycle of water on Earth · textbook diagram</text>
</svg>`

  return {
    imageUrl: svgDataUrl(svg),
    caption: `Water cycle diagram for: ${extractVisualSubject(prompt).slice(0, 120)}`,
    kind: 'water-cycle',
  }
}

export function buildPhotosynthesisSvg(prompt: string): SvgImageResult {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420" role="img" aria-label="Photosynthesis">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="480" y="36" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" fill="#0f172a">Photosynthesis</text>
  <rect x="300" y="120" width="360" height="160" rx="16" fill="#ecfdf5" stroke="#047857" stroke-width="2.5"/>
  <text x="480" y="175" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#065f46">Leaf / Chloroplast</text>
  <text x="480" y="205" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#065f46">Chlorophyll traps light energy</text>
  <text x="480" y="235" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#065f46">6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂</text>

  <rect x="40" y="80" width="160" height="54" rx="10" fill="#fef9c3" stroke="#ca8a04" stroke-width="2"/>
  <text x="120" y="112" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#854d0e">Sunlight</text>
  <rect x="40" y="170" width="160" height="54" rx="10" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
  <text x="120" y="202" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#075985">CO₂ (air)</text>
  <rect x="40" y="260" width="160" height="54" rx="10" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>
  <text x="120" y="292" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#1e40af">H₂O (roots)</text>

  <rect x="760" y="150" width="160" height="54" rx="10" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/>
  <text x="840" y="182" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#166534">Glucose</text>
  <rect x="760" y="240" width="160" height="54" rx="10" fill="#f0fdf4" stroke="#22c55e" stroke-width="2"/>
  <text x="840" y="272" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="#166534">O₂ (released)</text>

  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#334155"/>
    </marker>
  </defs>
  <line x1="200" y1="107" x2="300" y2="150" stroke="#334155" stroke-width="2" marker-end="url(#arr)"/>
  <line x1="200" y1="197" x2="300" y2="190" stroke="#334155" stroke-width="2" marker-end="url(#arr)"/>
  <line x1="200" y1="287" x2="300" y2="230" stroke="#334155" stroke-width="2" marker-end="url(#arr)"/>
  <line x1="660" y1="180" x2="760" y2="177" stroke="#334155" stroke-width="2" marker-end="url(#arr)"/>
  <line x1="660" y1="230" x2="760" y2="267" stroke="#334155" stroke-width="2" marker-end="url(#arr)"/>
  <text x="480" y="390" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#475569">Inputs → process in leaf → outputs · textbook diagram</text>
</svg>`

  return {
    imageUrl: svgDataUrl(svg),
    caption: `Photosynthesis diagram for: ${extractVisualSubject(prompt).slice(0, 120)}`,
    kind: 'photosynthesis',
  }
}

export function buildCircuitSvg(prompt: string): SvgImageResult {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="360" viewBox="0 0 960 360" role="img" aria-label="Simple Electric Circuit">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="480" y="36" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" fill="#0f172a">Simple Electric Circuit</text>
  <!-- wires -->
  <path d="M180 120 H780 V260 H180 Z" fill="none" stroke="#111" stroke-width="3"/>
  <!-- battery -->
  <line x1="170" y1="160" x2="170" y2="220" stroke="#111" stroke-width="6"/>
  <line x1="190" y1="145" x2="190" y2="235" stroke="#111" stroke-width="3"/>
  <text x="180" y="270" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#111">Battery (cell)</text>
  <!-- switch -->
  <circle cx="360" cy="120" r="6" fill="#111"/>
  <line x1="360" y1="120" x2="420" y2="95" stroke="#111" stroke-width="3"/>
  <circle cx="440" cy="120" r="6" fill="#111"/>
  <text x="400" y="85" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#111">Switch</text>
  <!-- bulb -->
  <circle cx="620" cy="120" r="28" fill="#fef9c3" stroke="#111" stroke-width="2.5"/>
  <line x1="605" y1="105" x2="635" y2="135" stroke="#111" stroke-width="2"/>
  <line x1="635" y1="105" x2="605" y2="135" stroke="#111" stroke-width="2"/>
  <text x="620" y="85" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#111">Bulb</text>
  <!-- resistor -->
  <path d="M400 260 l20 -14 20 28 20 -28 20 28 20 -28 20 14" fill="none" stroke="#111" stroke-width="3"/>
  <text x="480" y="300" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#111">Resistor</text>
  <text x="480" y="340" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#475569">Closed loop: cell → switch → bulb → resistor → cell</text>
</svg>`

  return {
    imageUrl: svgDataUrl(svg),
    caption: `Circuit diagram for: ${extractVisualSubject(prompt).slice(0, 120)}`,
    kind: 'circuit',
  }
}

export function buildSolarSystemSvg(prompt: string): SvgImageResult {
  const cx = 480
  const cy = 250
  const planets = [
    { name: 'Mercury', r: 70, size: 5, color: '#a8a29e' },
    { name: 'Venus', r: 100, size: 8, color: '#f59e0b' },
    { name: 'Earth', r: 135, size: 9, color: '#2563eb' },
    { name: 'Mars', r: 170, size: 7, color: '#dc2626' },
    { name: 'Jupiter', r: 220, size: 16, color: '#d97706' },
    { name: 'Saturn', r: 270, size: 14, color: '#ca8a04' },
    { name: 'Uranus', r: 315, size: 11, color: '#22d3ee' },
    { name: 'Neptune', r: 360, size: 11, color: '#1d4ed8' },
  ]

  const orbits = planets
    .map(
      (p) =>
        `<circle cx="${cx}" cy="${cy}" r="${p.r}" fill="none" stroke="#94a3b8" stroke-width="1.25" stroke-dasharray="4 3"/>`,
    )
    .join('\n')

  const bodies = planets
    .map((p, i) => {
      // Place planets at different angles so they don't overlap visually
      const angle = (-Math.PI / 2) + i * 0.55
      const x = cx + p.r * Math.cos(angle)
      const y = cy + p.r * Math.sin(angle)
      const labelY = y + (angle > 0 && angle < Math.PI ? 18 : -12)
      return `
      <circle cx="${x}" cy="${y}" r="${p.size}" fill="${p.color}" stroke="#0f172a" stroke-width="1"/>
      <text x="${x}" y="${labelY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="600" fill="#0f172a">${escapeXml(p.name)}</text>`
    })
    .join('\n')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="520" viewBox="0 0 960 520" role="img" aria-label="Solar System">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <text x="480" y="36" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="700" fill="#0f172a">Solar System</text>
  <text x="480" y="58" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#475569">Sun at center · planets on orbits (not to scale)</text>
  ${orbits}
  <circle cx="${cx}" cy="${cy}" r="28" fill="#facc15" stroke="#ca8a04" stroke-width="2"/>
  <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="#713f12">Sun</text>
  ${bodies}
  <text x="480" y="500" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#64748b">Textbook schematic · sizes and distances are not to scale</text>
</svg>`

  return {
    imageUrl: svgDataUrl(svg),
    caption: `Solar system diagram for: ${extractVisualSubject(prompt).slice(0, 120)}`,
    kind: 'solar-system',
  }
}

/**
 * If the ask maps to a specialized accurate SVG, return it; else null (use NVIDIA).
 */
export function trySpecializedEduSvg(
  prompt: string,
  topic?: string,
): SvgImageResult | null {
  if (wantsNumberLine(prompt, topic)) return buildNumberLineSvg(prompt, topic)
  if (wantsSolarSystem(prompt)) return buildSolarSystemSvg(prompt)
  if (wantsWaterCycle(prompt)) return buildWaterCycleSvg(prompt)
  if (wantsPhotosynthesis(prompt)) return buildPhotosynthesisSvg(prompt)
  if (wantsCircuit(prompt)) return buildCircuitSvg(prompt)
  return null
}

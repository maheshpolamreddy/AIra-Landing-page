import type { TeachingSegmentDoc, TeachingStepDoc } from './types'

const VISUAL_MARKER_REGEX = /\[VISUAL:([^\]]+)\]/g

export interface ParsedSpeechSegment {
  segmentId: string
  sequence: number
  stepId: string
  narration: string
  visualMarker?: string
  markerOnly: boolean
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

/**
 * Split spoken content into segments aligned with [VISUAL:...] markers.
 * Marker-only segments fire visuals without TTS; narration segments are speakable text.
 */
export function buildSegmentsFromSpokenContent(
  step: TeachingStepDoc,
  stepIndex: number,
): ParsedSpeechSegment[] {
  const raw = step.spokenContent || ''
  const segments: ParsedSpeechSegment[] = []
  let last = 0
  let seq = 0
  let match: RegExpExecArray | null
  const re = new RegExp(VISUAL_MARKER_REGEX.source, 'g')

  while ((match = re.exec(raw)) !== null) {
    const before = raw.substring(last, match.index).replace(VISUAL_MARKER_REGEX, '').trim()
    if (before) {
      segments.push({
        segmentId: `${step.id}-seg-${seq}`,
        sequence: seq++,
        stepId: step.id,
        narration: before,
        markerOnly: false,
      })
    }
    segments.push({
      segmentId: `${step.id}-marker-${seq}`,
      sequence: seq++,
      stepId: step.id,
      narration: '',
      visualMarker: match[1].trim(),
      markerOnly: true,
    })
    last = match.index + match[0].length
  }

  const trail = raw.substring(last).replace(VISUAL_MARKER_REGEX, '').trim()
  if (trail) {
    segments.push({
      segmentId: `${step.id}-seg-${seq}`,
      sequence: seq++,
      stepId: step.id,
      narration: trail,
      markerOnly: false,
    })
  }

  if (segments.length === 0 && raw.trim()) {
    segments.push({
      segmentId: `${step.id}-seg-0`,
      sequence: 0,
      stepId: step.id,
      narration: raw.replace(VISUAL_MARKER_REGEX, '').trim(),
      markerOnly: false,
    })
  }

  // Re-sequence globally if multiple steps
  return segments.map((s, i) => ({
    ...s,
    segmentId: `${slugify(step.id)}-${i}`,
    sequence: stepIndex * 100 + i,
  }))
}

export function buildAllSegments(steps: TeachingStepDoc[]): ParsedSpeechSegment[] {
  return steps.flatMap((step, i) => buildSegmentsFromSpokenContent(step, i))
}

export function validateSpeakableScript(spoken: string): { ok: boolean; reason?: string } {
  const text = spoken.replace(VISUAL_MARKER_REGEX, '').trim()
  if (text.length < 200) return { ok: false, reason: 'Script too short' }
  if (/^#{1,6}\s/m.test(text)) return { ok: false, reason: 'Contains markdown headings' }
  if (text.split(/\s+/).length < 80) return { ok: false, reason: 'Insufficient word count' }
  return { ok: true }
}

export function validateMarkersAgainstRegistry(
  spoken: string,
  allowedKeys: string[],
): { ok: boolean; invalid: string[] } {
  const allowed = new Set(allowedKeys.map((k) => k.toLowerCase()))
  const invalid: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(VISUAL_MARKER_REGEX.source, 'g')
  while ((match = re.exec(spoken)) !== null) {
    const key = match[1].trim().split('.').slice(0, 2).join('.').toLowerCase()
    if (allowed.size > 0 && !allowed.has(key)) {
      invalid.push(match[1].trim())
    }
  }
  return { ok: invalid.length === 0, invalid }
}

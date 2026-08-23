import type {
  CurriculumTopicDoc,
  TeachingSegmentDoc,
  TeachingStepDoc,
  VisualActionType,
  VisualRegistrySnapshot,
} from './types'

const SEGMENT_BLOCK_REGEX = /<SEGMENT([^>]*)>([\s\S]*?)<\/SEGMENT>/gi

export interface ParsedXmlSegment {
  visualMarker: string
  highlightTarget: string
  visualAction: VisualActionType
  text: string
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
}

function parseSegmentAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(attrStr)) !== null) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

export function normalizeHighlightTarget(raw: string, diagramKeys: string[]): string {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  const match = diagramKeys.find((k) => k.toLowerCase() === lower || k.toLowerCase().startsWith(lower))
  return match || trimmed
}

export function isValidHighlightTarget(target: string, diagramKeys: string[]): boolean {
  if (!target?.trim()) return false
  if (!diagramKeys.length) return false
  const base = target.split('.').slice(0, 2).join('.').toLowerCase()
  return diagramKeys.some((k) => {
    const kl = k.toLowerCase()
    return kl === target.toLowerCase() || kl.startsWith(base) || kl === base
  })
}

export function assertValidHighlightTarget(
  target: string,
  diagramKeys: string[],
  topicId: string,
  context: string,
): string {
  const normalized = normalizeHighlightTarget(target, diagramKeys)
  if (!isValidHighlightTarget(normalized, diagramKeys)) {
    throw new Error(`Invalid highlightTarget "${target}" (${context}) for topic ${topicId}`)
  }
  return normalized
}

export function parseXmlSegments(raw: string): ParsedXmlSegment[] {
  const segments: ParsedXmlSegment[] = []
  let match: RegExpExecArray | null
  SEGMENT_BLOCK_REGEX.lastIndex = 0
  while ((match = SEGMENT_BLOCK_REGEX.exec(raw)) !== null) {
    const attrs = parseSegmentAttributes(match[1])
    const visualMarker = attrs.visualMarker?.trim() || ''
    const highlightTarget = attrs.highlightTarget?.trim() || ''
    if (!visualMarker || !highlightTarget) continue
    const actionRaw = attrs.visualAction?.trim() || 'highlight'
    const visualAction = (actionRaw === 'show' || actionRaw === 'clear' ? actionRaw : 'highlight') as VisualActionType
    segments.push({
      visualMarker,
      highlightTarget,
      visualAction,
      text: match[2].trim().replace(/\[VISUAL:[^\]]+\]/g, '').trim(),
    })
  }
  return segments
}

export function buildVisualRegistrySnapshot(topic: CurriculumTopicDoc): VisualRegistrySnapshot {
  if (!topic.diagramKeys?.length) {
    throw new Error(`Topic ${topic.topicId} has no diagramKeys — cannot build visual registry snapshot`)
  }
  return {
    topicId: topic.topicId,
    diagramKeys: topic.diagramKeys,
    visualRegistryVersion: topic.visualRegistryVersion ?? 1,
  }
}

export function buildSegmentsFromXml(
  xmlSegments: ParsedXmlSegment[],
  step: TeachingStepDoc,
  topic: CurriculumTopicDoc,
  language: string,
): TeachingSegmentDoc[] {
  const diagramKeys = topic.diagramKeys || []
  if (!diagramKeys.length) {
    throw new Error(`Topic ${topic.topicId} has no diagramKeys`)
  }
  const docs: TeachingSegmentDoc[] = []

  xmlSegments.forEach((seg, i) => {
    const highlightTarget = assertValidHighlightTarget(
      seg.highlightTarget,
      diagramKeys,
      topic.topicId,
      `segment ${i + 1}`,
    )
    docs.push({
      segmentId: `seg-${String(i + 1).padStart(3, '0')}`,
      sequence: i,
      stepId: step.id,
      narration: seg.text,
      text: seg.text,
      visualMarker: seg.visualMarker || slugify(highlightTarget),
      visualAction: seg.visualAction,
      highlightTarget,
      language,
      audioVersion: 1,
      status: seg.text.trim() ? 'PENDING' : 'READY',
    })
  })

  return docs
}

/** Fallback: derive segments from spoken [VISUAL:...] markers when XML segments absent. */
export function buildSegmentsFromSpokenWithVisuals(
  step: TeachingStepDoc,
  topic: CurriculumTopicDoc,
  language: string,
): TeachingSegmentDoc[] {
  const raw = step.spokenContent || ''
  const re = /\[VISUAL:([^\]]+)\]/g
  const stripVisual = /\[VISUAL:[^\]]+\]/g
  const diagramKeys = topic.diagramKeys || []
  if (!diagramKeys.length) {
    throw new Error(`Topic ${topic.topicId} has no diagramKeys`)
  }
  const docs: TeachingSegmentDoc[] = []
  let last = 0
  let seq = 0
  let match: RegExpExecArray | null

  const pushSegment = (
    narration: string,
    highlightTargetRaw: string,
    markerOnly: boolean,
  ) => {
    const highlightTarget = assertValidHighlightTarget(
      highlightTargetRaw,
      diagramKeys,
      topic.topicId,
      `spoken segment ${seq + 1}`,
    )
    docs.push({
      segmentId: `seg-${String(seq + 1).padStart(3, '0')}`,
      sequence: seq++,
      stepId: step.id,
      narration,
      text: narration,
      visualMarker: slugify(highlightTarget),
      visualAction: 'highlight',
      highlightTarget,
      language,
      audioVersion: 1,
      status: markerOnly ? 'READY' : 'PENDING',
    })
  }

  while ((match = re.exec(raw)) !== null) {
    const before = raw.substring(last, match.index).replace(stripVisual, '').trim()
    const targetRaw = match[1].trim()
    if (before) {
      pushSegment(before, targetRaw, false)
    } else {
      pushSegment('', targetRaw, true)
    }
    last = match.index + match[0].length
  }

  const trail = raw.substring(last).replace(stripVisual, '').trim()
  if (trail) {
    pushSegment(trail, diagramKeys[0], false)
  }

  if (docs.length === 0 && raw.trim()) {
    pushSegment(raw.replace(stripVisual, '').trim(), diagramKeys[0], false)
  }

  return docs
}

/** After TTS, attach measured duration and visual action timeline. */
export function enrichSegmentWithAudioTimeline(
  segment: TeachingSegmentDoc,
  audioDurationSec: number,
): TeachingSegmentDoc {
  const durationMs = Math.round(audioDurationSec * 1000)
  return {
    ...segment,
    audioDuration: audioDurationSec,
    duration: audioDurationSec,
    visualActions: segment.visualActions?.length
      ? segment.visualActions.map((va) => ({
          ...va,
          endOffsetMs: va.endOffsetMs ?? durationMs,
        }))
      : segment.highlightTarget
        ? [{
            highlightTarget: segment.highlightTarget,
            action: segment.visualAction,
            startOffsetMs: 0,
            endOffsetMs: durationMs,
          }]
        : undefined,
  }
}

export function rebuildSpokenContentFromSegments(segments: TeachingSegmentDoc[]): string {
  return segments
    .filter((s) => s.narration?.trim() || s.highlightTarget)
    .map((s) => {
      const marker = s.highlightTarget ? `[VISUAL:${s.highlightTarget}] ` : ''
      return `${marker}${s.narration || ''}`.trim()
    })
    .join('\n\n')
}

import type {
  CurriculumTopicDoc,
  TeachingContentDoc,
  TeachingSegmentDoc,
  SupportedLanguage,
  TeachingStyle,
} from './types'

const GENERIC_FINGERPRINTS = [
  'in this lesson we will explore',
  'let us begin our journey',
  'welcome to today\'s comprehensive',
  'this is not just another topic',
]

export interface ValidationResult {
  passed: boolean
  errors: string[]
}

function isValidHighlightTarget(target: string, diagramKeys: string[]): boolean {
  if (!target?.trim()) return false
  if (!diagramKeys.length) return false
  const base = target.split('.').slice(0, 2).join('.').toLowerCase()
  return diagramKeys.some((k) => {
    const kl = k.toLowerCase()
    return kl === target.toLowerCase() || kl.startsWith(base) || kl === base
  })
}

export function validateSpeakableScript(spoken: string): ValidationResult {
  const errors: string[] = []
  const text = spoken.replace(/\[VISUAL:[^\]]+\]/g, '').trim()
  if (text.length < 200) errors.push('Script too short')
  if (/^#{1,6}\s/m.test(text)) errors.push('Contains markdown headings in narration')
  if (text.split(/\s+/).length < 80) errors.push('Insufficient word count')
  for (const fp of GENERIC_FINGERPRINTS) {
    if (text.toLowerCase().includes(fp)) errors.push(`Generic boilerplate detected: ${fp}`)
  }
  return { passed: errors.length === 0, errors }
}

export function validateLanguageScript(text: string, language: SupportedLanguage): ValidationResult {
  const errors: string[] = []
  if (language === 'hi-IN') {
    if (!/[\u0900-\u097F]/.test(text)) errors.push('Hindi script expected but not found')
  } else if (language === 'te-IN') {
    if (!/[\u0C00-\u0C7F]/.test(text)) errors.push('Telugu script expected but not found')
  }
  return { passed: errors.length === 0, errors }
}

export function validateSegmentsVisualSpeech(
  segments: TeachingSegmentDoc[],
  diagramKeys: string[],
): ValidationResult {
  const errors: string[] = []
  const narrationSegs = segments.filter((s) => s.narration?.trim())

  if (narrationSegs.length === 0) errors.push('No narration segments')

  for (const seg of segments) {
    if (!seg.visualMarker) errors.push(`Segment ${seg.segmentId} missing visualMarker`)
    if (!seg.visualAction) errors.push(`Segment ${seg.segmentId} missing visualAction`)
    if (!seg.highlightTarget) errors.push(`Segment ${seg.segmentId} missing highlightTarget`)
    else if (!isValidHighlightTarget(seg.highlightTarget, diagramKeys)) {
      errors.push(`Segment ${seg.segmentId} invalid highlightTarget: ${seg.highlightTarget}`)
    }
    if (seg.narration?.trim() && !seg.highlightTarget) {
      errors.push(`Segment ${seg.segmentId} has speech but no highlight target`)
    }
  }

  return { passed: errors.length === 0, errors }
}

export function validateContentBeforeReady(
  topic: CurriculumTopicDoc | null,
  content: TeachingContentDoc,
  segments: TeachingSegmentDoc[],
  expectedLanguage: SupportedLanguage,
  expectedStyle: TeachingStyle,
): ValidationResult {
  const errors: string[] = []
  const diagramKeys = content.visualRegistry?.diagramKeys || topic?.diagramKeys || []

  if (content.topicId !== topic?.topicId) errors.push('Topic ID mismatch')
  if (content.language !== expectedLanguage) errors.push('Language mismatch')
  if (content.teachingStyle !== expectedStyle) errors.push('Teaching style mismatch')
  if (!content.steps?.length) errors.push('No teaching steps')

  const spokenFromSteps = content.steps.map((s) => s.spokenContent).filter(Boolean).join(' ')
  const spokenFromSegments = segments.map((s) => s.narration).filter(Boolean).join(' ')
  const spoken = spokenFromSteps || spokenFromSegments
  const scriptCheck = validateSpeakableScript(spoken)
  if (!scriptCheck.passed) errors.push(...scriptCheck.errors)

  const langCheck = validateLanguageScript(spoken.replace(/\[VISUAL:[^\]]+\]/g, ''), expectedLanguage)
  if (!langCheck.passed) errors.push(...langCheck.errors)

  const visualCheck = validateSegmentsVisualSpeech(segments, diagramKeys)
  if (!visualCheck.passed) errors.push(...visualCheck.errors)

  const narrationSegs = segments.filter((s) => s.narration?.trim())
  for (const seg of narrationSegs) {
    if (seg.status !== 'READY') errors.push(`Segment ${seg.segmentId} not READY`)
    if (!seg.audioUrl && !seg.audioStoragePath) errors.push(`Segment ${seg.segmentId} missing audio`)
    if (!seg.duration && !seg.audioDuration) errors.push(`Segment ${seg.segmentId} missing duration`)
  }

  if (narrationSegs.length === 0) errors.push('No segments with audio')

  return { passed: errors.length === 0, errors }
}

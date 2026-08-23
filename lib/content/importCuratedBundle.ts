import {
  upsertCurriculumTopic,
  upsertTeachingContent,
  batchUpsertTeachingSegments,
} from '@/lib/content/firestore'
import { buildContentDocId } from '@/lib/content/cacheKeys'
import {
  buildSegmentsFromSpokenWithVisuals,
  buildVisualRegistrySnapshot,
  rebuildSpokenContentFromSegments,
} from '@/lib/content/visualTimelineBuilder'
import type { CurriculumTopicDoc, TeachingStepDoc, SupportedLanguage, TeachingStyle } from '@/lib/content/types'

export interface ImportCuratedInput {
  topic: CurriculumTopicDoc
  steps: TeachingStepDoc[]
  teachingStyle: TeachingStyle
  language: SupportedLanguage
  contentVersion: number
}

export interface ImportCuratedResult {
  contentDocId: string
  segments: number
  ttsSegmentIds: string[]
  topicId: string
  language: SupportedLanguage
  teachingStyle: TeachingStyle
  contentVersion: number
}

/** Shared import logic — runs in the content worker, not the landing HTTP process. */
export async function importCuratedBundle(input: ImportCuratedInput): Promise<ImportCuratedResult> {
  const { topic, steps, teachingStyle, language, contentVersion } = input

  await upsertCurriculumTopic({ ...topic, updatedAt: new Date().toISOString() })

  const step = { ...steps[0] }
  const segments = buildSegmentsFromSpokenWithVisuals(step, topic, language)
  step.spokenContent = rebuildSpokenContentFromSegments(segments)

  const contentDocId = buildContentDocId(topic.topicId, language, teachingStyle, contentVersion)

  // Parent doc: metadata only — full narration lives in segments subcollection.
  const stepMeta = {
    id: step.id,
    stepNumber: step.stepNumber,
    title: step.title,
    content: step.content,
    visualType: step.visualType,
    visualId: step.visualId,
    durationSeconds: step.durationSeconds,
    keyConcepts: step.keyConcepts,
  }

  await upsertTeachingContent(topic.topicId, language, teachingStyle, contentVersion, {
    status: 'SCRIPT_READY',
    scriptStatus: 'SCRIPT_READY',
    audioStatus: 'PENDING',
    overallStatus: 'GENERATING_TTS',
    activeVersion: true,
    scriptVersion: 1,
    generatedAt: new Date().toISOString(),
    segmentCount: segments.length,
    steps: [stepMeta],
    visualRegistry: buildVisualRegistrySnapshot(topic),
  })

  await batchUpsertTeachingSegments(contentDocId, segments)

  const ttsSegmentIds = segments.filter((seg) => seg.narration?.trim()).map((seg) => seg.segmentId)

  return {
    contentDocId,
    segments: segments.length,
    ttsSegmentIds,
    topicId: topic.topicId,
    language,
    teachingStyle,
    contentVersion,
  }
}

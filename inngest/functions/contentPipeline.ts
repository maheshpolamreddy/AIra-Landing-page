import { inngest } from '../client'
import {
  acquireGenerationLock,
  createGenerationJob,
  getCurriculumTopic,
  getTeachingContent,
  getTeachingSegments,
  getTeachingSegmentById,
  getSegmentAudioReadiness,
  markContentFailed,
  markStalePreviousVersions,
  releaseGenerationLock,
  extendGenerationLock,
  updateGenerationJob,
  upsertTeachingContent,
  upsertTeachingSegment,
  getAdminFirestore,
} from '@/lib/content/firestore'
import { buildContentDocId } from '@/lib/content/cacheKeys'
import { generateTeachingScriptWithRetry } from '@/lib/content/scriptGenerator'
import { synthesizeWithRetry } from '@/lib/content/ttsPipeline'
import { buildAudioStoragePath, uploadLessonAudio, getSignedAudioUrl } from '@/lib/content/storage'
import { validateContentBeforeReady } from '@/lib/content/validation'
import { enrichSegmentWithAudioTimeline } from '@/lib/content/visualTimelineBuilder'
import {
  DEFAULT_CONTENT_VERSION,
  SUPPORTED_LANGUAGES,
  TEACHING_STYLES,
  CONTENT_COLLECTION,
} from '@/lib/content/constants'
import type { SupportedLanguage, TeachingStyle, TeachingSegmentDoc, TeachingContentDoc } from '@/lib/content/types'

export const topicContentOrchestrator = inngest.createFunction(
  {
    id: 'topic-content-orchestrator',
    concurrency: { limit: 2 },
    triggers: { event: 'curriculum/topic.registered' },
  },
  async ({ event, step }) => {
    const { topicId, contentVersion = DEFAULT_CONTENT_VERSION } = event.data as {
      topicId: string
      contentVersion?: number
      styles?: string[]
      languages?: string[]
    }
    const styles = (event.data.styles || TEACHING_STYLES) as TeachingStyle[]
    const languages = (event.data.languages || SUPPORTED_LANGUAGES) as SupportedLanguage[]

    for (const language of languages) {
      for (const teachingStyle of styles) {
        await step.sendEvent(`gen-script-${topicId}-${language}-${teachingStyle}`, {
          name: 'content/generate.script',
          data: { topicId, language, teachingStyle, contentVersion },
        })
      }
    }

    return { queued: styles.length * languages.length, topicId }
  },
)

export const generateScript = inngest.createFunction(
  {
    id: 'generate-script',
    retries: 2,
    concurrency: { limit: 2 },
    triggers: { event: 'content/generate.script' },
  },
  async ({ event, step }) => {
    const { topicId, language, teachingStyle, contentVersion } = event.data as {
      topicId: string
      language: string
      teachingStyle: string
      contentVersion: number
    }
    const lang = language as SupportedLanguage
    const style = teachingStyle as TeachingStyle
    const contentDocId = buildContentDocId(topicId, lang, style, contentVersion)

    const existing = await step.run('check-existing', async () => {
      const doc = await getTeachingContent(topicId, lang, style, contentVersion)
      if (doc?.status === 'READY') return { skip: true as const, reason: 'already ready' }
      return { skip: false as const, doc }
    })

    if (existing.skip) return { skipped: true, reason: existing.reason }

    const jobId = await step.run('create-job', async () =>
      createGenerationJob({
        topicId,
        language: lang,
        teachingStyle: style,
        contentVersion,
        stage: 'script',
        status: 'running',
        retryCount: 0,
        startedAt: new Date().toISOString(),
      }),
    )

    const acquired = await step.run('acquire-lock', async () =>
      acquireGenerationLock(topicId, lang, style, contentVersion, jobId),
    )

    if (!acquired) {
      const doc = await getTeachingContent(topicId, lang, style, contentVersion)
      if (doc?.status === 'READY') return { skipped: true, reason: 'ready after lock race' }
      return { skipped: true, reason: 'lock held by another job' }
    }

    try {
      const topic = await step.run('load-topic', async () => {
        const t = await getCurriculumTopic(topicId)
        if (!t) throw new Error(`Topic not found: ${topicId}`)
        return t
      })

      const script = await step.run('generate-script-ai', async () =>
        generateTeachingScriptWithRetry(topic, style, lang),
      )

      const parsedSegments = script.segments

      await step.run('save-script', async () => {
        await upsertTeachingContent(topicId, lang, style, contentVersion, {
          status: 'SCRIPT_READY',
          scriptStatus: 'SCRIPT_READY',
          audioStatus: 'PENDING',
          overallStatus: 'GENERATING_TTS',
          activeVersion: true,
          scriptVersion: 1,
          generatedAt: new Date().toISOString(),
          segmentCount: parsedSegments.length,
          steps: script.steps,
          greetingTemplate: script.greetingTemplate,
          visualRegistry: script.visualRegistry,
        })

        for (const seg of parsedSegments) {
          await upsertTeachingSegment(contentDocId, seg)
        }
      })

      await step.run('update-job-script-done', async () =>
        updateGenerationJob(jobId, {
          status: 'completed',
          stage: 'script',
          completedAt: new Date().toISOString(),
        }),
      )

      for (const seg of parsedSegments) {
        if (!seg.narration?.trim()) continue
        await step.sendEvent(`tts-${seg.segmentId}`, {
          name: 'content/generate.tts',
          data: {
            topicId,
            language: lang,
            teachingStyle: style,
            contentVersion,
            contentDocId,
            segmentId: seg.segmentId,
            jobId,
          },
        })
      }

      // Publish is triggered by each TTS completion — not here (avoids premature publish storms).

      return { contentDocId, segments: parsedSegments.length }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await step.run('mark-script-failed', async () => {
        await markContentFailed(contentDocId, 'script', message)
        await updateGenerationJob(jobId, {
          status: 'failed',
          stage: 'script',
          error: message,
          completedAt: new Date().toISOString(),
        })
      })
      throw err
    }
  },
)

export const generateSegmentTts = inngest.createFunction(
  {
    id: 'generate-segment-tts',
    retries: 3,
    concurrency: { limit: 3 },
    triggers: { event: 'content/generate.tts' },
  },
  async ({ event, step }) => {
    const { contentDocId, segmentId, language, topicId, teachingStyle, contentVersion, jobId } = event.data as {
      contentDocId: string
      segmentId: string
      language: string
      topicId: string
      teachingStyle: string
      contentVersion: number
      jobId?: string
    }
    const lang = language as SupportedLanguage
    const style = teachingStyle as TeachingStyle

    const segment = await step.run('load-segment', async () => {
      const found = await getTeachingSegmentById(topicId, lang, style, contentVersion, segmentId)
      if (!found) throw new Error(`Segment not found: ${segmentId}`)
      if (found.status === 'READY' && (found.audioUrl || found.audioStoragePath)) {
        return { ...found, skip: true as const }
      }
      return found
    })

    if ('skip' in segment && segment.skip) {
      await step.sendEvent('publish-after-skip', {
        name: 'content/publish',
        data: { topicId, language: lang, teachingStyle: style, contentVersion, contentDocId, jobId },
      })
      return { skipped: true }
    }

    if (!segment.narration?.trim()) {
      await step.run('mark-marker-ready', async () => {
        await upsertTeachingSegment(contentDocId, {
          ...segment,
          status: 'READY',
        })
        if (jobId) await extendGenerationLock(contentDocId, jobId)
      })
      await step.sendEvent('publish-after-marker', {
        name: 'content/publish',
        data: { topicId, language: lang, teachingStyle: style, contentVersion, contentDocId, jobId },
      })
      return { markerOnly: true }
    }

    try {
      await step.run('set-generating-audio', async () => {
        await upsertTeachingContent(topicId, lang, style, contentVersion, {
          status: 'GENERATING_TTS',
          audioStatus: 'GENERATING_TTS',
        })
      })

      const { durationSeconds, storagePath: uploadedPath, publicUrl } = await step.run('synthesize-upload', async () => {
        const tts = await synthesizeWithRetry(segment.narration, lang)
        const storagePath = buildAudioStoragePath(topicId, lang, style, contentVersion, segmentId)
        const upload = await uploadLessonAudio(storagePath, tts.audioBuffer)
        return { durationSeconds: tts.durationSeconds, storagePath: upload.storagePath, publicUrl: upload.publicUrl }
      })

      const audioUrl = publicUrl?.includes('/api/content/dev-audio')
        ? publicUrl
        : await step.run('sign-url', async () => getSignedAudioUrl(uploadedPath))

      const enriched = enrichSegmentWithAudioTimeline(segment, durationSeconds)

      await step.run('save-segment-audio', async () => {
        await upsertTeachingSegment(contentDocId, {
          ...enriched,
          audioUrl,
          audioStoragePath: uploadedPath,
          voiceId: 'pooja',
          speed: 1.0,
          audioVersion: 1,
          status: 'READY',
        })
        if (jobId) await extendGenerationLock(contentDocId, jobId)
      })

      await step.sendEvent('publish-after-tts', {
        name: 'content/publish',
        data: { topicId, language: lang, teachingStyle: style, contentVersion, contentDocId, jobId },
      })

      return { segmentId, audioUrl }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await step.run('mark-segment-failed', async () => {
        await upsertTeachingSegment(contentDocId, {
          ...segment,
          status: 'FAILED',
          error: message,
        })
      })
      throw err
    }
  },
)

export const publishContent = inngest.createFunction(
  {
    id: 'publish-content',
    retries: 1,
    concurrency: { limit: 1 },
    debounce: {
      key: 'event.data.contentDocId',
      period: '8s',
    },
    triggers: { event: 'content/publish' },
  },
  async ({ event, step }) => {
    const { topicId, language, teachingStyle, contentVersion, contentDocId, jobId } = event.data as {
      topicId: string
      language: string
      teachingStyle: string
      contentVersion: number
      contentDocId: string
      jobId?: string
    }
    const lang = language as SupportedLanguage
    const style = teachingStyle as TeachingStyle

    const alreadyReady = await step.run('short-circuit-ready', async () => {
      const content = await getTeachingContent(topicId, lang, style, contentVersion)
      return content?.status === 'READY'
    })
    if (alreadyReady) return { skipped: true, reason: 'already READY' }

    const audioProbe = await step.run('probe-audio-readiness', async () =>
      getSegmentAudioReadiness(topicId, lang, style, contentVersion),
    )
    if (!audioProbe.allReady) {
      return {
        status: 'GENERATING_TTS',
        reason: 'audio pending',
        readyCount: audioProbe.readyCount,
        total: audioProbe.narrationCount,
      }
    }

    return await step.run('validate-and-publish', async () => {
      const topic = await getCurriculumTopic(topicId)
      const content = await getTeachingContent(topicId, lang, style, contentVersion)
      const segments = await getTeachingSegments(topicId, lang, style, contentVersion)
      if (!content) return { ready: false as const, reason: 'missing content' }

      const validation = validateContentBeforeReady(topic, content, segments, lang, style)
      if (!validation.passed) {
        await markContentFailed(contentDocId, 'validate', validation.errors.join('; '))
        await upsertTeachingContent(topicId, lang, style, contentVersion, {
          validationReport: { passed: false, errors: validation.errors },
        })
        if (jobId) {
          await updateGenerationJob(jobId, {
            status: 'failed',
            stage: 'validate',
            error: validation.errors.join('; '),
            completedAt: new Date().toISOString(),
          })
        }
        return { ready: false as const, reason: 'validation failed', failed: true }
      }

      await upsertTeachingContent(topicId, lang, style, contentVersion, {
        status: 'VALIDATING',
        overallStatus: 'VALIDATING',
      })

      for (const seg of segments) {
        if (seg.audioStoragePath && !seg.audioUrl) {
          const signed = await getSignedAudioUrl(seg.audioStoragePath)
          await upsertTeachingSegment(contentDocId, { ...seg, audioUrl: signed })
        }
      }

      await releaseGenerationLock(contentDocId, 'READY', {
        publishedAt: new Date().toISOString(),
        segmentCount: segments.length,
        scriptStatus: 'READY',
        audioStatus: 'READY',
        overallStatus: 'READY',
        activeVersion: true,
        validationReport: { passed: true, errors: [] },
      })

      await markStalePreviousVersions(topicId, lang, style, contentVersion)

      if (jobId) {
        await updateGenerationJob(jobId, {
          status: 'completed',
          stage: 'publish',
          completedAt: new Date().toISOString(),
        })
      }

      return { ready: true as const, segments: segments.length }
    })
  },
)

export const retryFailedAssets = inngest.createFunction(
  {
    id: 'retry-failed-assets',
    concurrency: { limit: 1 },
    triggers: { cron: '0 * * * *' },
  },
  async ({ step }) => {
    if (process.env.INNGEST_DEV === '1') {
      return { skipped: true, reason: 'retry cron disabled in INNGEST_DEV' }
    }
    const batchLimit = process.env.INNGEST_DEV === '1' ? 3 : 20
    const failed = await step.run('query-failed', async () => {
      const snap = await getAdminFirestore()
        .collection(CONTENT_COLLECTION)
        .where('status', '==', 'FAILED')
        .limit(batchLimit)
        .get()
      return snap.docs
        .map((d) => d.data() as TeachingContentDoc)
        .filter((d) => (d.error?.retryCount ?? 0) < 3)
    })

    let requeued = 0
    for (const doc of failed) {
      const retryCount = (doc.error?.retryCount ?? 0) + 1
      await step.run(`retry-${doc.topicId}-${doc.language}-${doc.teachingStyle}`, async () => {
        await getAdminFirestore()
          .collection(CONTENT_COLLECTION)
          .doc(buildContentDocId(doc.topicId, doc.language, doc.teachingStyle, doc.contentVersion))
          .set(
            {
              status: 'QUEUED',
              overallStatus: 'QUEUED',
              error: { ...doc.error, retryCount },
            },
            { merge: true },
          )
      })

      await step.sendEvent(`requeue-${doc.topicId}`, {
        name: 'content/generate.script',
        data: {
          topicId: doc.topicId,
          language: doc.language,
          teachingStyle: doc.teachingStyle,
          contentVersion: doc.contentVersion,
        },
      })
      requeued++
    }

    return { requeued }
  },
)

export const contentPipelineFunctions = [
  topicContentOrchestrator,
  generateScript,
  generateSegmentTts,
  publishContent,
  retryFailedAssets,
]

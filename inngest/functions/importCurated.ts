import { inngest } from '../client'
import { importCuratedBundle } from '@/lib/content/importCuratedBundle'
import { loadImportStagingDoc, deleteImportStagingDoc } from '@/lib/content/importStaging'
import type { SupportedLanguage, TeachingStyle } from '@/lib/content/types'

/** Lightweight import-only function — runs in the import worker (minimal module graph). */
export const importCuratedContent = inngest.createFunction(
  {
    id: 'import-curated-content',
    retries: 1,
    concurrency: { limit: 1 },
    triggers: { event: 'content/import.curated' },
  },
  async ({ event, step }) => {
    const { importJobId } = event.data as { importJobId: string }

    const result = await step.run('import-bundle', async () => {
      const staged = await loadImportStagingDoc(importJobId)
      if (!staged) throw new Error(`Import staging doc not found: ${importJobId}`)
      const { topic, steps, teachingStyle, language, contentVersion } = staged
      const out = await importCuratedBundle({
        topic,
        steps,
        teachingStyle: teachingStyle as TeachingStyle,
        language: language as SupportedLanguage,
        contentVersion,
      })
      await deleteImportStagingDoc(importJobId)
      return out
    })

    for (const segmentId of result.ttsSegmentIds) {
      await step.sendEvent(`tts-${segmentId}`, {
        name: 'content/generate.tts',
        data: {
          topicId: result.topicId,
          language: result.language,
          teachingStyle: result.teachingStyle,
          contentVersion: result.contentVersion,
          contentDocId: result.contentDocId,
          segmentId,
        },
      })
    }

    return result
  },
)

export const importWorkerFunctions = [importCuratedContent]

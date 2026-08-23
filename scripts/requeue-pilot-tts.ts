#!/usr/bin/env node
/** Re-queue TTS for pilot segments stuck after Sarvam quota failure. */
import { loadWorkerEnv } from '../worker/load-env.mjs'
import { buildContentDocId } from '../lib/content/cacheKeys'

loadWorkerEnv()
if (!process.env.INNGEST_DEV?.trim()) process.env.INNGEST_DEV = '1'

const TOPIC = 'bio-11-8-mitochondria'
const STYLE = process.argv.find((a) => a.startsWith('--style='))?.split('=')[1] || 'friendly'
const LANGUAGE = process.argv.find((a) => a.startsWith('--language='))?.split('=')[1] || 'en-IN'
const VERSION = 1

async function main() {
  const { getTeachingSegments } = await import('../lib/content/firestore')
  const { inngest } = await import('../inngest/client')

  const contentDocId = buildContentDocId(TOPIC, LANGUAGE, STYLE, VERSION)
  const segments = await getTeachingSegments(TOPIC, LANGUAGE, STYLE, VERSION)
  const pending = segments.filter((s) => s.narration?.trim() && s.status !== 'READY')

  if (!pending.length) {
    console.log('No pending narration segments to re-queue.')
    return
  }

  const events = pending.map((segment) => ({
    name: 'content/generate.tts' as const,
    data: {
      topicId: TOPIC,
      language: LANGUAGE,
      teachingStyle: STYLE,
      contentVersion: VERSION,
      contentDocId,
      segmentId: segment.segmentId,
    },
  }))

  await inngest.send(events)
  console.log(`Re-queued TTS for ${events.length} segments (${TOPIC} / ${LANGUAGE} / ${STYLE})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

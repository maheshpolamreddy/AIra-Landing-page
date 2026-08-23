#!/usr/bin/env node
/** Trigger publish after segments have audio. */
import { loadWorkerEnv } from '../worker/load-env.mjs'
import { buildContentDocId } from '../lib/content/cacheKeys'

loadWorkerEnv()
if (!process.env.INNGEST_DEV?.trim()) process.env.INNGEST_DEV = '1'

const TOPIC = 'bio-11-8-mitochondria'
const STYLE = process.argv.find((a) => a.startsWith('--style='))?.split('=')[1] || 'friendly'
const LANGUAGE = process.argv.find((a) => a.startsWith('--language='))?.split('=')[1] || 'en-IN'
const VERSION = 1

async function main() {
  const { inngest } = await import('../inngest/client')
  const { upsertTeachingContent } = await import('../lib/content/firestore')
  const contentDocId = buildContentDocId(TOPIC, LANGUAGE, STYLE, VERSION)

  await upsertTeachingContent(TOPIC, LANGUAGE, STYLE, VERSION, {
    status: 'GENERATING_TTS',
    overallStatus: 'GENERATING_TTS',
    audioStatus: 'GENERATING_TTS',
  })

  await inngest.send({
    name: 'content/publish',
    data: {
      topicId: TOPIC,
      language: LANGUAGE,
      teachingStyle: STYLE,
      contentVersion: VERSION,
      contentDocId,
    },
  })
  console.log(`Publish queued for ${TOPIC} / ${LANGUAGE} / ${STYLE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

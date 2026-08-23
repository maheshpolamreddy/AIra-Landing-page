/**
 * Import worker — Firestore import via HTTP only (no Inngest serve handler).
 * Queues TTS through inngest.send() to the pipeline worker.
 */
import http from 'node:http'
import { loadWorkerEnv } from './load-env.mjs'

loadWorkerEnv()
if (!process.env.INNGEST_DEV?.trim()) process.env.INNGEST_DEV = '1'

const host = process.env.CONTENT_WORKER_HOST || '127.0.0.1'
const port = Number(process.env.CONTENT_IMPORT_WORKER_PORT || 3001)
const MAX_IMPORT_BODY_BYTES = 8 * 1024 * 1024

let importBusy = false

async function main() {
  const { importCuratedBundle } = await import('../lib/content/importCuratedBundle')
  const { loadImportStagingDoc, deleteImportStagingDoc } = await import('../lib/content/importStaging')

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${port}`)

    if (url.pathname === '/run-import' && req.method === 'POST') {
      if (importBusy) {
        res.writeHead(429, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'import already in progress', code: 'IMPORT_BUSY' }))
        return
      }
      importBusy = true
      let body = ''
      let bodyBytes = 0
      req.on('data', (chunk: Buffer | string) => {
        bodyBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
        if (bodyBytes > MAX_IMPORT_BODY_BYTES) {
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'request body too large', code: 'PAYLOAD_TOO_LARGE' }))
          req.destroy()
          importBusy = false
          return
        }
        body += chunk
      })
      req.on('end', async () => {
        let staged: Awaited<ReturnType<typeof loadImportStagingDoc>> = null
        try {
          const { importJobId } = JSON.parse(body) as { importJobId?: string }
          if (!importJobId) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'importJobId required', code: 'INVALID_INPUT' }))
            return
          }
          const mem0 = process.memoryUsage()
          console.log(`[import-worker] start ${importJobId} heap=${Math.round(mem0.heapUsed / 1024 / 1024)}MB`)

          staged = await loadImportStagingDoc(importJobId)
          if (!staged) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'staging doc not found', code: 'NOT_FOUND' }))
            return
          }
          const result = await importCuratedBundle({
            topic: staged.topic,
            steps: staged.steps,
            teachingStyle: staged.teachingStyle,
            language: staged.language,
            contentVersion: staged.contentVersion,
          })
          await deleteImportStagingDoc(importJobId)
          staged = null

          const { inngest } = await import('../inngest/client')
          const ttsEvents = result.ttsSegmentIds.map((segmentId) => ({
            name: 'content/generate.tts' as const,
            data: {
              topicId: result.topicId,
              language: result.language,
              teachingStyle: result.teachingStyle,
              contentVersion: result.contentVersion,
              contentDocId: result.contentDocId,
              segmentId,
            },
          }))
          const ttsQueued = ttsEvents.length
          if (ttsEvents.length) await inngest.send(ttsEvents)

          const mem1 = process.memoryUsage()
          console.log(`[import-worker] done heap=${Math.round(mem1.heapUsed / 1024 / 1024)}MB tts=${ttsQueued}`)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            ok: true,
            contentDocId: result.contentDocId,
            segments: result.segments,
            topicId: result.topicId,
            language: result.language,
            teachingStyle: result.teachingStyle,
            contentVersion: result.contentVersion,
            ttsQueued,
          }))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: message, code: 'IMPORT_FAILED' }))
        } finally {
          staged = null
          importBusy = false
        }
      })
      return
    }

    if (url.pathname === '/health') {
      const mem = process.memoryUsage()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'import', heapUsed: mem.heapUsed, rss: mem.rss, busy: importBusy }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }))
  })

  server.listen(port, host, () => {
    const mem = process.memoryUsage()
    console.log(`[import-worker] http://${host}:${port}/run-import`)
    console.log(`[import-worker] heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB RSS=${Math.round(mem.rss / 1024 / 1024)}MB`)
  })
}

main().catch((err) => {
  console.error('[import-worker] fatal:', err)
  process.exit(1)
})

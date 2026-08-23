/**
 * TTS/script/publish pipeline worker. Port 3002.
 */
import http from 'node:http'
import { serve } from 'inngest/node'
import { loadWorkerEnv } from './load-env.mjs'

loadWorkerEnv()
if (!process.env.INNGEST_DEV?.trim()) process.env.INNGEST_DEV = '1'

const port = Number(process.env.CONTENT_PIPELINE_WORKER_PORT || 3002)
const host = process.env.CONTENT_WORKER_HOST || '127.0.0.1'

async function main() {
  const { inngest } = await import('../inngest/client')
  const { contentPipelineFunctions } = await import('../inngest/functions/contentPipeline')

  const inngestHandler = serve({
    client: inngest,
    functions: contentPipelineFunctions,
    servePath: '/api/inngest',
    serveOrigin: `http://${host}:${port}`,
  })

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${port}`)
    if (url.pathname === '/health') {
      const mem = process.memoryUsage()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, service: 'pipeline', heapUsed: mem.heapUsed, rss: mem.rss }))
      return
    }
    inngestHandler(req, res)
  })

  server.listen(port, host, () => {
    const mem = process.memoryUsage()
    console.log(`[pipeline-worker] http://${host}:${port}/api/inngest`)
    console.log(`[pipeline-worker] http://${host}:${port}/health`)
    console.log(`[pipeline-worker] heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB RSS=${Math.round(mem.rss / 1024 / 1024)}MB`)
  })

  setInterval(() => {
    const mem = process.memoryUsage()
    console.log(
      `[pipeline-worker:mem] heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB heapTotal=${Math.round(mem.heapTotal / 1024 / 1024)}MB RSS=${Math.round(mem.rss / 1024 / 1024)}MB`,
    )
  }, 30_000).unref()
}

main().catch((err) => {
  console.error('[pipeline-worker] fatal:', err)
  process.exit(1)
})

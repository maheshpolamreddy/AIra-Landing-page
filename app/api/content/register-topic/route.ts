import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, bridgeOk } from '@/lib/content/auth'
import { upsertCurriculumTopic } from '@/lib/content/firestore'
import { inngest } from '@/inngest/client'
import type { CurriculumTopicDoc } from '@/lib/content/types'
import { DEFAULT_CONTENT_VERSION } from '@/lib/content/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const bridge = req.headers.get('x-aira-content-bridge')
  if (!bridgeOk(bridge)) {
    const auth = await requireAuth(req, true)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const topic = body as unknown as CurriculumTopicDoc
  if (!topic.topicId || !topic.topicName) {
    return NextResponse.json({ error: 'Invalid topic payload' }, { status: 400 })
  }
  if (!topic.diagramKeys?.length) {
    return NextResponse.json({ error: 'diagramKeys are required for visual-speech sync' }, { status: 400 })
  }

  const doc: CurriculumTopicDoc = {
    ...topic,
    contentVersion: topic.contentVersion ?? DEFAULT_CONTENT_VERSION,
    visualRegistryVersion: topic.visualRegistryVersion ?? 1,
    diagramKeys: topic.diagramKeys ?? [],
    status: topic.status ?? 'active',
    updatedAt: new Date().toISOString(),
  }

  await upsertCurriculumTopic(doc)

  const queueGeneration = body.queueGeneration !== false
  if (queueGeneration) {
    await inngest.send({
      name: 'curriculum/topic.registered',
      data: {
        topicId: doc.topicId,
        contentVersion: doc.contentVersion,
      },
    })
  }

  return NextResponse.json({ ok: true, topicId: doc.topicId, queued: queueGeneration })
}

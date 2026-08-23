import { NextRequest, NextResponse } from 'next/server'
import { listContentStatusForTopic, getCurriculumTopic } from '@/lib/content/firestore'
import { requireAuth } from '@/lib/content/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, true)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const topicId = req.nextUrl.searchParams.get('topicId')?.trim()
  if (!topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 })
  }

  const topic = await getCurriculumTopic(topicId)
  const contents = await listContentStatusForTopic(topicId)

  return NextResponse.json({
    topic,
    contents: contents.map((c) => ({
      language: c.language,
      teachingStyle: c.teachingStyle,
      contentVersion: c.contentVersion,
      status: c.status,
      scriptStatus: c.scriptStatus ?? c.status,
      audioStatus: c.audioStatus ?? c.status,
      overallStatus: c.overallStatus ?? c.status,
      activeVersion: c.activeVersion !== false,
      segmentCount: c.segmentCount,
      generatedAt: c.generatedAt,
      publishedAt: c.publishedAt,
      error: c.error,
      validationReport: c.validationReport,
    })),
  })
}

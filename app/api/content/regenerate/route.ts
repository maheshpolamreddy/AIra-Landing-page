import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/content/auth'
import { inngest } from '@/inngest/client'
import {
  normalizeLanguage,
  normalizeTeachingStyle,
  TEACHING_STYLES,
  SUPPORTED_LANGUAGES,
  DEFAULT_CONTENT_VERSION,
} from '@/lib/content/constants'
import {
  getCurriculumTopic,
  getTeachingContent,
  getTeachingSegments,
  upsertCurriculumTopic,
} from '@/lib/content/firestore'
import { buildContentDocId } from '@/lib/content/cacheKeys'
import type { SupportedLanguage, TeachingStyle } from '@/lib/content/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, true)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const topicId = typeof body.topicId === 'string' ? body.topicId.trim() : ''
  if (!topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 })
  }

  const scope = body.scope as string | undefined
  let styles: TeachingStyle[] = TEACHING_STYLES
  let languages: SupportedLanguage[] = [...SUPPORTED_LANGUAGES]

  if (scope === 'style' && typeof body.teachingStyle === 'string') {
    styles = [normalizeTeachingStyle(body.teachingStyle)]
  }
  if (scope === 'language' && typeof body.language === 'string') {
    languages = [normalizeLanguage(body.language)]
  }

  const topic = await getCurriculumTopic(topicId)
  const currentVersion = topic?.contentVersion ?? DEFAULT_CONTENT_VERSION

  if (scope === 'tts-only') {
    const style = normalizeTeachingStyle(
      typeof body.teachingStyle === 'string' ? body.teachingStyle : undefined,
    )
    const language = normalizeLanguage(typeof body.language === 'string' ? body.language : undefined)
    const version =
      typeof body.contentVersion === 'number' ? body.contentVersion : currentVersion

    const content = await getTeachingContent(topicId, language, style, version)
    if (!content || content.status === 'READY') {
      return NextResponse.json({ ok: false, message: 'No SCRIPT_READY content for TTS-only regen' })
    }

    const contentDocId = buildContentDocId(topicId, language, style, version)
    const segments = await getTeachingSegments(topicId, language, style, version)

    for (const seg of segments) {
      if (!seg.narration?.trim()) continue
      await inngest.send({
        name: 'content/generate.tts',
        data: {
          topicId,
          language,
          teachingStyle: style,
          contentVersion: version,
          contentDocId,
          segmentId: seg.segmentId,
        },
      })
    }

    await inngest.send({
      name: 'content/publish',
      data: { topicId, language, teachingStyle: style, contentVersion: version, contentDocId },
    })

    return NextResponse.json({ ok: true, scope: 'tts-only', queued: segments.length })
  }

  const nextVersion =
    typeof body.contentVersion === 'number' ? body.contentVersion : currentVersion + 1

  if (topic) {
    await upsertCurriculumTopic({ ...topic, contentVersion: nextVersion, updatedAt: new Date().toISOString() })
  }

  await inngest.send({
    name: 'curriculum/topic.registered',
    data: { topicId, contentVersion: nextVersion, styles, languages },
  })

  return NextResponse.json({
    ok: true,
    topicId,
    contentVersion: nextVersion,
    queued: styles.length * languages.length,
    styles,
    languages,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import {
  getCurriculumTopic,
  getTeachingContent,
  getTeachingSegments,
  validateCachedContent,
  getActiveTeachingContent,
} from '@/lib/content/firestore'
import { requireAuth } from '@/lib/content/auth'
import {
  normalizeLanguage,
  normalizeTeachingStyle,
  DEFAULT_CONTENT_VERSION,
} from '@/lib/content/constants'
import { getSignedAudioUrl } from '@/lib/content/storage'
import type { CachedLessonResponse, TeachingSegmentDoc } from '@/lib/content/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function signSegmentUrls(segments: TeachingSegmentDoc[]): Promise<TeachingSegmentDoc[]> {
  return Promise.all(
    segments.map(async (seg) => {
      if (seg.audioStoragePath) {
        try {
          const signed = await getSignedAudioUrl(seg.audioStoragePath)
          return { ...seg, audioUrl: signed }
        } catch {
          return seg
        }
      }
      return seg
    }),
  )
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const topicId = req.nextUrl.searchParams.get('topicId')?.trim()
  const language = normalizeLanguage(req.nextUrl.searchParams.get('language') || undefined)
  const style = normalizeTeachingStyle(req.nextUrl.searchParams.get('style') || undefined)
  const versionParam = req.nextUrl.searchParams.get('contentVersion')
  const contentVersion = versionParam ? parseInt(versionParam, 10) : DEFAULT_CONTENT_VERSION

  if (!topicId) {
    return NextResponse.json({ error: 'topicId is required' }, { status: 400 })
  }

  const topic = await getCurriculumTopic(topicId)

  let content = versionParam
    ? await getTeachingContent(topicId, language, style, contentVersion)
    : (await getActiveTeachingContent(topicId, language, style))?.content ?? null

  const resolvedVersion = content?.contentVersion ?? topic?.contentVersion ?? contentVersion

  let segments = content
    ? await getTeachingSegments(topicId, language, style, resolvedVersion)
    : []

  const isValid =
    content && validateCachedContent(content, segments, topicId, language, style)

  if (!isValid) {
    return NextResponse.json({
      status: content?.status || 'PENDING',
      topicId,
      language,
      teachingStyle: style,
      contentVersion: resolvedVersion,
      steps: content?.steps || [],
      segments: segments.filter((s) => s.narration || s.visualMarker),
      greetingTemplate: content?.greetingTemplate || '',
      visualRegistry: content?.visualRegistry,
      message: 'Content is being prepared. Please try again shortly.',
    } satisfies Partial<CachedLessonResponse> & { message?: string })
  }

  segments = await signSegmentUrls(segments)

  const response: CachedLessonResponse = {
    status: 'READY',
    topicId,
    language,
    teachingStyle: style,
    contentVersion: resolvedVersion,
    cacheKey: content!.cacheKey,
    steps: content!.steps,
    segments,
    greetingTemplate: content!.greetingTemplate || '',
    visualRegistry: content!.visualRegistry,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}

import {
  listPublishedWeeklyExams,
  loadWeeklyExams,
  upsertWeeklyExam,
  type WeeklyExamSessionDto,
} from '@/lib/weekly-exam-store'

/** Prefer env; fall back to legacy bridge so existing tutor clients keep working. */
const BRIDGE =
  process.env.WEEKLY_EXAM_BRIDGE_SECRET ||
  process.env.NEXT_PUBLIC_WEEKLY_EXAM_BRIDGE_SECRET ||
  'aira_weekly_bridge_v1'

function bridgeOk(secret: string | null | undefined): boolean {
  return Boolean(secret) && secret === BRIDGE
}

function isValidSession(body: unknown): body is WeeklyExamSessionDto & { bridgeSecret?: string } {
  if (!body || typeof body !== 'object') return false
  const s = body as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.weekKey === 'string' &&
    (s.day === 'saturday' || s.day === 'sunday') &&
    typeof s.title === 'string' &&
    typeof s.examId === 'string' &&
    (s.mode === 'mock' || s.mode === 'pyq') &&
    typeof s.startsAt === 'string' &&
    typeof s.endsAt === 'string' &&
    (s.status === 'draft' || s.status === 'published' || s.status === 'archived') &&
    typeof s.createdBy === 'string' &&
    typeof s.updatedAt === 'string'
  )
}

/** Students + admins: list schedules (published by default; ?all=1 requires bridge secret). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const all = url.searchParams.get('all') === '1'
    if (all) {
      const secret =
        request.headers.get('x-aira-weekly-bridge') || url.searchParams.get('bridgeSecret')
      if (!bridgeOk(secret)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    const sessions = all ? loadWeeklyExams() : listPublishedWeeklyExams()
    return Response.json({
      ok: true,
      sessions,
      source: 'landing-json-store',
    })
  } catch (err) {
    console.error('[weekly-exams GET]', err)
    return Response.json({ error: 'Failed to load weekly exams' }, { status: 500 })
  }
}

/** Admin publish/update bridge — keeps production in sync when Firestore was offline. */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isValidSession(body)) {
    return Response.json({ error: 'Invalid weekly exam payload' }, { status: 400 })
  }

  const secret =
    (body as { bridgeSecret?: string }).bridgeSecret ||
    request.headers.get('x-aira-weekly-bridge')
  if (!bridgeOk(secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { bridgeSecret: _drop, ...rest } = body as WeeklyExamSessionDto & {
      bridgeSecret?: string
    }
    const saved = upsertWeeklyExam(rest)
    return Response.json({ ok: true, session: rest, count: saved.length })
  } catch (err) {
    console.error('[weekly-exams POST]', err)
    return Response.json({ error: 'Failed to save weekly exam' }, { status: 500 })
  }
}

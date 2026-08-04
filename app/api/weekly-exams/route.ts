import {
  listPublishedWeeklyExams,
  loadWeeklyExams,
  upsertWeeklyExam,
  type WeeklyExamSessionDto,
} from '@/lib/weekly-exam-store'

const BRIDGE = 'aira_weekly_bridge_v1'

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

/** Students + admins: list schedules (published by default, ?all=1 for admin). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const all = url.searchParams.get('all') === '1'
  const sessions = all ? loadWeeklyExams() : listPublishedWeeklyExams()
  return Response.json({
    ok: true,
    sessions,
    source: 'landing-json-store',
  })
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

  const secret = (body as { bridgeSecret?: string }).bridgeSecret
  if (secret !== BRIDGE) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bridgeSecret: _drop, ...rest } = body as WeeklyExamSessionDto & {
    bridgeSecret?: string
  }
  const saved = upsertWeeklyExam(rest)
  return Response.json({ ok: true, session: rest, count: saved.length })
}

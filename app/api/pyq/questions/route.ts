import { NextResponse } from 'next/server'
import { loadPyqBank, stripAnswers } from '@/lib/pyq/bank'

export const runtime = 'nodejs'

/** Paginated student-safe question list (no answers). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : null
  const paper = searchParams.get('paper') ? Number(searchParams.get('paper')) : null
  const subject = searchParams.get('subject')
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 20)))

  let pool = loadPyqBank().filter((q) => q.answerStatus === 'VERIFIED_FROM_SOURCE')
  if (year != null && Number.isFinite(year)) pool = pool.filter((q) => q.year === year)
  if (paper === 1 || paper === 2) pool = pool.filter((q) => q.paper === paper)
  if (subject) pool = pool.filter((q) => q.subject === subject.toUpperCase())

  const total = pool.length
  const start = (page - 1) * pageSize
  const slice = pool.slice(start, start + pageSize).map((q) => ({
    ...stripAnswers(q),
    exam: 'JEE_ADVANCED' as const,
    sourceType: 'PYQ' as const,
  }))

  const raw = JSON.stringify(slice)
  if (/"answer"\s*:/.test(raw) || /"answerStatus"\s*:/.test(raw)) {
    return NextResponse.json({ error: 'Answer leak blocked', code: 'ANSWER_LEAK' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize,
    questions: slice,
  })
}

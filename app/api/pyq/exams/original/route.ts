import { NextResponse } from 'next/server'
import { buildOriginalSession } from '@/lib/pyq/bank'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { year?: number; paper?: number }
    const year = Number(body.year)
    const paper = Number(body.paper)
    if (!Number.isFinite(year) || (paper !== 1 && paper !== 2)) {
      return NextResponse.json({ error: 'year and paper (1|2) required', code: 'INVALID' }, { status: 400 })
    }
    const client = buildOriginalSession(year, paper)
    return NextResponse.json(client)
  } catch (err) {
    const code = (err as { code?: string }).code || 'PYQ_ORIGINAL_FAILED'
    const message = err instanceof Error ? err.message : 'Original exam failed'
    const status = code === 'INSUFFICIENT_POOL' ? 422 : 500
    return NextResponse.json({ error: message, code }, { status })
  }
}

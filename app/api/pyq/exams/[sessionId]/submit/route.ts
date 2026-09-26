import { NextResponse } from 'next/server'
import { scoreSession } from '@/lib/pyq/bank'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await ctx.params
    const body = (await req.json()) as { answers?: Record<string, unknown> }
    const result = scoreSession(sessionId, (body.answers || {}) as Record<string, string | string[]>)
    return NextResponse.json(result)
  } catch (err) {
    const code = (err as { code?: string }).code || 'PYQ_SUBMIT_FAILED'
    const message = err instanceof Error ? err.message : 'Submit failed'
    const status = code === 'NOT_FOUND' ? 404 : 500
    return NextResponse.json({ error: message, code }, { status })
  }
}

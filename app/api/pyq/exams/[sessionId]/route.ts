import { NextResponse } from 'next/server'
import { loadSession } from '@/lib/pyq/bank'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await ctx.params
  const session = loadSession(sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Session not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  const { _serverAnswers: _, ...client } = session as typeof session & {
    _serverAnswers?: unknown
  }
  return NextResponse.json(client)
}

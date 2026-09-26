import { NextResponse } from 'next/server'
import { buildMixedSession, loadPyqBank } from '@/lib/pyq/bank'

export const runtime = 'nodejs'

export async function GET() {
  const bank = loadPyqBank()
  return NextResponse.json({
    ok: true,
    eligibleCount: bank.length,
    years: [...new Set(bank.map((q) => q.year))].sort((a, b) => a - b),
  })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      count?: number
      years?: number[]
      physics?: number
      chemistry?: number
      mathematics?: number
      seed?: string
    }
    const count = Number(body.count)
    if (!Number.isFinite(count) || count < 1 || count > 120) {
      return NextResponse.json({ error: 'count must be 1–120', code: 'INVALID_COUNTS' }, { status: 400 })
    }
    const client = buildMixedSession({
      count,
      years: body.years,
      physics: body.physics,
      chemistry: body.chemistry,
      mathematics: body.mathematics,
      seed: body.seed,
    })
    return NextResponse.json(client)
  } catch (err) {
    const code = (err as { code?: string }).code || 'PYQ_MIXED_FAILED'
    const message = err instanceof Error ? err.message : 'Mixed exam failed'
    const status = code === 'INSUFFICIENT_POOL' || code === 'INVALID_COUNTS' ? 422 : 500
    return NextResponse.json({ error: message, code }, { status })
  }
}

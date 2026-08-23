import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'landing',
    tutorProxy: Boolean(
      process.env.NODE_ENV === 'development' || process.env.TUTOR_DEV_URL?.trim(),
    ),
    tutorDevUrl: process.env.TUTOR_DEV_URL || null,
  })
}

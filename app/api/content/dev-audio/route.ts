import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEV_AUDIO_ROOT = path.join(process.cwd(), '.dev-audio')

/** Local dev-only audio serving when Firebase Storage bucket is unavailable. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.TTS_DEV_STUB !== '1') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const storagePath = req.nextUrl.searchParams.get('path')?.trim()
  if (!storagePath || storagePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const filePath = path.join(DEV_AUDIO_ROOT, storagePath)
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 })
  }

  const buffer = await fs.promises.readFile(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

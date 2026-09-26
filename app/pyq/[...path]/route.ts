import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Serve PYQ visual assets from the tutor public folder when the SPA is opened
 * through the landing origin (localhost:3000). Vite already serves these on :5173.
 */
function candidateRoots() {
  const envRoot = process.env.PYQ_PUBLIC_ROOT?.trim()
  const home = process.env.USERPROFILE || process.env.HOME || ''
  return [
    envRoot,
    path.join(home, 'Projects', 'AIra---AI-tutor', 'public', 'pyq'),
    path.join(process.cwd(), '..', 'AIra---AI-tutor', 'public', 'pyq'),
    path.join(process.cwd(), 'public', 'pyq'),
  ].filter(Boolean) as string[]
}

function contentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
  const resolved = await Promise.resolve(ctx.params)
  const parts = resolved.path || []
  if (!parts.length || parts.some((p) => p.includes('..') || p.includes('\\'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const rel = parts.join('/')
  for (const root of candidateRoots()) {
    const full = path.resolve(root, rel)
    if (!full.startsWith(path.resolve(root))) continue
    if (!existsSync(full) || !statSync(full).isFile()) continue
    const buf = readFileSync(full)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType(full),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  return NextResponse.json({ error: 'PYQ asset not found', path: rel }, { status: 404 })
}

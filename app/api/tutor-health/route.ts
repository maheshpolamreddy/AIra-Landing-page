import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TUTOR_DEV_URL = process.env.TUTOR_DEV_URL || 'http://127.0.0.1:5173'

function tutorDownHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Tutor unavailable</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1e293b}
h1{font-size:1.25rem}code{background:#f1f5f9;padding:2px 6px;border-radius:4px}</style></head>
<body>
<h1>Tutor application is not running</h1>
<p>Start the full dev stack from the tutor repo:</p>
<p><code>npm run dev:stack</code></p>
<p>Then open <a href="http://localhost:3000">http://localhost:3000</a></p>
<p><small>Expected tutor at ${TUTOR_DEV_URL}</small></p>
</body></html>`
}

/**
 * Returns 503 when the tutor dev server is unreachable.
 * Used by middleware instead of showing Next.js 404 for valid tutor routes.
 */
export async function GET(req: NextRequest) {
  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    return new NextResponse(tutorDownHtml(), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  return NextResponse.json(
    {
      ok: false,
      service: 'tutor',
      error: 'Tutor application is not running',
      code: 'TUTOR_UNAVAILABLE',
      hint: 'Start the full stack: npm run dev:stack (from the tutor repo)',
      tutorDevUrl: TUTOR_DEV_URL,
    },
    { status: 503 },
  )
}

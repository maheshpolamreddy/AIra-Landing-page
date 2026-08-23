import { NextResponse, type NextRequest } from 'next/server'
import {
  localhostRedirectUrl,
  shouldRedirectToLocalhost,
} from '@/lib/firebase/authorized-domains'

const TUTOR_ROUTE_PREFIXES = ['/student', '/teacher', '/admin', '/dev/'] as const

let tutorHealthCache: { ok: boolean; checkedAt: number } | null = null
const TUTOR_HEALTH_TTL_MS = 5000

function isTutorAppRoute(pathname: string): boolean {
  return TUTOR_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

async function isTutorReachable(tutorBase: string): Promise<boolean> {
  const now = Date.now()
  if (tutorHealthCache && now - tutorHealthCache.checkedAt < TUTOR_HEALTH_TTL_MS) {
    return tutorHealthCache.ok
  }
  try {
    const probe = await fetch(`${tutorBase}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(800),
      cache: 'no-store',
    })
    const ok = probe.ok
    tutorHealthCache = { ok, checkedAt: now }
    return ok
  } catch {
    tutorHealthCache = { ok: false, checkedAt: now }
    return false
  }
}

const enableTutorProxy =
  process.env.NODE_ENV === 'development' ||
  Boolean(process.env.TUTOR_DEV_URL?.trim())

/**
 * Firebase Auth authorizes `localhost` by default but not `127.0.0.1`.
 * Redirect loopback IP access to localhost so sign-in never hits unauthorized-domain.
 */
export async function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname

  if (shouldRedirectToLocalhost(hostname)) {
    return NextResponse.redirect(localhostRedirectUrl(request.nextUrl))
  }

  const { pathname } = request.nextUrl

  if (enableTutorProxy && isTutorAppRoute(pathname)) {
    const tutorBase = (process.env.TUTOR_DEV_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
    const reachable = await isTutorReachable(tutorBase)
    if (!reachable) {
      return NextResponse.rewrite(new URL('/api/tutor-health', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * All app routes except static assets, Next internals, and API routes.
     * /api/* must stay on Next route handlers (never redirected).
     */
    '/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)',
  ],
}

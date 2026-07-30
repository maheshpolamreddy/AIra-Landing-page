import { NextResponse, type NextRequest } from 'next/server'
import {
  localhostRedirectUrl,
  shouldRedirectToLocalhost,
} from '@/lib/firebase/authorized-domains'

/**
 * Firebase Auth authorizes `localhost` by default but not `127.0.0.1`.
 * Redirect loopback IP access to localhost so sign-in never hits unauthorized-domain.
 */
export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname

  if (shouldRedirectToLocalhost(hostname)) {
    return NextResponse.redirect(localhostRedirectUrl(request.nextUrl))
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

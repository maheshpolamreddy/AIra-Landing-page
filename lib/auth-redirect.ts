/** Post-auth destinations shared by login, signup, and social sign-in. */

export type AppRole = 'student' | 'teacher' | 'admin'

export const ROLE_HOME: Record<AppRole, string> = {
  student: '/student/mode-selection',
  teacher: '/teacher/dashboard',
  admin: '/admin/dashboard',
}

export function normalizeAppRole(role: unknown): AppRole {
  if (role === 'teacher' || role === 'admin') return role
  return 'student'
}

/** Safe in-app redirect paths only (blocks open redirects). */
export function sanitizeAppRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null
  if (decoded.includes('://')) return null
  const allowed =
    decoded === '/student' ||
    decoded.startsWith('/student/') ||
    decoded === '/teacher' ||
    decoded.startsWith('/teacher/') ||
    decoded === '/admin' ||
    decoded.startsWith('/admin/')
  return allowed ? decoded : null
}

export function homeForRole(role: AppRole): string {
  return ROLE_HOME[role]
}

/** True when redirect path belongs to the user's role (avoids RoleGuard bounce). */
export function redirectMatchesRole(
  redirect: string | null | undefined,
  role: AppRole,
): boolean {
  const safe = sanitizeAppRedirect(redirect)
  if (!safe) return false
  if (role === 'student') return safe === '/student' || safe.startsWith('/student/')
  if (role === 'teacher') return safe === '/teacher' || safe.startsWith('/teacher/')
  if (role === 'admin') return safe === '/admin' || safe.startsWith('/admin/')
  return false
}

/**
 * Prefer an explicit safe `redirect` only when it matches Firestore role.
 * Otherwise go straight to role home — skips teacher→student bounce delays.
 */
export function resolvePostAuthPath(options: {
  redirect?: string | null
  role: AppRole
}): string {
  if (redirectMatchesRole(options.redirect, options.role)) {
    return sanitizeAppRedirect(options.redirect)!
  }
  return homeForRole(options.role)
}

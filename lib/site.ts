/** Shared site constants — keep CTAs and stats consistent everywhere. */

export const CTAS = {
  primary: {
    label: 'Start Free Trial',
    href: '/signup',
  },
  secondary: {
    label: 'Book a Demo',
    href: '/contact',
  },
} as const

/**
 * Canonical stats used across the site.
 * Prefer product truths over unverified vanity metrics.
 */
export const STATS = {
  coverage: {
    value: 'Grades 6–12',
    label: 'curriculum ready',
    note: 'School learning grade bands',
  },
  exams: {
    value: 'JEE · NEET',
    label: 'exam prep',
    note: 'Competitive exam focus',
  },
  support: {
    value: '24/7',
    label: 'AI support',
    note: 'Product capability claim',
  },
} as const

/** Short trust line under hero CTAs */
export const HERO_TRUST =
  'Free to start · Boards, JEE, NEET & career skills' as const

export const EXTERNAL = {
  schools: {
    label: 'For Schools',
    /** Role home is resolved after login — do not force /teacher (causes student bounce). */
    loginHref: '/login?intent=school',
    /** Safe fallback while role loads — never dump into student mode-selection. */
    href: '/login?intent=school',
  },
  professionals: {
    label: 'For Professionals',
    loginHref: '/login?intent=professional',
    href: 'https://aira-edtech-f063e.web.app/',
  },
} as const

/** Official social profiles — @aira_ai_tutor */
export const SOCIAL = {
  instagram: {
    label: 'Instagram',
    href: 'https://www.instagram.com/aira_ai_tutor',
  },
  x: {
    label: 'X',
    href: 'https://x.com/aira_ai_tutor',
  },
} as const

/** Subtle copy on /login when arriving via For Schools / For Professionals */
export const LOGIN_INTENT_COPY: Record<string, string> = {
  school: 'Signing in to access school tools',
  professional: 'Signing in to access professional tools',
}

/**
 * External (cross-origin) post-login destinations only.
 * School / default users use Firestore role → /student|/teacher|/admin (same origin).
 */
export function portalHrefForIntent(
  intent: string | null | undefined,
): string | null {
  if (intent === 'professional') return EXTERNAL.professionals.href
  return null
}

export const BRAND = {
  /** Product / logo wordmark — keep short; do not replace with legal entity name. */
  name: 'Aɪra',
  /**
   * Registered company name for Terms, Privacy, Cookies, and copyright notices.
   * Never use this in the logo or primary brand mark.
   */
  legalName: 'AIRA INFO-TECH PRIVATE LIMITED',
  tagline: 'The AI tutor that turns effort into results',
  /**
   * Official brand mark for UI logos (header, footer, launcher).
   * Prefer transparent PNG under /logos; fall back to existing brand icon.
   */
  iconSrc: '/logos/aira-brand-icon.png',
  /** Primary landing hero visual */
  heroSrc: '/images/hero_branded_final.png',
  /** Auth marketing panel visual */
  authVisualSrc: '/images/auth_student_enhanced.png',
  faviconIco: '/favicon.ico',
  faviconSrc: '/favicon.ico',
  favicon16: '/favicon-16x16.png',
  favicon32: '/favicon-32x32.png',
  appleIcon: '/apple-icon.png',
  icon192: '/icon-192.png',
  icon512: '/icon-512.png',
} as const

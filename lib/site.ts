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
 * Marked as approximate placeholders until marketing supplies verified figures.
 */
export const STATS = {
  learners: {
    value: '32k+',
    label: 'learners',
    note: 'Approx. as of Jul 2026 — verify before investor decks',
  },
  successRate: {
    value: '95%',
    label: 'success rate',
    note: 'Placeholder — replace with verified completion/pass metric',
  },
  support: {
    value: '24/7',
    label: 'AI support',
    note: 'Product capability claim',
  },
} as const

export const EXTERNAL = {
  schools: {
    label: 'For Schools',
    /** Internal login — school tools after auth */
    loginHref: '/login?intent=school',
    /** Legacy portal (post-login destination later if needed) */
    href: 'https://ai-ra-app.vercel.app',
  },
  professionals: {
    label: 'For Professionals',
    loginHref: '/login?intent=professional',
    href: 'https://aira-edtech-f063e.web.app/',
  },
} as const

/** Subtle copy on /login when arriving via For Schools / For Professionals */
export const LOGIN_INTENT_COPY: Record<string, string> = {
  school: 'Signing in to access school tools',
  professional: 'Signing in to access professional tools',
}

/** Where to send the user after a successful login for a given intent */
export function portalHrefForIntent(
  intent: string | null | undefined,
): string | null {
  if (intent === 'school') return EXTERNAL.schools.href
  if (intent === 'professional') return EXTERNAL.professionals.href
  return null
}

export const BRAND = {
  name: 'Aɪra',
  tagline: 'AI-powered learning for exams and careers',
  /** Official brand icon (favicon / PWA / launcher) */
  iconSrc: '/brand/aira-icon.png',
} as const

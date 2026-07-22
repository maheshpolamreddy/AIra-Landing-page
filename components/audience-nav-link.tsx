'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { EXTERNAL } from '@/lib/site'
import { cn } from '@/lib/utils'

type Audience = 'schools' | 'professionals'

type AudienceNavLinkProps = {
  audience: Audience
  className?: string
  onNavigate?: () => void
  children: ReactNode
}

/**
 * Logged out → /login?intent=…
 * Logged in  → open external portal in a new tab
 */
export function AudienceNavLink({
  audience,
  className,
  onNavigate,
  children,
}: AudienceNavLinkProps) {
  const { user, loading } = useAuth()
  const config = EXTERNAL[audience]

  if (!loading && user) {
    return (
      <a
        href={config.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={cn(className)}
      >
        {children}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    )
  }

  return (
    <Link href={config.loginHref} onClick={onNavigate} className={cn(className)}>
      {children}
    </Link>
  )
}

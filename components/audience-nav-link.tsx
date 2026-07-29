'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { ComingSoonModal } from '@/components/coming-soon-modal'
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
 * Schools: logged out → /login?intent=school · logged in → portal
 * Professionals: always opens "Coming soon" popup (tracks not live yet)
 */
export function AudienceNavLink({
  audience,
  className,
  onNavigate,
  children,
}: AudienceNavLinkProps) {
  const { user, loading } = useAuth()
  const [comingSoonOpen, setComingSoonOpen] = useState(false)
  const config = EXTERNAL[audience]

  if (audience === 'professionals') {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            setComingSoonOpen(true)
          }}
          className={cn(className)}
        >
          {children}
        </button>
        <ComingSoonModal
          open={comingSoonOpen}
          onOpenChange={setComingSoonOpen}
        />
      </>
    )
  }

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

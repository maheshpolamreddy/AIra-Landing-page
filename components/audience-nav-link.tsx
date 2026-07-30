'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { ComingSoonModal } from '@/components/coming-soon-modal'
import { getUserAppRole } from '@/lib/firebase/auth'
import { homeForRole } from '@/lib/auth-redirect'
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
 * Schools: logged out → /login?intent=school · logged in → same-tab tutor home by Firestore role
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
  const [portalHref, setPortalHref] = useState(EXTERNAL.schools.href)
  const config = EXTERNAL[audience]

  useEffect(() => {
    if (audience !== 'schools' || !user) return
    let cancelled = false
    void getUserAppRole(user.uid).then((role) => {
      if (!cancelled) setPortalHref(homeForRole(role))
    })
    return () => {
      cancelled = true
    }
  }, [audience, user])

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
    // Same-tab navigation so Vite/tutor assets load on this origin (no blank new-tab).
    return (
      <a
        href={portalHref}
        onClick={(e) => {
          onNavigate?.()
          // Force full navigation so the tutor SPA bootstraps via rewrites
          e.preventDefault()
          window.location.assign(portalHref)
        }}
        className={cn(className)}
      >
        {children}
      </a>
    )
  }

  return (
    <Link href={config.loginHref} onClick={onNavigate} className={cn(className)}>
      {children}
    </Link>
  )
}

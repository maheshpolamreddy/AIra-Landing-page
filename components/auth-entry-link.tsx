'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { getUserAppRole } from '@/lib/firebase/auth'
import { homeForRole } from '@/lib/auth-redirect'
import { cn } from '@/lib/utils'

type AuthEntryLinkProps = {
  /** Destination when logged out */
  href: string
  className?: string
  children: ReactNode
  onNavigate?: () => void
  /** Use full page assign for tutor paths even when logged out (rare) */
  forceAssign?: boolean
}

/**
 * Logged out → Next Link to /login or /signup.
 * Logged in → same-tab full navigation to Firestore role home (tutor SPA).
 */
export function AuthEntryLink({
  href,
  className,
  children,
  onNavigate,
  forceAssign = false,
}: AuthEntryLinkProps) {
  const { user, loading } = useAuth()
  const [portalHref, setPortalHref] = useState('/student/mode-selection')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void getUserAppRole(user.uid).then((role) => {
      if (!cancelled) setPortalHref(homeForRole(role))
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!loading && user) {
    return (
      <a
        href={portalHref}
        className={cn(className)}
        onClick={(e) => {
          onNavigate?.()
          e.preventDefault()
          window.location.assign(portalHref)
        }}
      >
        {children}
      </a>
    )
  }

  if (forceAssign) {
    return (
      <a
        href={href}
        className={cn(className)}
        onClick={(e) => {
          onNavigate?.()
          e.preventDefault()
          window.location.assign(href)
        }}
      >
        {children}
      </a>
    )
  }

  return (
    <Link href={href} onClick={onNavigate} className={cn(className)}>
      {children}
    </Link>
  )
}

'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail } from 'lucide-react'
import {
  AuthShell,
  authPrimaryBtnClassName,
} from '@/components/auth-shell'
import { useAuth } from '@/components/auth-provider'
import {
  normalizeAppRole,
  resolvePostAuthPath,
} from '@/lib/auth-redirect'
import {
  logOut,
  needsEmailVerification,
  reloadCurrentUser,
  resolveRoleForRedirect,
  sendVerificationEmail,
} from '@/lib/firebase/auth'
import { readRoleHint, readStudentHomeHint, writeRoleHint } from '@/lib/session-hints'

function VerifyFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--neutral-50)]">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyEmailContent />
    </Suspense>
  )
}

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')
  const { user, loading: authLoading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState<'resend' | 'check' | 'other' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const continued = useRef(false)

  const goAfterAuth = useCallback(async (uid: string) => {
    const role = normalizeAppRole(await resolveRoleForRedirect(uid, readRoleHint()))
    writeRoleHint(role)
    const dest = resolvePostAuthPath({
      redirect: redirectParam,
      role,
      studentHome: readStudentHomeHint(),
    })
    window.location.assign(dest)
  }, [redirectParam])

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (authLoading || continued.current) return
    if (!user) {
      const q = redirectParam
        ? `/login?redirect=${encodeURIComponent(redirectParam)}`
        : '/login'
      window.location.assign(q)
      return
    }
    if (!needsEmailVerification(user)) {
      continued.current = true
      void goAfterAuth(user.uid)
    }
  }, [authLoading, user, goAfterAuth, redirectParam])

  useEffect(() => {
    if (!user || !needsEmailVerification(user)) return
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const next = await reloadCurrentUser()
          if (next && !needsEmailVerification(next) && !continued.current) {
            continued.current = true
            await goAfterAuth(next.uid)
          }
        } catch {
          /* keep waiting */
        }
      })()
    }, 4000)
    return () => window.clearInterval(id)
  }, [user, goAfterAuth])

  const handleResend = async () => {
    setError(null)
    setInfo(null)
    setBusy('resend')
    try {
      await sendVerificationEmail()
      setInfo('Verification email sent. Check your inbox and spam folder.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email. Try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  const handleChecked = async () => {
    setError(null)
    setInfo(null)
    setBusy('check')
    try {
      const next = await reloadCurrentUser()
      if (next && !needsEmailVerification(next)) {
        continued.current = true
        await goAfterAuth(next.uid)
        return
      }
      setError('Email is not verified yet. Open the link we sent, then try again.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check verification yet.')
    } finally {
      setBusy(null)
    }
  }

  const handleDifferentEmail = async () => {
    setBusy('other')
    try {
      await logOut()
    } catch {
      /* still leave the page */
    }
    window.location.assign(
      redirectParam
        ? `/signup?redirect=${encodeURIComponent(redirectParam)}`
        : '/signup',
    )
  }

  if (!mounted || authLoading || !user || !needsEmailVerification(user)) {
    return <VerifyFallback />
  }

  return (
    <AuthShell
      panelHeadline="Confirm your inbox"
      panelSupport="We sent a verification link so only a real mailbox can open Aɪra."
    >
      <div className="mb-6">
        <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-foreground">
          <Mail className="size-5 stroke-[1.75]" aria-hidden />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Verify your email
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We sent a link to{' '}
          <span className="font-medium text-foreground">{user.email}</span>.
          Open it, then come back here. Check spam if you do not see it.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-sm font-medium text-[var(--error)]">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="mb-4 text-sm font-medium text-foreground">
          {info}
        </p>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleChecked()}
          className={authPrimaryBtnClassName}
        >
          {busy === 'check' ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Checking…
            </span>
          ) : (
            'I’ve verified'
          )}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleResend()}
          className="h-11 w-full rounded-[var(--radius-btn)] border border-border bg-card text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-60"
        >
          {busy === 'resend' ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Sending…
            </span>
          ) : (
            'Resend email'
          )}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handleDifferentEmail()}
          className="h-11 w-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
        >
          Use a different email
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Wrong page?{' '}
        <Link
          href={
            redirectParam
              ? `/login?redirect=${encodeURIComponent(redirectParam)}`
              : '/login'
          }
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}

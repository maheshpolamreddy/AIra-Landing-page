'use client'

import { Suspense, useState, useEffect, useRef, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SocialLogin } from '@/components/social-login'
import {
  AuthShell,
  authInputClassName,
  authLabelClassName,
  authLinkClassName,
  authPrimaryBtnClassName,
} from '@/components/auth-shell'
import {
  logOut,
  resolveRoleForRedirect,
  signInWithEmail,
  needsEmailVerification,
  reloadCurrentUser,
  retryWelcomeEmailIfPending,
} from '@/lib/firebase/auth'
import { useAuth } from '@/components/auth-provider'
import { LOGIN_INTENT_COPY, portalHrefForIntent } from '@/lib/site'
import { getVerifyEmailPath, resolvePostAuthPath } from '@/lib/auth-redirect'
import { navigateAfterAuth, navigateToLanding } from '@/lib/navigation'
import { checkEmailQuality } from '@/lib/email-quality'
import {
  clearRoleHint,
  readRoleHint,
  writeRoleHint,
} from '@/lib/session-hints'

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <Loader2 className="size-6 animate-spin text-[#1d4ed8]" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}

async function reloadWithRetry(maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const next = await reloadCurrentUser()
      if (next?.emailVerified) return next
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
      } else if (next) {
        return next
      }
    } catch {
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
      }
    }
  }
  return null
}

function LoginPageContent() {
  const searchParams = useSearchParams()
  const intent = searchParams.get('intent')
  const redirectParam = searchParams.get('redirect')
  const [fromSignOut] = useState(() => searchParams.get('signedOut') === '1')
  const intentCopy =
    intent && LOGIN_INTENT_COPY[intent] ? LOGIN_INTENT_COPY[intent] : null
  const externalPortal = portalHrefForIntent(intent)
  const { user, loading: authLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const goAfterAuth = async (
    uid: string,
    opts?: { retryWelcome?: boolean; user?: typeof user },
  ) => {
    if (intent === 'professional') {
      window.location.assign('/')
      return
    }
    if (externalPortal) {
      window.location.assign(externalPortal)
      return
    }
    const current = opts?.user
    if (current && needsEmailVerification(current)) {
      navigateToLanding(getVerifyEmailPath(redirectParam))
      return
    }
    if (opts?.retryWelcome && opts.user) {
      await retryWelcomeEmailIfPending(
        opts.user,
        opts.user.displayName?.trim() || opts.user.email?.split('@')[0],
      )
    }
    const role = await resolveRoleForRedirect(uid, readRoleHint())
    writeRoleHint(role)
    navigateAfterAuth(
      resolvePostAuthPath({ redirect: redirectParam, role }),
    )
  }

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const [signOutSettled, setSignOutSettled] = useState(!fromSignOut)
  useEffect(() => {
    if (!fromSignOut) return
    clearRoleHint()
    void logOut()
      .catch(() => {})
      .finally(() => {
        setSignOutSettled(true)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          params.delete('signedOut')
          const qs = params.toString()
          window.history.replaceState(null, '', qs ? `/login?${qs}` : '/login')
        }
      })
  }, [fromSignOut])

  const autoContinued = useRef(false)
  useEffect(() => {
    if (!mounted || fromSignOut) return
    if (authLoading || !user || autoContinued.current || loading) return
    autoContinued.current = true
    void (async () => {
      let current = user
      const fromVerifyLink = searchParams.get('verified') === '1'
      if (fromVerifyLink) {
        const next = await reloadWithRetry()
        if (next) current = next
      }
      if (needsEmailVerification(current)) {
        navigateToLanding(getVerifyEmailPath(redirectParam))
        return
      }
      await goAfterAuth(current.uid, {
        retryWelcome: fromVerifyLink,
        user: current,
      })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, authLoading, user, loading, fromSignOut])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const emailCheck = checkEmailQuality(email)
    if (!emailCheck.ok) {
      setError(emailCheck.error)
      return
    }
    if (!password.trim()) {
      setError('Enter your password.')
      return
    }
    setLoading(true)
    try {
      const cred = await signInWithEmail(emailCheck.email, password)
      await goAfterAuth(cred.user.uid, {
        retryWelcome: true,
        user: cred.user,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  if (!signOutSettled) return <LoginFallback />
  if (mounted && user && !fromSignOut) return <LoginFallback />

  const signupHref = (() => {
    const params = new URLSearchParams()
    if (redirectParam) params.set('redirect', redirectParam)
    if (intent) params.set('intent', intent)
    const q = params.toString()
    return q ? `/signup?${q}` : '/signup'
  })()

  return (
    <AuthShell
      variant="login"
      panelHeadline="Welcome back"
      panelSupport="Sign in to continue learning with personalized AI paths for exams and careers."
    >
      <div className="mb-6">
        <h2 className="text-[1.65rem] font-bold tracking-tight text-slate-900">
          Sign in
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          {intentCopy ?? 'Enter your credentials to continue.'}
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email" className={authLabelClassName}>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            autoComplete="email"
            className={authInputClassName}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password" className={authLabelClassName}>
              Password
            </Label>
            <Link href="/forgot-password" className={`text-xs ${authLinkClassName}`}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className={`${authInputClassName} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-4 stroke-[1.75]" />
              ) : (
                <Eye className="size-4 stroke-[1.75]" />
              )}
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className={authPrimaryBtnClassName}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Signing in…
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs text-slate-400">
          <span className="bg-white px-3">or</span>
        </div>
      </div>

      <SocialLogin
        layout="pair"
        onError={(msg) => setError(msg || null)}
        onSignedIn={async (uid) => {
          await goAfterAuth(uid)
        }}
      />

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href={signupHref} className={authLinkClassName}>
          Create account
        </Link>
      </p>

      <Link
        href="/"
        className="mt-4 flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
      >
        <ArrowLeft className="size-3.5 stroke-[1.75]" aria-hidden />
        Back to home
      </Link>
    </AuthShell>
  )
}

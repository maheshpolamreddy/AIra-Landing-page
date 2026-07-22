'use client'

import { Suspense, useState, useEffect, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SocialLogin } from '@/components/social-login'
import {
  AuthShell,
  authInputClassName,
  authLabelClassName,
  authPrimaryBtnClassName,
} from '@/components/auth-shell'
import { signInWithEmail } from '@/lib/firebase/auth'
import { useAuth } from '@/components/auth-provider'
import { LOGIN_INTENT_COPY, portalHrefForIntent } from '@/lib/site'

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--neutral-50)]">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
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

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const intent = searchParams.get('intent')
  const intentCopy =
    intent && LOGIN_INTENT_COPY[intent] ? LOGIN_INTENT_COPY[intent] : null
  const portalHref = portalHrefForIntent(intent)
  const { user, loading: authLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const goAfterAuth = () => {
    if (portalHref) {
      window.location.assign(portalHref)
      return
    }
    router.replace('/')
    router.refresh()
  }

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!authLoading && user) {
      if (portalHref) {
        window.location.assign(portalHref)
      } else {
        router.replace('/')
      }
    }
  }, [authLoading, user, router, portalHref])

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmail(email, password)
      goAfterAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted || authLoading) return <LoginFallback />
  if (user) return null

  return (
    <AuthShell
      panelHeadline="Welcome back"
      panelSupport="Sign in to continue learning with personalized AI paths for exams and careers."
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Sign in
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {intentCopy ?? 'Enter your credentials to continue.'}
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
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
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
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
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

        {error && (
          <p role="alert" className="text-sm font-medium text-[var(--error)]">
            {error}
          </p>
        )}

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

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs text-muted-foreground">
          <span className="bg-card px-3">or</span>
        </div>
      </div>

      <SocialLogin
        onError={setError}
        redirectTo={portalHref ?? '/'}
      />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create one now
        </Link>
      </p>

      <Link
        href="/"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5 stroke-[1.75]" aria-hidden />
        Back to home
      </Link>
    </AuthShell>
  )
}

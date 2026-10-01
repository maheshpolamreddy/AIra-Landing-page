'use client'

import { Suspense, useState, useEffect, useRef, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SocialLogin } from '@/components/social-login'
import { PasswordStrength } from '@/components/password-strength'
import {
  AuthShell,
  authInputClassName,
  authLabelClassName,
  authAccentBtnClassName,
  authLinkClassName,
} from '@/components/auth-shell'
import {
  resolveRoleForRedirect,
  signUpWithEmail,
  needsEmailVerification,
} from '@/lib/firebase/auth'
import { useAuth } from '@/components/auth-provider'
import { readRoleHint, writeRoleHint } from '@/lib/session-hints'
import {
  getVerifyEmailPath,
  normalizeAppRole,
  resolvePostAuthPath,
  type AppRole,
} from '@/lib/auth-redirect'
import { checkEmailQuality } from '@/lib/email-quality'
import { navigateAfterAuth, navigateToLanding } from '@/lib/navigation'

function SignupFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <Loader2 className="size-6 animate-spin text-[#1d4ed8]" />
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupPageContent />
    </Suspense>
  )
}

function SignupPageContent() {
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')
  const intent = searchParams.get('intent')
  const { user, loading: authLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const role: AppRole = 'student'
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const goAfterAuth = async (uid: string, explicitRole?: AppRole) => {
    const resolved = normalizeAppRole(
      explicitRole ?? (await resolveRoleForRedirect(uid, readRoleHint())),
    )
    writeRoleHint(resolved)
    navigateAfterAuth(
      resolvePostAuthPath({ redirect: redirectParam, role: resolved }),
    )
  }

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const autoContinued = useRef(false)
  useEffect(() => {
    if (!mounted) return
    if (authLoading || !user || autoContinued.current || loading) return
    autoContinued.current = true
    if (needsEmailVerification(user)) {
      navigateToLanding(getVerifyEmailPath(redirectParam))
      return
    }
    void goAfterAuth(user.uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, authLoading, user, loading])

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.')
      return
    }

    const emailCheck = checkEmailQuality(email)
    if (!emailCheck.ok) {
      setError(emailCheck.error)
      return
    }

    setLoading(true)
    try {
      const result = await signUpWithEmail({
        name,
        email: emailCheck.email,
        password,
        dateOfBirth: dob || undefined,
        role,
      })
      writeRoleHint(normalizeAppRole(role))
      const verifyPath = getVerifyEmailPath(redirectParam)
      if (result.verificationEmailSent === false) {
        navigateToLanding(`${verifyPath}&verificationPending=1`)
      } else {
        navigateToLanding(verifyPath)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.')
    } finally {
      setLoading(false)
    }
  }

  if (mounted && user) return <SignupFallback />

  return (
    <AuthShell
      variant="signup"
      panelHeadline="Create your account"
      panelSupport="Join learners using AIra for JEE, NEET, and career skills — personalized to how you learn."
    >
      <div className="mb-5">
        <h2 className="text-[1.65rem] font-bold tracking-tight text-slate-900">
          Create account
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Start free. No credit card required.
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-3.5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name" className={authLabelClassName}>
            Full name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            autoComplete="name"
            className={authInputClassName}
          />
        </div>

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
          <Label htmlFor="dob" className={authLabelClassName}>
            Date of birth
          </Label>
          <Input
            id="dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            required
            className={authInputClassName}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className={authLabelClassName}>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              autoComplete="new-password"
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

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password" className={authLabelClassName}>
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              className={`${authInputClassName} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
            >
              {showConfirm ? (
                <EyeOff className="size-4 stroke-[1.75]" />
              ) : (
                <Eye className="size-4 stroke-[1.75]" />
              )}
            </button>
          </div>
        </div>

        <PasswordStrength password={password} />

        {error ? (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className={authAccentBtnClassName}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Creating…
            </span>
          ) : (
            'Create account'
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
          writeRoleHint(normalizeAppRole(role))
          await goAfterAuth(uid, normalizeAppRole(role))
        }}
      />

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link
          href={(() => {
            const params = new URLSearchParams()
            if (redirectParam) params.set('redirect', redirectParam)
            if (intent) params.set('intent', intent)
            const q = params.toString()
            return q ? `/login?${q}` : '/login'
          })()}
          className={authLinkClassName}
        >
          Sign in
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

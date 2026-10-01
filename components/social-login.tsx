'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleMark, PhoneMark } from '@/components/brand-icons'
import {
  authInputClassName,
  authLabelClassName,
  authPrimaryBtnClassName,
  authSocialBtnClassName,
} from '@/components/auth-shell'
import {
  confirmPhoneSignIn,
  startPhoneSignIn,
  signInWithGoogle,
  type PhoneSignInSession,
} from '@/lib/firebase/auth'
import { cn } from '@/lib/utils'

type SocialLoginProps = {
  onError?: (message: string) => void
  onSignedIn?: (uid: string) => void | Promise<void>
  redirectTo?: string
  /** `pair` matches login screenshot (Google | Phone). */
  layout?: 'stack' | 'pair'
}

/**
 * Social row for auth screens.
 * Google uses Firebase popup; Phone uses Firebase SMS OTP.
 */
export function SocialLogin({
  onError,
  onSignedIn,
  redirectTo = '/',
  layout = 'pair',
}: SocialLoginProps) {
  const router = useRouter()
  const baseId = useId().replace(/:/g, '')
  const [captchaKey, setCaptchaKey] = useState(0)
  const captchaHostRef = useRef<HTMLDivElement | null>(null)
  const [busy, setBusy] = useState<'google' | 'phone' | null>(null)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const sessionRef = useRef<PhoneSignInSession | null>(null)

  useEffect(() => {
    return () => {
      sessionRef.current = null
    }
  }, [])

  const finish = async (uid: string) => {
    if (onSignedIn) {
      await onSignedIn(uid)
      return
    }
    if (/^https?:\/\//i.test(redirectTo)) {
      window.location.assign(redirectTo)
      return
    }
    router.replace(redirectTo)
    router.refresh()
  }

  /** Force a brand-new empty reCAPTCHA host before every SMS attempt. */
  const remountRecaptchaHost = (): HTMLDivElement => {
    flushSync(() => {
      setCaptchaKey((k) => k + 1)
    })
    const el = captchaHostRef.current
    if (!el) {
      throw new Error('Phone verification failed to initialize. Refresh and try again.')
    }
    el.replaceChildren()
    return el
  }

  const handleGoogle = () => {
    if (busy) return
    setBusy('google')
    onError?.('')
    void signInWithGoogle()
      .then(async (cred) => {
        await finish(cred.user.uid)
      })
      .catch((err: unknown) => {
        onError?.(
          err instanceof Error ? err.message : 'Google sign-in failed. Please try again.',
        )
      })
      .finally(() => setBusy(null))
  }

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy('phone')
    onError?.('')
    try {
      const host = remountRecaptchaHost()
      const session = await startPhoneSignIn(phone, host)
      sessionRef.current = session
      setOtpSent(true)
    } catch (err) {
      try {
        remountRecaptchaHost()
      } catch {
        /* ignore remount failure after error */
      }
      onError?.(
        err instanceof Error ? err.message : 'Could not send verification code.',
      )
    } finally {
      setBusy(null)
    }
  }

  const handleConfirmOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !sessionRef.current) return
    setBusy('phone')
    onError?.('')
    try {
      const cred = await confirmPhoneSignIn(sessionRef.current, otp)
      sessionRef.current = null
      await finish(cred.user.uid)
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Invalid verification code.',
      )
    } finally {
      setBusy(null)
    }
  }

  const captchaContainerId = `recaptcha-${baseId}-${captchaKey}`

  return (
    <div className="relative w-full space-y-3">
      <div
        className={cn(
          layout === 'pair' ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-1 gap-2.5',
        )}
      >
        <Button
          type="button"
          variant="outline"
          disabled={!!busy}
          onClick={handleGoogle}
          className={authSocialBtnClassName}
        >
          {busy === 'google' ? (
            <Loader2 className="size-[18px] shrink-0 animate-spin" aria-hidden />
          ) : (
            <GoogleMark className="size-[18px] shrink-0" />
          )}
          <span>{busy === 'google' ? 'Connecting…' : 'Google'}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={!!busy}
          onClick={() => {
            setPhoneOpen((v) => !v)
            onError?.('')
            if (!phoneOpen) {
              try {
                remountRecaptchaHost()
              } catch {
                /* host mounts with captchaKey on next paint */
              }
            }
          }}
          className={authSocialBtnClassName}
          aria-expanded={phoneOpen}
        >
          <PhoneMark className="size-[18px] shrink-0 text-slate-600" />
          <span>Phone</span>
        </Button>
      </div>

      <div
        key={captchaContainerId}
        id={captchaContainerId}
        ref={captchaHostRef}
        data-aira-recaptcha="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />

      {phoneOpen && (
        <form
          onSubmit={otpSent ? handleConfirmOtp : handleSendOtp}
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5"
        >
          {!otpSent ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`phone-${baseId}`} className={authLabelClassName}>
                  Mobile number
                </Label>
                <Input
                  id={`phone-${baseId}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className={authInputClassName}
                />
                <p className="text-[11px] text-slate-500">
                  Include country code (e.g. +91 for India).
                </p>
              </div>
              <button type="submit" disabled={!!busy} className={authPrimaryBtnClassName}>
                {busy === 'phone' ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Sending code…
                  </span>
                ) : (
                  'Send code'
                )}
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`otp-${baseId}`} className={authLabelClassName}>
                  Verification code
                </Label>
                <Input
                  id={`otp-${baseId}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  required
                  className={authInputClassName}
                />
              </div>
              <button type="submit" disabled={!!busy} className={authPrimaryBtnClassName}>
                {busy === 'phone' ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Verifying…
                  </span>
                ) : (
                  'Verify & sign in'
                )}
              </button>
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-[#2563eb] hover:underline"
                onClick={() => {
                  setOtpSent(false)
                  setOtp('')
                  sessionRef.current = null
                  try {
                    remountRecaptchaHost()
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Use a different number
              </button>
            </>
          )}
        </form>
      )}
    </div>
  )
}

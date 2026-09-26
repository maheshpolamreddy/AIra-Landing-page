'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppleMark, GoogleMark, MicrosoftMark } from '@/components/brand-icons'
import { authSocialBtnClassName } from '@/components/auth-shell'
import {
  signInWithApple,
  signInWithGoogle,
  signInWithMicrosoft,
} from '@/lib/firebase/auth'

type Provider = 'google' | 'apple' | 'microsoft'

type SocialLoginProps = {
  onError?: (message: string) => void
  onSignedIn?: (uid: string) => void | Promise<void>
  redirectTo?: string
}

/**
 * Reference screenshot social row: Google, Apple, Microsoft — always shown.
 * Wired to real Firebase providers (not demo phone OTP).
 */
const PROVIDERS: Array<{
  id: Provider
  label: string
  busyLabel: string
  Icon: typeof GoogleMark
  signIn: () => Promise<{ user: { uid: string } }>
}> = [
  {
    id: 'google',
    label: 'Continue with Google',
    busyLabel: 'Connecting…',
    Icon: GoogleMark,
    signIn: signInWithGoogle,
  },
  {
    id: 'apple',
    label: 'Continue with Apple',
    busyLabel: 'Connecting…',
    Icon: AppleMark,
    signIn: signInWithApple,
  },
  {
    id: 'microsoft',
    label: 'Continue with Microsoft',
    busyLabel: 'Connecting…',
    Icon: MicrosoftMark,
    signIn: signInWithMicrosoft,
  },
]

export function SocialLogin({
  onError,
  onSignedIn,
  redirectTo = '/',
}: SocialLoginProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<Provider | null>(null)

  const handle = (provider: Provider) => {
    if (busy) return
    const entry = PROVIDERS.find((p) => p.id === provider)
    if (!entry) return
    setBusy(provider)

    void entry
      .signIn()
      .then(async (cred) => {
        if (onSignedIn) {
          await onSignedIn(cred.user.uid)
          return
        }
        if (/^https?:\/\//i.test(redirectTo)) {
          window.location.assign(redirectTo)
          return
        }
        router.replace(redirectTo)
        router.refresh()
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
        onError?.(message)
      })
      .finally(() => setBusy(null))
  }

  return (
    <div className="grid w-full grid-cols-1 gap-2.5">
      {PROVIDERS.map(({ id, label, busyLabel, Icon }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          disabled={!!busy}
          onClick={() => handle(id)}
          className={authSocialBtnClassName}
        >
          {busy === id ? (
            <Loader2 className="size-[18px] shrink-0 animate-spin" aria-hidden />
          ) : (
            <Icon className="size-[18px] shrink-0" />
          )}
          <span>{busy === id ? busyLabel : label}</span>
        </Button>
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AppleMark, GoogleMark, MicrosoftMark } from '@/components/brand-icons'
import {
  signInWithApple,
  signInWithGoogle,
  signInWithMicrosoft,
} from '@/lib/firebase/auth'

type Provider = 'google' | 'apple' | 'microsoft'

type SocialLoginProps = {
  onError?: (message: string) => void
  redirectTo?: string
}

const btnClass =
  'flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-btn)] border border-border bg-card text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60'

export function SocialLogin({
  onError,
  redirectTo = '/',
}: SocialLoginProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<Provider | null>(null)

  const handle = (provider: Provider) => {
    if (busy) return
    setBusy(provider)

    // Kick off auth without an intervening await before the provider call
    // (popup must stay tied to the user gesture).
    const run =
      provider === 'google'
        ? signInWithGoogle()
        : provider === 'apple'
          ? signInWithApple()
          : signInWithMicrosoft()

    void run
      .then(() => {
        // External portal URLs need a full navigation; internal paths use the router
        if (/^https?:\/\//i.test(redirectTo)) {
          window.location.assign(redirectTo)
          return
        }
        router.replace(redirectTo)
        router.refresh()
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Sign-in failed. Please try again.'
        onError?.(message)
      })
      .finally(() => {
        setBusy(null)
      })
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={!!busy}
        onClick={() => handle('google')}
        className={btnClass}
      >
        <GoogleMark className="size-[18px] shrink-0" />
        <span>{busy === 'google' ? 'Connecting…' : 'Continue with Google'}</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={!!busy}
        onClick={() => handle('apple')}
        className={btnClass}
      >
        <AppleMark className="size-[18px] shrink-0" />
        <span>{busy === 'apple' ? 'Connecting…' : 'Continue with Apple'}</span>
      </Button>

      <Button
        type="button"
        variant="outline"
        disabled={!!busy}
        onClick={() => handle('microsoft')}
        className={btnClass}
      >
        <MicrosoftMark className="size-[18px] shrink-0" />
        <span>
          {busy === 'microsoft' ? 'Connecting…' : 'Continue with Microsoft'}
        </span>
      </Button>
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BRAND } from '@/lib/site'
import { cn } from '@/lib/utils'

type AuthShellProps = {
  children: ReactNode
  panelHeadline: ReactNode
  panelSupport: string
  /** Login = solid blue; signup = blue→teal gradient (reference screenshots). */
  variant?: 'login' | 'signup'
  imageCaption?: string
  footerNote?: string
}

/**
 * Split auth layout matching reference screenshots:
 * left brand panel + right light form stage.
 */
export function AuthShell({
  children,
  panelHeadline,
  panelSupport,
  variant = 'login',
  imageCaption = `Students learning with ${BRAND.name}`,
  footerNote = 'AI-powered learning for exams and careers',
}: AuthShellProps) {
  const panelBg =
    variant === 'signup'
      ? 'bg-[linear-gradient(155deg,#3b82f6_0%,#2563eb_42%,#0d9488_100%)]'
      : 'bg-[#1d4ed8]'

  return (
    <div className="relative flex min-h-screen bg-[#f8fafc]">
      <aside
        className={cn(
          'relative hidden w-[46%] shrink-0 flex-col overflow-hidden px-10 py-10 text-white lg:flex xl:w-[48%] xl:px-14 xl:py-12',
          panelBg,
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(255,255,255,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 100%, rgba(15,23,42,0.25), transparent 50%)',
          }}
        />

        <Link
          href="/"
          className="relative z-10 inline-flex w-fit items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          aria-label={BRAND.name}
        >
          <AuthBrandMark />
          <span className="text-[1.35rem] font-bold tracking-tight text-white">
            {BRAND.name}
          </span>
        </Link>

        <div className="relative z-10 mt-12 flex max-w-[28rem] flex-1 flex-col">
          <h1 className="text-[2.45rem] font-bold leading-[1.12] tracking-tight text-white xl:text-[2.75rem]">
            {panelHeadline}
          </h1>
          <p className="mt-4 max-w-[26rem] text-[1.02rem] leading-relaxed text-white/90">
            {panelSupport}
          </p>

          <figure className="mt-10 w-full max-w-[22rem]">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-[0_28px_60px_-24px_rgba(0,0,0,0.55)] ring-1 ring-white/25">
              <Image
                src={BRAND.authVisualSrc}
                alt={imageCaption}
                width={560}
                height={700}
                className="absolute inset-0 h-full w-full object-cover object-center"
                priority
              />
            </div>
            <figcaption className="mt-3 text-sm font-medium text-white/80">
              {imageCaption}
            </figcaption>
          </figure>
        </div>

        <p className="relative z-10 mt-auto pt-8 text-sm text-white/70">{footerNote}</p>
      </aside>

      <main className="relative flex flex-1 flex-col bg-[#f8fafc]">
        <div className="flex items-center px-5 pt-6 sm:px-8 lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            aria-label={BRAND.name}
          >
            <AuthBrandMark tone="dark" />
            <span className="text-lg font-bold tracking-tight text-slate-900">
              {BRAND.name}
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[420px]">
            <div
              className={cn(
                'rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-8',
                'shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]',
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function AuthBrandMark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <span
      className={cn(
        'relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full',
        tone === 'light' ? 'bg-white/15 ring-1 ring-white/30' : 'bg-blue-50 ring-1 ring-blue-100',
      )}
    >
      <Image
        src={BRAND.iconSrc}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
        priority
      />
    </span>
  )
}

/** Field inputs — light bordered style from auth screenshots */
export const authInputClassName =
  'h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:border-blue-500 focus-visible:ring-[3px] focus-visible:ring-blue-500/15'

export const authLabelClassName =
  'text-[13px] font-semibold text-slate-800'

/** Login / recovery primary — dark navy */
export const authPrimaryBtnClassName =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0f172a] text-[15px] font-semibold text-white transition hover:bg-[#1e293b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60'

/** Signup primary — same navy as reference Create account */
export const authAccentBtnClassName = authPrimaryBtnClassName

export const authSocialBtnClassName =
  'flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60'

export const authLinkClassName =
  'font-semibold text-[#2563eb] hover:underline'

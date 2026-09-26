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
}

/**
 * Auth layout from reference screenshots:
 * `apps/landing/screenshot_login.png` + `screenshot_signup.png`
 */
export function AuthShell({
  children,
  panelHeadline,
  panelSupport,
}: AuthShellProps) {
  return (
    <div className="auth-gateway relative flex min-h-screen overflow-hidden">
      <AuthGatewayBackdrop />

      <aside className="relative z-10 hidden w-[50%] shrink-0 flex-col px-12 py-11 lg:flex xl:px-16">
        <Link
          href="/"
          className="inline-flex w-fit focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
          aria-label={BRAND.name}
        >
          <GatewayWordmark />
        </Link>

        <div className="mt-14 max-w-[34rem]">
          <h1 className="text-[2.6rem] font-bold leading-[1.12] tracking-tight text-white xl:text-[3rem]">
            {panelHeadline}
          </h1>
          <p className="mt-5 max-w-[28rem] text-[1.02rem] leading-relaxed text-white/70">
            {panelSupport}
          </p>

          <div className="relative mt-10 aspect-[5/4] w-full max-w-[26rem] overflow-hidden rounded-[1.85rem] border border-white/20 shadow-[0_30px_70px_-28px_rgba(0,0,0,0.7)]">
            <Image
              src={BRAND.authVisualSrc}
              alt="Students learning with Aɪra"
              width={720}
              height={576}
              className="absolute inset-0 h-full w-full object-cover object-center"
              priority
            />
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex flex-1 flex-col">
        <div className="flex items-center px-5 pt-6 sm:px-8 lg:hidden">
          <Link href="/" aria-label={BRAND.name}>
            <GatewayWordmark />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div
              className={cn(
                'relative overflow-hidden rounded-[1.85rem] bg-white/95 p-7 backdrop-blur-md sm:p-8',
                'shadow-[0_30px_80px_-24px_rgba(8,15,40,0.7)]',
                'before:absolute before:inset-x-0 before:top-0 before:h-[3px]',
                'before:bg-gradient-to-r before:from-[#38bdf8] before:via-[#60a5fa] before:to-[#22d3ee]',
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

/** Reference wordmark: A (blue) + ira (cyan) */
function GatewayWordmark() {
  return (
    <span className="select-none text-[1.75rem] font-bold tracking-tight sm:text-[1.9rem]">
      <span className="text-[#3b82f6]">A</span>
      <span className="bg-gradient-to-r from-[#22d3ee] to-[#67e8f9] bg-clip-text text-transparent">
        ira
      </span>
    </span>
  )
}

function AuthGatewayBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(150deg,#060912_0%,#0f1730_38%,#1a1238_72%,#0a1020_100%)]" />
      <div className="absolute -left-[20%] top-[-25%] h-[75%] w-[70%] rounded-full bg-[#1d4ed8]/28 blur-[130px]" />
      <div className="absolute -right-[12%] bottom-[-20%] h-[65%] w-[60%] rounded-full bg-[#6d28d9]/22 blur-[140px]" />
      <div className="absolute left-[35%] top-[35%] h-[45%] w-[40%] rounded-full bg-[#0284c7]/14 blur-[110px]" />

      <svg
        className="absolute inset-0 h-full w-full opacity-40"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        <defs>
          <linearGradient id="gw-wave" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path
          d="M0 200C220 60 380 340 620 180S1080 60 1440 240V900H0Z"
          fill="url(#gw-wave)"
        />
        <path
          d="M0 430C240 290 420 580 720 420S1180 280 1440 500V900H0Z"
          fill="url(#gw-wave)"
          opacity="0.7"
        />
      </svg>

      <svg className="absolute inset-0 h-full w-full opacity-[0.32]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="gw-nodes" width="80" height="80" patternUnits="userSpaceOnUse">
            <circle cx="6" cy="8" r="1.35" fill="#93c5fd" />
            <circle cx="44" cy="32" r="1.1" fill="#a5b4fc" />
            <circle cx="68" cy="58" r="1.2" fill="#67e8f9" />
            <path d="M6 8L44 32M44 32L68 58" stroke="#93c5fd" strokeWidth="0.55" strokeOpacity="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gw-nodes)" />
      </svg>
    </div>
  )
}

export const authInputClassName =
  'h-12 rounded-2xl border-0 bg-[#eef1f6] px-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-sky-400/30'

export const authLabelClassName =
  'text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400'

/** Login primary — dark navy (screenshot_login) */
export const authPrimaryBtnClassName =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0b162c] text-[15px] font-semibold text-white shadow-[0_14px_30px_-10px_rgba(11,22,44,0.7)] transition hover:bg-[#132442] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-60'

/** Signup primary — blue→violet gradient (screenshot_signup) */
export const authAccentBtnClassName =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#3b82f6] via-[#4f46e5] to-[#7c3aed] text-[15px] font-semibold text-white shadow-[0_16px_34px_-10px_rgba(79,70,229,0.65)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-60'

export const authSocialBtnClassName =
  'flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-60'

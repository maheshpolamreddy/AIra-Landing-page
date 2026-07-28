'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrandIcon, BrandWordmark } from '@/components/brand'
import { BRAND } from '@/lib/site'
import { cn } from '@/lib/utils'

const HOLD_MS = 3000
const TRANSITION_MS = 720
const GLOW_MS = 280

type Phase = 'hold' | 'exiting' | 'entering' | 'glow'
/** 0 = full wordmark (Logo 1), 1 = brand icon (Logo 2) */
type LogoIndex = 0 | 1

/**
 * Header brand lockup that gently alternates between the full Aɪra wordmark
 * and the official brand icon. Pauses on hover; respects prefers-reduced-motion.
 */
export function HeaderLogo({
  className,
  tone = 'gradient',
  size = 'md',
}: {
  className?: string
  /** Wordmark color treatment — use `white` on dark auth panels */
  tone?: 'gradient' | 'white'
  size?: 'md' | 'lg'
}) {
  const [index, setIndex] = useState<LogoIndex>(0)
  const [phase, setPhase] = useState<Phase>('hold')
  const [hovered, setHovered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [simplify, setSimplify] = useState(false)

  const hoveredRef = useRef(false)
  const reducedRef = useRef(false)
  const indexRef = useRef<LogoIndex>(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const cycleGenRef = useRef(0)

  useEffect(() => {
    hoveredRef.current = hovered
  }, [hovered])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileQuery = window.matchMedia('(max-width: 767px)')

    const syncMotion = () => {
      reducedRef.current = motionQuery.matches
      setReducedMotion(motionQuery.matches)
    }
    const syncMobile = () => setSimplify(mobileQuery.matches)

    syncMotion()
    syncMobile()
    motionQuery.addEventListener('change', syncMotion)
    mobileQuery.addEventListener('change', syncMobile)
    return () => {
      motionQuery.removeEventListener('change', syncMotion)
      mobileQuery.removeEventListener('change', syncMobile)
    }
  }, [])

  useEffect(() => {
    const img = new window.Image()
    img.decoding = 'async'
    img.src = '/brand/aira-icon.png'
  }, [])

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
    const schedule = (fn: () => void, ms: number) => {
      timersRef.current.push(setTimeout(fn, ms))
    }

    clearTimers()
    const gen = ++cycleGenRef.current

    if (reducedMotion || hovered) {
      return clearTimers
    }

    const alive = () =>
      gen === cycleGenRef.current &&
      !hoveredRef.current &&
      !reducedRef.current

    const tick = () => {
      if (!alive()) return
      schedule(() => {
        if (!alive()) return
        setPhase('hold')
        schedule(() => {
          if (!alive()) return
          setPhase('exiting')
          schedule(() => {
            if (!alive()) return
            const next: LogoIndex = indexRef.current === 0 ? 1 : 0
            indexRef.current = next
            setIndex(next)
            setPhase('entering')
            schedule(() => {
              if (!alive()) return
              setPhase('glow')
              schedule(() => {
                if (!alive()) return
                setPhase('hold')
                tick()
              }, GLOW_MS)
            }, TRANSITION_MS / 2)
          }, TRANSITION_MS / 2)
        }, HOLD_MS)
      }, 0)
    }

    tick()
    return clearTimers
  }, [hovered, reducedMotion])

  const paused = reducedMotion || hovered
  const visualPhase: Phase = paused ? 'hold' : phase
  const displayIndex: LogoIndex = reducedMotion ? 0 : index
  const blurAmount = simplify || reducedMotion ? 0 : 2.5
  const exitScale = simplify ? 0.99 : 0.98
  const showGlow = visualPhase === 'glow' || hovered

  const layerStyle = (layer: LogoIndex) => {
    const isActive = displayIndex === layer

    if (reducedMotion) {
      return {
        opacity: layer === 0 ? 1 : 0,
        transform: 'translateZ(0) scale(1)',
        filter: hovered
          ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.5)) drop-shadow(0 0 14px rgba(59, 130, 246, 0.3))'
          : 'none',
      } as const
    }

    let opacity = isActive ? 1 : 0
    let scale = 1
    let blur = 0

    if (visualPhase === 'exiting') {
      opacity = 0
      scale = exitScale
      blur = blurAmount
    } else if (visualPhase === 'entering') {
      opacity = isActive ? 1 : 0
      scale = isActive ? 1 : exitScale
      blur = isActive ? 0 : blurAmount
    }

    const glow =
      showGlow && isActive
        ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.5)) drop-shadow(0 0 14px rgba(59, 130, 246, 0.3))'
        : 'drop-shadow(0 0 0 transparent)'
    const blurFilter = blur > 0 ? `blur(${blur}px)` : ''

    return {
      opacity,
      transform: `translateZ(0) scale(${scale})`,
      filter: [blurFilter, glow].filter(Boolean).join(' ') || 'none',
    } as const
  }

  return (
    <span
      className={cn(
        'header-logo relative inline-flex shrink-0 items-center justify-center',
        size === 'lg'
          ? 'h-11 w-[6.5rem] sm:h-12 sm:w-[7.25rem]'
          : 'h-10 w-[4.75rem] sm:w-[5.25rem]',
        'origin-center transition-transform duration-[250ms] ease-out will-change-transform',
        hovered && 'scale-105 max-md:scale-[1.03]',
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-hidden
    >
      <Layer style={layerStyle(0)} durationMs={TRANSITION_MS}>
        <BrandWordmark
          tone={tone}
          className={
            size === 'lg'
              ? 'text-2xl sm:text-[1.75rem]'
              : 'text-xl sm:text-[1.35rem]'
          }
        />
      </Layer>
      <Layer style={layerStyle(1)} durationMs={TRANSITION_MS}>
        <span
          className={cn(
            'relative block',
            size === 'lg' ? 'size-10 sm:size-11' : 'size-9 sm:size-10',
          )}
        >
          <BrandIcon
            size={size === 'lg' ? 44 : 40}
            className="size-full"
            priority
          />
        </span>
      </Layer>
      <span className="sr-only">{BRAND.name}</span>
    </span>
  )
}

function Layer({
  children,
  style,
  durationMs,
}: {
  children: ReactNode
  style: { opacity: number; transform: string; filter: string }
  durationMs: number
}) {
  return (
    <span
      className="pointer-events-none absolute inset-0 flex items-center justify-center will-change-[opacity,transform,filter]"
      style={{
        ...style,
        transitionProperty: 'opacity, transform, filter',
        transitionDuration: `${durationMs}ms, ${durationMs}ms, ${GLOW_MS}ms`,
        transitionTimingFunction:
          'cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1), ease-out',
      }}
    >
      {children}
    </span>
  )
}

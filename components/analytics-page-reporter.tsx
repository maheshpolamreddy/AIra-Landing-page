'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  analytics,
  fireTemporaryAnalyticsDebugTest,
  reportNavigationTiming,
} from '@/lib/analytics'

/** Reports page_view + page_performance once per route (client). */
export function AnalyticsPageReporter() {
  const pathname = usePathname()

  useEffect(() => {
    // TEMPORARY — remove after DebugView verification (requires NEXT_PUBLIC_ANALYTICS_DEBUG=true)
    fireTemporaryAnalyticsDebugTest()
  }, [])

  useEffect(() => {
    if (!pathname) return
    analytics.pageView(pathname)
    // Wait for load timing to settle
    const t = window.setTimeout(() => reportNavigationTiming(pathname), 800)
    return () => window.clearTimeout(t)
  }, [pathname])

  return null
}

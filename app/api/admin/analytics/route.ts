import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/content/auth'
import { getAdminFirestore } from '@/lib/content/firestore'
import {
  fetchAdminAnalyticsReport,
  isGa4ReportingConfigured,
  type AnalyticsDatePreset,
} from '@/lib/analytics/admin-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRESETS = new Set(['today', 'yesterday', '7d', '28d', '30d', '90d', 'custom'])

async function countRegisteredUsers(): Promise<number | null> {
  try {
    const snap = await getAdminFirestore().collection('users').count().get()
    return snap.data().count ?? null
  } catch {
    try {
      const snap = await getAdminFirestore().collection('users').limit(5000).get()
      return snap.size
    } catch {
      return null
    }
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, true)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = req.nextUrl
  const presetRaw = (searchParams.get('preset') || '7d') as AnalyticsDatePreset
  const preset = PRESETS.has(presetRaw) ? presetRaw : '7d'
  const startDate = searchParams.get('start') || undefined
  const endDate = searchParams.get('end') || undefined

  try {
    const registeredUsers = await countRegisteredUsers()
    if (!isGa4ReportingConfigured()) {
      const report = await fetchAdminAnalyticsReport({
        preset,
        startDate,
        endDate,
        registeredUsers,
      })
      return NextResponse.json(report)
    }

    const report = await fetchAdminAnalyticsReport({
      preset,
      startDate,
      endDate,
      registeredUsers,
    })
    return NextResponse.json(report)
  } catch (err) {
    const raw = err instanceof Error ? (err.message || 'Error') : 'report_failed'
    const category = raw.startsWith('ga4_') ? raw.split(':')[0] : raw.slice(0, 80)
    console.warn('[admin-analytics]', category)
    const permissionDenied = /403|PERMISSION_DENIED|auth_error/i.test(raw)
    return NextResponse.json(
      {
        configured: false,
        source: 'none',
        error: 'Failed to load analytics report',
        error_category: permissionDenied ? 'ga4_permission_denied' : category,
        message: permissionDenied
          ? 'GA4 Data API permission denied. Grant Analytics Viewer on property 546252206 to firebase-adminsdk-fbsvc@aira-landingpage.iam.gserviceaccount.com (Google Analytics → Admin → Property access management).'
          : 'Could not query GA4. Confirm GA4_PROPERTY_ID=546252206 and that the service account has Analytics Viewer access.',
        propertyId: process.env.GA4_PROPERTY_ID?.replace(/^properties\//, '') || '546252206',
        firestore: { registeredUsers: await countRegisteredUsers() },
      },
      { status: 502 },
    )
  }
}

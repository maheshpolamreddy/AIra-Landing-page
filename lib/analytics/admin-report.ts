/**
 * Admin-only GA4 Data API client (server).
 * Requires GA4_PROPERTY_ID + FIREBASE_SERVICE_ACCOUNT_JSON (or ADC)
 * with Analytics Viewer on the GA4 property.
 */
import { readFileSync } from 'node:fs'
import { GoogleAuth } from 'google-auth-library'
import type { ServiceAccount } from 'firebase-admin/app'

export type AnalyticsDatePreset =
  | 'today'
  | 'yesterday'
  | '7d'
  | '28d'
  | '30d'
  | '90d'
  | 'custom'

export type MetricPoint = { date: string; value: number }

export type NamedCount = { name: string; count: number; users?: number }

export type KpiValue = {
  value: number | null
  previous: number | null
  changePercent: number | null
}

export type AdminAnalyticsReport = {
  configured: boolean
  source: 'ga4' | 'none'
  message?: string
  error?: string
  error_category?: string
  propertyId?: string | null
  range: {
    preset: string
    startDate: string
    endDate: string
    previousStartDate: string
    previousEndDate: string
  }
  kpis: Record<string, KpiValue>
  timeseries: {
    users: MetricPoint[]
    sessions: MetricPoint[]
    newUsers: MetricPoint[]
  }
  topPages: Array<{
    page: string
    views: number
    users: number
  }>
  events: Array<{
    event: string
    count: number
    users: number
    eventsPerUser: number | null
  }>
  modeUsage: NamedCount[]
  curriculum: {
    classes: NamedCount[]
    subjects: NamedCount[]
    topics: NamedCount[]
    lessonStarted: number
    lessonCompleted: number
    lessonExit: number
  }
  competitive: {
    testsStarted: number
    testsCompleted: number
    testsAbandoned: number
    questionsAttempted: number
    answersCorrect: number
    answersIncorrect: number
    modeOpened: number
    examSelected: number
    sectionViews: NamedCount[]
    byFlowType: NamedCount[]
    topExams: NamedCount[]
    explanationsStarted: number
    explanationsCompleted: number
    explanationsExit: number
    performanceViews: number
  }
  aiTeacher: {
    teachingPageViews: number
    lessonsStarted: number
    lessonsCompleted: number
    questionsAsked: number
    answersReceived: number
    errors: number
  }
  auth: {
    signUps: number
    logins: number
    loginFailed: number
    logouts: number
  }
  cache: {
    contentLoaded: number
    cacheHits: number
    cacheMisses: number
  }
  performance: {
    pagePerformanceEvents: number
    apiPerformanceEvents: number
  }
  funnel: Array<{
    stage: string
    event: string
    users: number
    dropOffPercent: number | null
  }>
  devices: NamedCount[]
  browsers: NamedCount[]
  os: NamedCount[]
  countries: NamedCount[]
  errors: NamedCount[]
  realtime: {
    activeUsers: number | null
    label: string
  }
  firestore: {
    registeredUsers: number | null
  }
}

type SaJson = ServiceAccount & { client_email?: string; private_key?: string }

function loadServiceAccountJson(): SaJson | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (inline) {
    let value: unknown = inline
    // Peel quotes / nested JSON-string encodings from dotenv / vercel pull.
    for (let i = 0; i < 4; i++) {
      if (typeof value !== 'string') break
      let trimmed = value.trim()
      if (
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1)
      ) {
        // Only strip matching outer quotes when the interior still looks nested.
        if (trimmed.startsWith("'")) {
          trimmed = trimmed.slice(1, -1)
          value = trimmed
          continue
        }
      }
      if (!(trimmed.startsWith('"') || trimmed.startsWith('{'))) break
      try {
        value = JSON.parse(trimmed)
      } catch {
        const start = trimmed.indexOf('{')
        const end = trimmed.lastIndexOf('}')
        if (start >= 0 && end > start) {
          value = JSON.parse(trimmed.slice(start, end + 1))
        }
        break
      }
    }
    if (value && typeof value === 'object') return value as SaJson
    if (typeof value === 'string') {
      const start = value.indexOf('{')
      const end = value.lastIndexOf('}')
      if (start >= 0 && end > start) {
        return JSON.parse(value.slice(start, end + 1)) as SaJson
      }
    }
    throw new Error('invalid_service_account_json')
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (path) return JSON.parse(readFileSync(path, 'utf8')) as SaJson
  return null
}

function propertyId(): string | null {
  const raw = process.env.GA4_PROPERTY_ID?.trim()
  if (!raw) return null
  return raw.replace(/^properties\//, '')
}

function toGaDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function resolveDateRange(
  preset: AnalyticsDatePreset,
  customStart?: string,
  customEnd?: string,
): {
  startDate: string
  endDate: string
  previousStartDate: string
  previousEndDate: string
  preset: string
} {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const end = new Date(today)
  const start = new Date(today)

  if (preset === 'custom' && customStart && customEnd) {
    const s = new Date(customStart)
    const e = new Date(customEnd)
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
    const prevEnd = new Date(s)
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1))
    return {
      preset: 'custom',
      startDate: toGaDate(s),
      endDate: toGaDate(e),
      previousStartDate: toGaDate(prevStart),
      previousEndDate: toGaDate(prevEnd),
    }
  }

  switch (preset) {
    case 'today':
      break
    case 'yesterday':
      start.setUTCDate(start.getUTCDate() - 1)
      end.setUTCDate(end.getUTCDate() - 1)
      break
    case '28d':
      start.setUTCDate(start.getUTCDate() - 27)
      break
    case '30d':
      start.setUTCDate(start.getUTCDate() - 29)
      break
    case '90d':
      start.setUTCDate(start.getUTCDate() - 89)
      break
    case '7d':
    default:
      start.setUTCDate(start.getUTCDate() - 6)
      break
  }

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  const previousEndDate = new Date(start)
  previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1)
  const previousStartDate = new Date(previousEndDate)
  previousStartDate.setUTCDate(previousStartDate.getUTCDate() - (days - 1))

  return {
    preset,
    startDate: toGaDate(start),
    endDate: toGaDate(end),
    previousStartDate: toGaDate(previousStartDate),
    previousEndDate: toGaDate(previousEndDate),
  }
}

type GaReport = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>
    metricValues?: Array<{ value?: string }>
  }>
  totals?: Array<{ metricValues?: Array<{ value?: string }> }>
}

async function runReport(
  token: string,
  prop: string,
  body: Record<string, unknown>,
): Promise<GaReport> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ga4_report_${res.status}:${text.slice(0, 200)}`)
  }
  return (await res.json()) as GaReport
}

async function runRealtimeReport(
  token: string,
  prop: string,
  body: Record<string, unknown>,
): Promise<GaReport> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runRealtimeReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ga4_realtime_${res.status}:${text.slice(0, 200)}`)
  }
  return (await res.json()) as GaReport
}

function metricNum(report: GaReport, index = 0): number {
  const fromTotals = Number(report.totals?.[0]?.metricValues?.[index]?.value ?? NaN)
  if (Number.isFinite(fromTotals)) return fromTotals
  const fromRow = Number(report.rows?.[0]?.metricValues?.[index]?.value ?? 0)
  return Number.isFinite(fromRow) ? fromRow : 0
}

function kpi(current: number, previous: number): KpiValue {
  let changePercent: number | null = null
  if (previous > 0) changePercent = Math.round(((current - previous) / previous) * 1000) / 10
  else if (current > 0) changePercent = 100
  else changePercent = 0
  return { value: current, previous, changePercent }
}

function emptyKpi(): KpiValue {
  return { value: null, previous: null, changePercent: null }
}

function eventCount(map: Map<string, { count: number; users: number }>, name: string): number {
  return map.get(name)?.count ?? 0
}

function eventUsers(map: Map<string, { count: number; users: number }>, name: string): number {
  return map.get(name)?.users ?? 0
}

export function isGa4ReportingConfigured(): boolean {
  return Boolean(
    propertyId() && (loadServiceAccountJson() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()),
  )
}

async function getAccessToken(): Promise<string> {
  const credentials = loadServiceAccountJson()
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  if (!credentials && !keyFile) {
    throw new Error('missing_credentials')
  }
  const auth = new GoogleAuth({
    credentials: credentials || undefined,
    keyFile: credentials ? undefined : keyFile,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) throw new Error('token_failed')
  return token.token
}

export async function fetchAdminAnalyticsReport(input: {
  preset: AnalyticsDatePreset
  startDate?: string
  endDate?: string
  registeredUsers?: number | null
}): Promise<AdminAnalyticsReport> {
  const range = resolveDateRange(input.preset, input.startDate, input.endDate)
  const prop = propertyId()
  const baseEmpty: AdminAnalyticsReport = {
    configured: false,
    source: 'none',
    propertyId: prop,
    message:
      'Set FIREBASE_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS) and grant that service account Analytics Viewer on GA4 property 546252206.',
    range,
    kpis: {
      activeUsers: emptyKpi(),
      newUsers: emptyKpi(),
      sessions: emptyKpi(),
      pageViews: emptyKpi(),
      engagementRate: emptyKpi(),
      avgEngagementSec: emptyKpi(),
      lessonsStarted: emptyKpi(),
      lessonsCompleted: emptyKpi(),
      testsStarted: emptyKpi(),
      testsCompleted: emptyKpi(),
      registeredUsers: {
        value: input.registeredUsers ?? null,
        previous: null,
        changePercent: null,
      },
    },
    timeseries: { users: [], sessions: [], newUsers: [] },
    topPages: [],
    events: [],
    modeUsage: [],
    curriculum: {
      classes: [],
      subjects: [],
      topics: [],
      lessonStarted: 0,
      lessonCompleted: 0,
      lessonExit: 0,
    },
    competitive: {
      testsStarted: 0,
      testsCompleted: 0,
      testsAbandoned: 0,
      questionsAttempted: 0,
      answersCorrect: 0,
      answersIncorrect: 0,
      modeOpened: 0,
      examSelected: 0,
      sectionViews: [],
      byFlowType: [],
      topExams: [],
      explanationsStarted: 0,
      explanationsCompleted: 0,
      explanationsExit: 0,
      performanceViews: 0,
    },
    aiTeacher: {
      teachingPageViews: 0,
      lessonsStarted: 0,
      lessonsCompleted: 0,
      questionsAsked: 0,
      answersReceived: 0,
      errors: 0,
    },
    auth: { signUps: 0, logins: 0, loginFailed: 0, logouts: 0 },
    cache: { contentLoaded: 0, cacheHits: 0, cacheMisses: 0 },
    performance: { pagePerformanceEvents: 0, apiPerformanceEvents: 0 },
    funnel: [],
    devices: [],
    browsers: [],
    os: [],
    countries: [],
    errors: [],
    realtime: { activeUsers: null, label: 'Active users (last 30 minutes)' },
    firestore: { registeredUsers: input.registeredUsers ?? null },
  }

  if (!prop || (!loadServiceAccountJson() && !process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim())) {
    return baseEmpty
  }

  const token = await getAccessToken()
  const dateRanges = [
    { startDate: range.startDate, endDate: range.endDate },
    { startDate: range.previousStartDate, endDate: range.previousEndDate },
  ]

  const [
    overview,
    daily,
    pages,
    eventsReport,
    devices,
    browsers,
    osReport,
    countries,
    modeDim,
    classDim,
    subjectDim,
    topicDim,
    sectionDim,
    flowTypeDim,
    examDim,
    realtime,
  ] = await Promise.all([
    runReport(token, prop, {
      dateRanges,
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
        { name: 'eventCount' },
      ],
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'newUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 20,
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 100,
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'browser' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'operatingSystem' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 10,
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: 15,
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'customEvent:selected_mode' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'mode_selected' },
        },
      },
      limit: 10,
    }).catch(() => ({ rows: [] }) as GaReport),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'customEvent:class_id' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'class_selected' },
        },
      },
      limit: 15,
    }).catch(() => ({ rows: [] }) as GaReport),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'customEvent:subject_id' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'subject_selected' },
        },
      },
      limit: 15,
    }).catch(() => ({ rows: [] }) as GaReport),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'customEvent:topic_id' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'topic_selected' },
        },
      },
      limit: 20,
    }).catch(() => ({ rows: [] }) as GaReport),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'customEvent:section' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'competitive_section_viewed' },
        },
      },
      limit: 15,
    }).catch(() => ({ rows: [] }) as GaReport),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'customEvent:flow_type' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'test_started' },
        },
      },
      limit: 15,
    }).catch(() => ({ rows: [] }) as GaReport),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: 'customEvent:exam_id' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { value: 'exam_selected' },
        },
      },
      limit: 20,
    }).catch(() => ({ rows: [] }) as GaReport),
    runRealtimeReport(token, prop, {
      metrics: [{ name: 'activeUsers' }],
    }).catch(() => ({ rows: [] }) as GaReport),
  ])

  // Overview has two date ranges → two totals rows when keepEmptyRows; GA returns
  // metric values per dateRange in separate requests if we used multi-range.
  // With dateRanges array length 2, rows include dateRange dimension unless we
  // omit it — totals may aggregate both. Safer: two separate overview calls.
  // We already used dateRanges:2 — parse by dimension dateRange if present.
  let activeUsers = 0
  let activeUsersPrev = 0
  let newUsers = 0
  let newUsersPrev = 0
  let sessions = 0
  let sessionsPrev = 0
  let pageViews = 0
  let pageViewsPrev = 0
  let engagementRate = 0
  let engagementRatePrev = 0
  let avgSession = 0
  let avgSessionPrev = 0

  if (overview.rows?.some((r) => r.dimensionValues?.length)) {
    // unexpected dimensions
  }

  // Re-fetch overview split for accuracy
  const [overviewCur, overviewPrev] = await Promise.all([
    runReport(token, prop, {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
      ],
    }),
    runReport(token, prop, {
      dateRanges: [{ startDate: range.previousStartDate, endDate: range.previousEndDate }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
      ],
    }),
  ])

  activeUsers = metricNum(overviewCur, 0)
  newUsers = metricNum(overviewCur, 1)
  sessions = metricNum(overviewCur, 2)
  pageViews = metricNum(overviewCur, 3)
  engagementRate = metricNum(overviewCur, 4)
  avgSession = metricNum(overviewCur, 5)

  activeUsersPrev = metricNum(overviewPrev, 0)
  newUsersPrev = metricNum(overviewPrev, 1)
  sessionsPrev = metricNum(overviewPrev, 2)
  pageViewsPrev = metricNum(overviewPrev, 3)
  engagementRatePrev = metricNum(overviewPrev, 4)
  avgSessionPrev = metricNum(overviewPrev, 5)

  void overview

  const eventMap = new Map<string, { count: number; users: number }>()
  for (const row of eventsReport.rows || []) {
    const name = row.dimensionValues?.[0]?.value || '(not set)'
    const count = Number(row.metricValues?.[0]?.value || 0)
    const users = Number(row.metricValues?.[1]?.value || 0)
    eventMap.set(name, { count, users })
  }

  const lessonsStarted = eventCount(eventMap, 'lesson_started')
  const lessonsCompleted = eventCount(eventMap, 'lesson_completed')
  const testsStarted = eventCount(eventMap, 'test_started')
  const testsCompleted = eventCount(eventMap, 'test_completed')

  const funnelStages = [
    { stage: 'Page views', event: 'page_view' },
    { stage: 'Login / signup', event: 'login' },
    { stage: 'Mode selected', event: 'mode_selected' },
    { stage: 'Topic selected', event: 'topic_selected' },
    { stage: 'Lesson / test started', event: 'lesson_started' },
    { stage: 'Lesson / test completed', event: 'lesson_completed' },
  ]

  // Combine lesson+test for started/completed stages
  const funnelUsers = funnelStages.map((s) => {
    if (s.event === 'login') {
      return eventUsers(eventMap, 'login') + eventUsers(eventMap, 'sign_up')
    }
    if (s.event === 'lesson_started') {
      return eventUsers(eventMap, 'lesson_started') + eventUsers(eventMap, 'test_started')
    }
    if (s.event === 'lesson_completed') {
      return eventUsers(eventMap, 'lesson_completed') + eventUsers(eventMap, 'test_completed')
    }
    return eventUsers(eventMap, s.event)
  })

  const funnel = funnelStages.map((s, i) => {
    const users = funnelUsers[i]
    const prev = i === 0 ? null : funnelUsers[i - 1]
    const dropOffPercent =
      prev && prev > 0 ? Math.round(((prev - users) / prev) * 1000) / 10 : null
    return { stage: s.stage, event: s.event, users, dropOffPercent }
  })

  const mapNamed = (report: GaReport): NamedCount[] =>
    (report.rows || []).map((row) => ({
      name: row.dimensionValues?.[0]?.value || '(not set)',
      count: Number(row.metricValues?.[0]?.value || 0),
      users: Number(row.metricValues?.[1]?.value || row.metricValues?.[0]?.value || 0),
    }))

  const timeseries = {
    users: (daily.rows || []).map((row) => ({
      date: row.dimensionValues?.[0]?.value || '',
      value: Number(row.metricValues?.[0]?.value || 0),
    })),
    sessions: (daily.rows || []).map((row) => ({
      date: row.dimensionValues?.[0]?.value || '',
      value: Number(row.metricValues?.[1]?.value || 0),
    })),
    newUsers: (daily.rows || []).map((row) => ({
      date: row.dimensionValues?.[0]?.value || '',
      value: Number(row.metricValues?.[2]?.value || 0),
    })),
  }

  return {
    configured: true,
    source: 'ga4',
    range,
    kpis: {
      activeUsers: kpi(activeUsers, activeUsersPrev),
      newUsers: kpi(newUsers, newUsersPrev),
      sessions: kpi(sessions, sessionsPrev),
      pageViews: kpi(pageViews, pageViewsPrev),
      engagementRate: kpi(
        Math.round(engagementRate * 1000) / 10,
        Math.round(engagementRatePrev * 1000) / 10,
      ),
      avgEngagementSec: kpi(Math.round(avgSession), Math.round(avgSessionPrev)),
      lessonsStarted: kpi(lessonsStarted, 0),
      lessonsCompleted: kpi(lessonsCompleted, 0),
      testsStarted: kpi(testsStarted, 0),
      testsCompleted: kpi(testsCompleted, 0),
      registeredUsers: {
        value: input.registeredUsers ?? null,
        previous: null,
        changePercent: null,
      },
    },
    timeseries,
    topPages: (pages.rows || []).map((row) => ({
      page: row.dimensionValues?.[0]?.value || '/',
      views: Number(row.metricValues?.[0]?.value || 0),
      users: Number(row.metricValues?.[1]?.value || 0),
    })),
    events: [...eventMap.entries()]
      .map(([event, v]) => ({
        event,
        count: v.count,
        users: v.users,
        eventsPerUser: v.users > 0 ? Math.round((v.count / v.users) * 10) / 10 : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40),
    modeUsage: mapNamed(modeDim),
    curriculum: {
      classes: mapNamed(classDim),
      subjects: mapNamed(subjectDim),
      topics: mapNamed(topicDim),
      lessonStarted: lessonsStarted,
      lessonCompleted: lessonsCompleted,
      lessonExit: eventCount(eventMap, 'lesson_exit'),
    },
    competitive: {
      testsStarted,
      testsCompleted,
      testsAbandoned: eventCount(eventMap, 'test_abandoned'),
      questionsAttempted: eventCount(eventMap, 'question_attempted'),
      answersCorrect: eventCount(eventMap, 'answer_correct'),
      answersIncorrect: eventCount(eventMap, 'answer_incorrect'),
      modeOpened: eventCount(eventMap, 'competitive_mode_opened'),
      examSelected: eventCount(eventMap, 'exam_selected'),
      sectionViews: mapNamed(sectionDim),
      byFlowType: mapNamed(flowTypeDim),
      topExams: mapNamed(examDim),
      explanationsStarted: eventCount(eventMap, 'explanation_started'),
      explanationsCompleted: eventCount(eventMap, 'explanation_completed'),
      explanationsExit: eventCount(eventMap, 'explanation_exit'),
      performanceViews: eventCount(eventMap, 'performance_analytics_viewed'),
    },
    aiTeacher: {
      teachingPageViews: eventCount(eventMap, 'teaching_page_view'),
      lessonsStarted,
      lessonsCompleted,
      questionsAsked: eventCount(eventMap, 'ai_question_asked'),
      answersReceived: eventCount(eventMap, 'ai_answer_received'),
      errors: eventCount(eventMap, 'ai_teacher_error'),
    },
    auth: {
      signUps: eventCount(eventMap, 'sign_up'),
      logins: eventCount(eventMap, 'login'),
      loginFailed: eventCount(eventMap, 'login_failed'),
      logouts: eventCount(eventMap, 'logout'),
    },
    cache: {
      contentLoaded: eventCount(eventMap, 'content_loaded'),
      cacheHits: eventCount(eventMap, 'cache_hit'),
      cacheMisses: eventCount(eventMap, 'cache_miss'),
    },
    performance: {
      pagePerformanceEvents: eventCount(eventMap, 'page_performance'),
      apiPerformanceEvents: eventCount(eventMap, 'api_performance'),
    },
    funnel,
    devices: mapNamed(devices),
    browsers: mapNamed(browsers),
    os: mapNamed(osReport),
    countries: mapNamed(countries),
    errors: [...eventMap.entries()]
      .filter(([name]) => name.includes('error') || name === 'app_error' || name === 'ai_teacher_error')
      .map(([name, v]) => ({ name, count: v.count, users: v.users })),
    realtime: {
      activeUsers: metricNum(realtime, 0),
      label: 'Active users (last 30 minutes)',
    },
    firestore: { registeredUsers: input.registeredUsers ?? null },
    propertyId: prop,
  }
}

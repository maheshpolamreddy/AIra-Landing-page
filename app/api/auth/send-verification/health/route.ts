import { isEmailConfigured, resolveEmailProvider } from '@/lib/email/send-transactional'

export const runtime = 'nodejs'

export async function GET() {
  const hasCredentials = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim())
  const credentialsLength = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.length ?? 0

  let adminConfigured = false
  let adminError: string | null = null
  try {
    const admin = await import('@/lib/firebase/verification-admin')
    adminConfigured = admin.isVerificationAdminConfigured()
    if (hasCredentials && !adminConfigured) {
      adminError = 'credentials_present_but_unparseable'
    }
  } catch (err) {
    adminError = err instanceof Error ? err.message : 'import_failed'
  }

  const emailConfigured = isEmailConfigured()

  return Response.json({
    ok: emailConfigured && adminConfigured,
    admin: adminConfigured,
    email: emailConfigured,
    provider: resolveEmailProvider(),
    hasCredentials,
    credentialsLength,
    adminError,
  })
}

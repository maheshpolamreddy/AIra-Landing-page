import { isEmailConfigured, resolveEmailProvider } from '@/lib/email/send-transactional'

export const runtime = 'nodejs'

export async function GET() {
  let adminConfigured = false
  try {
    const admin = await import('@/lib/firebase/verification-admin')
    adminConfigured = admin.isVerificationAdminConfigured()
  } catch {
    adminConfigured = false
  }

  const emailConfigured = isEmailConfigured()

  return Response.json({
    ok: emailConfigured && adminConfigured,
    admin: adminConfigured,
    email: emailConfigured,
    provider: resolveEmailProvider(),
  })
}

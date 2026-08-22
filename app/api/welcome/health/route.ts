import { isEmailConfigured, resolveEmailProvider } from '@/lib/email/send-transactional'

export const runtime = 'nodejs'

export async function GET() {
  const provider = resolveEmailProvider()
  return Response.json({
    ok: true,
    configured: isEmailConfigured(),
    provider,
  })
}

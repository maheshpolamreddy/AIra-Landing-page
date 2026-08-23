import { getEmailDiagnostics } from '@/lib/email/send-transactional'

export const runtime = 'nodejs'

/** Unified email diagnostics (no secrets). */
export async function GET() {
  const email = getEmailDiagnostics()
  return Response.json({
    ok: email.canDeliverExternally,
    ...email,
  })
}

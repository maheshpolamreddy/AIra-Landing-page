import { buildVerificationEmail } from '@/lib/email/verification-template'
import { sendTransactionalEmail } from '@/lib/email/send-transactional'

export type SendVerificationInput = {
  to: string
  name: string
  verifyUrl: string
}

export async function sendVerificationEmail(input: SendVerificationInput): Promise<void> {
  const template = buildVerificationEmail({
    name: input.name,
    verifyUrl: input.verifyUrl,
  })
  const result = await sendTransactionalEmail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
  console.info('[verify-email] delivered', {
    provider: result.provider,
    messageId: result.messageId,
    usedFallback: result.usedFallback ?? false,
  })
}

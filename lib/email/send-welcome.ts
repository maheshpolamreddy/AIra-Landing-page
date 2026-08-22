import { buildWelcomeEmail } from '@/lib/email/welcome-template'
import { sendTransactionalEmail } from '@/lib/email/send-transactional'

export type SendWelcomeInput = {
  to: string
  name: string
}

export async function sendWelcomeEmail(input: SendWelcomeInput): Promise<void> {
  const template = buildWelcomeEmail({ name: input.name })
  await sendTransactionalEmail({
    to: input.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
}

import {
  EMAIL_BRAND_NAME,
  emailPrimaryButton,
  escapeHtml,
  siteOrigin,
  wrapEmailShell,
} from '@/lib/email/email-shell'

export const VERIFICATION_EMAIL_SUBJECT = 'Verify your email for AIra'

const PREHEADER =
  'Confirm your email address to activate your AIra account and start learning.'

export type VerificationTemplateInput = {
  name: string
  verifyUrl: string
}

export type VerificationTemplate = {
  subject: string
  html: string
  text: string
}

export function buildVerificationEmail(
  input: VerificationTemplateInput,
): VerificationTemplate {
  const origin = siteOrigin()
  const displayName = (input.name.trim() || 'there').slice(0, 80)
  const safeName = escapeHtml(displayName)
  const brand = EMAIL_BRAND_NAME
  const verifyUrl = input.verifyUrl.trim()

  const text = [
    `Hello ${displayName},`,
    '',
    `Please verify your email address to activate your ${brand} account.`,
    '',
    `Verify your email: ${verifyUrl}`,
    '',
    'If you did not create an account, you can ignore this email.',
    '',
    `— The ${brand} team`,
  ].join('\n')

  const bodyHtml = `
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0F2740;line-height:1.3;">Hello ${safeName},</p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#4A5D73;">
                Thanks for signing up for ${brand}. Tap the button below to confirm this email address belongs to you and unlock your account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;" align="center">
              ${emailPrimaryButton('Verify email address', verifyUrl)}
              <p style="margin:18px 0 0 0;font-size:12px;line-height:1.5;color:#7A8FA3;">
                This link expires after a while. If you did not create an ${brand} account, you can safely ignore this email.
              </p>
            </td>
          </tr>`

  const html = wrapEmailShell({
    origin,
    preheader: PREHEADER,
    title: VERIFICATION_EMAIL_SUBJECT,
    bodyHtml,
    footerNote: 'You received this because someone signed up with your email.',
  })

  return { subject: VERIFICATION_EMAIL_SUBJECT, html, text }
}

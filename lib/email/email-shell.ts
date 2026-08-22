import { SOCIAL } from '@/lib/site'

/** ASCII brand for email clients — never use the special-i wordmark (many inboxes show “Aria”). */
export const EMAIL_BRAND_NAME = 'AIra'

export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'https://aira-landing-page-elite.vercel.app'
  return raw.replace(/\/$/, '')
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function emailLogoUrl(origin: string): string {
  return `${origin}/aira-mark.svg`
}

export function emailIconUrl(origin: string): string {
  return `${origin}/icon.svg`
}

export type EmailShellOptions = {
  origin?: string
  preheader: string
  title: string
  bodyHtml: string
  footerNote: string
}

/** Branded wrapper shared by welcome + verification emails. */
export function wrapEmailShell(options: EmailShellOptions): string {
  const origin = options.origin ?? siteOrigin()
  const brand = EMAIL_BRAND_NAME
  const logoUrl = emailLogoUrl(origin)
  const iconUrl = emailIconUrl(origin)
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#EEF3F8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F2740;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(options.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF3F8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E4EBF2;">
          <tr>
            <td style="background:#FFFFFF;padding:28px 28px 20px 28px;text-align:center;border-bottom:1px solid #E4EBF2;">
              <img src="${logoUrl}" alt="${brand}" width="88" height="88" style="display:block;margin:0 auto 12px auto;border:0;width:88px;height:auto;" />
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td valign="middle" style="padding-right:8px;">
                    <img src="${iconUrl}" alt="" width="22" height="22" style="display:block;border:0;border-radius:6px;width:22px;height:22px;" />
                  </td>
                  <td valign="middle">
                    <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0B6E99;line-height:1;">${brand}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0 0;font-size:14px;line-height:1.5;color:#4A5D73;">Your AI learning companion</p>
            </td>
          </tr>
          ${options.bodyHtml}
          <tr>
            <td style="background:#F7FAFC;padding:20px 28px;border-top:1px solid #E4EBF2;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#4A5D73;">Follow ${brand}</p>
              <p style="margin:0;font-size:13px;">
                <a href="${SOCIAL.instagram.href}" style="color:#0B6E99;text-decoration:none;margin:0 8px;">${SOCIAL.instagram.label}</a>
                ·
                <a href="${SOCIAL.x.href}" style="color:#0B6E99;text-decoration:none;margin:0 8px;">${SOCIAL.x.label}</a>
              </p>
              <p style="margin:14px 0 0 0;font-size:11px;color:#8A9BB0;">
                © ${year} ${brand}. ${escapeHtml(options.footerNote)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function emailPrimaryButton(label: string, href: string): string {
  const safeHref = escapeHtml(href)
  const safeLabel = escapeHtml(label)
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="#0B6E99" style="border-radius:999px;background-color:#0B6E99;">
          <a href="${safeHref}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`
}

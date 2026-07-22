import type { Metadata } from 'next'
import { StaticPageShell } from '@/components/static-page-shell'
import { BRAND } from '@/lib/site'

export const metadata: Metadata = {
  title: `Careers — ${BRAND.name}`,
  description: `Join the ${BRAND.name} team and help reshape learning with AI.`,
}

export default function CareersPage() {
  return (
    <StaticPageShell
      eyebrow="Careers"
      title="We&apos;re hiring soon"
      description="We are a small team building thoughtful AI learning tools. Open roles will be posted here first."
    >
      <p>
        Interested in engineering, curriculum design, or go-to-market at{' '}
        {BRAND.name}? Send your résumé and a short note about what you would like to
        work on.
      </p>
      <p>
        Email{' '}
        <a
          href="mailto:careers@aira.example?subject=Careers%20at%20Aira"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          careers@aira.example
        </a>{' '}
        <span className="text-xs text-muted-foreground">
          (placeholder — replace with your hiring inbox)
        </span>
      </p>
    </StaticPageShell>
  )
}

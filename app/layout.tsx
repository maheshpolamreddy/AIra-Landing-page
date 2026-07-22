import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/components/auth-provider'
import { AuthDomainGuard } from '@/components/auth-domain-guard'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Aɪra — AI-Powered Learning Platform',
  description:
    'Master JEE, NEET, and professional skills with personalized AI learning. Join 32k+ learners preparing smarter.',
  icons: {
    icon: [
      { url: '/aira-favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/aira-favicon.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/aira-favicon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${geistMono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased relative isolate" suppressHydrationWarning>
        <AuthDomainGuard />
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}

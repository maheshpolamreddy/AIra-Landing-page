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
      { url: '/brand/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/icons/icon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/brand/icons/icon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/brand/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/brand/icons/icon-32x32.png'],
  },
  manifest: '/manifest.webmanifest',
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
      <head>
        <link rel="preload" href="/brand/aira-icon.png" as="image" type="image/png" />
      </head>
      <body className="font-sans antialiased relative isolate" suppressHydrationWarning>
        <AuthDomainGuard />
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}

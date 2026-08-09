/** @type {import('next').NextConfig} */

const TUTOR_DEV =
  process.env.TUTOR_DEV_URL || 'http://127.0.0.1:5173'

/**
 * Proxy tutor SPA + Vite HMR through landing in local dev.
 * Do NOT rewrite /api/* — those are Next.js routes on this app (tts, chat, waitlist).
 * Do NOT rewrite /images or /assets — those belong to the landing public folder.
 * Tutor static media lives under /tutor-media/*.
 */
const tutorDevRewrites = [
  // Vite / HMR
  { source: '/@vite/:path*', destination: `${TUTOR_DEV}/@vite/:path*` },
  { source: '/@react-refresh', destination: `${TUTOR_DEV}/@react-refresh` },
  { source: '/@fs/:path*', destination: `${TUTOR_DEV}/@fs/:path*` },
  { source: '/@id/:path*', destination: `${TUTOR_DEV}/@id/:path*` },
  { source: '/src/:path*', destination: `${TUTOR_DEV}/src/:path*` },
  { source: '/node_modules/:path*', destination: `${TUTOR_DEV}/node_modules/:path*` },
  { source: '/theme-boot.js', destination: `${TUTOR_DEV}/theme-boot.js` },
  // Tutor-only static namespace (must not collide with landing /images, /brand, etc.)
  { source: '/tutor-media/:path*', destination: `${TUTOR_DEV}/tutor-media/:path*` },
  { source: '/tutor-assets/:path*', destination: `${TUTOR_DEV}/tutor-assets/:path*` },
  // App routes
  { source: '/student', destination: `${TUTOR_DEV}/student` },
  { source: '/student/:path*', destination: `${TUTOR_DEV}/student/:path*` },
  { source: '/teacher', destination: `${TUTOR_DEV}/teacher` },
  { source: '/teacher/:path*', destination: `${TUTOR_DEV}/teacher/:path*` },
  { source: '/admin', destination: `${TUTOR_DEV}/admin` },
  { source: '/admin/:path*', destination: `${TUTOR_DEV}/admin/:path*` },
  { source: '/dev/:path*', destination: `${TUTOR_DEV}/dev/:path*` },
]

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Hostnames only (no ports). Missing 127.0.0.1 blocks /_next/* when the
  // browser opens http://127.0.0.1:3000 and looks like "server not connecting".
  allowedDevOrigins: [
    '*.trycloudflare.com',
    '127.0.0.1',
    'localhost',
    '0.0.0.0',
    '127.0.0.1:3000',
    'localhost:3000',
    '127.0.0.1:5173',
    'localhost:5173',
  ],
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return { beforeFiles: tutorDevRewrites }
    }
    return []
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ]
  },
}

export default nextConfig

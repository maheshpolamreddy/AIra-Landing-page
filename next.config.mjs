/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Allow dev assets when opened via localhost or 127.0.0.1 (Firebase auth flows)
  allowedDevOrigins: ['127.0.0.1:3000', 'localhost:3000'],
  // Required for Firebase signInWithPopup (Google / Apple / Microsoft)
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

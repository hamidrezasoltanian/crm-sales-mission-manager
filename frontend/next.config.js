/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async rewrites() {
    return [
      // All API requests go to backend
      // Note: Next.js API routes (in app/api/) are handled BEFORE rewrites,
      // so /api/assignments/:id/approve will be handled by the API route, not rewritten
      {
        source: '/api/:path*',
        destination: 'http://localhost:2001/api/:path*',
      },
      // Proxy for Sales Analysis Dashboard (KPI page)
      {
        source: '/kpi/:path*',
        destination: 'http://localhost:2001/api/proxy/frontend/sales-analysis/:path*',
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // frame-src: allows embedding iframes from these sources (Telegram OAuth)
            // Note: CSP wildcards in IP ranges are not supported, so we allow all http/https connections
            // frame-ancestors is NOT set here - it's controlled by the embedded page (Telegram)
            value: "frame-src 'self' https://oauth.telegram.org https://telegram.org http: https:; default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://oauth.telegram.org http: https:; connect-src 'self' http: https:;"
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/manager/:path*',
        destination: process.env.MANAGER_URL || 'http://localhost:8080/:path*',
      },
    ]
  },
}

module.exports = nextConfig
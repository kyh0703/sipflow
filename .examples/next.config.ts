import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  trailingSlash: true,
  reactStrictMode: true,
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack: (config) => {
    const fileLoaderRule = config.module.rules.find((rule: any) =>
      rule.test?.test?.('.svg'),
    )

    if (fileLoaderRule) {
      fileLoaderRule.exclude = /\.svg$/
    }

    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    return config
  },
  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: 'http://localhost:3000/api/v1/:path*',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },
}

export default nextConfig

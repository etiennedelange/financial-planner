/** @type {import('next').NextConfig} */

// Bundle analyzer (enabled with ANALYZE=true npm run build)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  // React Compiler — automatically memoises components and hooks
  reactCompiler: true,

  // Instant Navigations (Next 16.3) — prefetch app shells so navigations
  // between routes feel SPA-snappy. partialPrefetching requires cacheComponents.
  cacheComponents: true,
  partialPrefetching: true,

  experimental: {
    // Use the native Rust React Compiler inside Turbopack instead of the
    // Babel transform (up to ~46% faster warm dev builds). Requires
    // reactCompiler: true and Turbopack (dev/build default in Next 16).
    turbopackRustReactCompiler: true,
  },

  // Production optimizations
  compiler: {
    // Remove console.logs in production (keep errors and warnings)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Image optimization configuration
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // PWA: the service worker must never be served from a browser/CDN cache —
  // stale workers trap users on old caches. Per the Next.js PWA guide.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ]
  },

}

module.exports = withBundleAnalyzer(nextConfig)

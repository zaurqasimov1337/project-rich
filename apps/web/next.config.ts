import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// When hosted under a sub-path (e.g. behind a shared domain at /app), set
// NEXT_BASE_PATH=/app at build time. Empty/unset serves from the domain root.
const basePath = process.env.NEXT_BASE_PATH || '';

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  transpilePackages: ['@edusphere/shared'],
  async rewrites() {
    // Dev convenience: proxy API to NestJS so cookies stay same-origin.
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:4100'}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);

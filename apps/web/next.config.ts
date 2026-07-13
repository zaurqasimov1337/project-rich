import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
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

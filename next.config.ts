import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Next.js 16 native View Transition support
    // @ts-expect-error viewTransition is an experimental feature flag
    viewTransition: true,
  },
};

export default nextConfig;

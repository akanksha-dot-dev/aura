import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloudflare Pages deployment configuration
  // Compatible with Cloudflare Workers runtime (nodejs_compat flag)
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,
  experimental: {
    // Next.js 16 native View Transition support
    // @ts-expect-error viewTransition is an experimental feature flag
    viewTransition: true,
  },
};

export default nextConfig;

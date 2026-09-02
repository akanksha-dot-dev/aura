import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloudflare Pages deployment configuration
  // Compatible with Cloudflare Workers runtime (nodejs_compat flag)
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : undefined,
};

export default nextConfig;

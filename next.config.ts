import type { NextConfig } from 'next';

const staticPages = process.env.NEXT_PUBLIC_STATIC_PAGES === '1';
const basePath = staticPages ? (process.env.PAGES_BASE_PATH ?? '').replace(/\/$/, '') : '';

const config: NextConfig = {
  agentRules: false,
  devIndicators: false,
  ...(staticPages ? {
    output: 'export',
    trailingSlash: true,
    // The UI entries are TSX. The Node.js route handlers are TS and are omitted from Pages.
    pageExtensions: ['tsx'],
    basePath,
  } : {}),
  env: { NEXT_PUBLIC_APP_BASE_PATH: basePath },
};

export default config;

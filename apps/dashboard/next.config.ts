import type { NextConfig } from 'next';

const config: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Off the sidebar's bottom corner, where the signed-in person sits.
  devIndicators: { position: 'bottom-right' },
};

export default config;

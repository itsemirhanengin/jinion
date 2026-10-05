import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, type Plugin } from 'vite';

// The built app loads only its own files; in development the dev server's inline scripts need more.
const contentSecurityPolicy: Plugin = {
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
      },
      injectTo: 'head-prepend',
    },
  ],
};

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy],
  // The core's sources, as in development, so the renderer doesn't wait for its build.
  resolve: { conditions: ['development', ...defaultClientConditions] },
  // The app loads its files from disk, not over a network, so a large chunk costs little.
  build: { outDir: '../../dist/renderer', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});

/// <reference types="vitest" />
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const BASE = '/tw_amr_dashboard/';

/** `<link rel="preload">` for the hashed Inter Latin woff2 so text doesn't wait for CSS discovery. */
function preloadInterFont(): Plugin {
  return {
    name: 'twamr-preload-inter',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const file = Object.keys(ctx.bundle ?? {}).find((k) => /inter-latin-wght-normal-[\w-]+\.woff2$/.test(k));
        if (!file) return [];
        return [{ tag: 'link', attrs: { rel: 'preload', href: `${BASE}${file}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }];
      },
    },
  };
}

// GitHub Pages serves the site under /tw_amr_dashboard/ (see docs/ARCHITECTURE.md §2).
export default defineConfig({
  base: BASE,
  plugins: [react(), preloadInterFont()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        embed: resolve(__dirname, 'embed.html'),
      },
      output: {
        manualChunks: {
          echarts: ['echarts'],
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});

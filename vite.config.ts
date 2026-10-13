import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages share one app: `/` is Slovak, `/en/` is English.
export default defineConfig({
  build: {
    target: 'es2022',
    // three.js alone is about 600 kB before compression (180 kB over the wire)
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        sk: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
      },
    },
  },
  server: { host: true }, // reachable from a phone on the same Wi-Fi
});

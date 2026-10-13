import { defineConfig } from 'vite';

// Statický web: `npm run build` vytvorí priečinok dist/, ktorý stačí nahrať na hosting.
export default defineConfig({
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { host: true }, // dev server je dostupný aj z telefónu v tej istej Wi-Fi
});

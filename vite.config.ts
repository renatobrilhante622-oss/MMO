import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    sourcemap: true,
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 10000 },
});

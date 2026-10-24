import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    sourcemap: true,
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 10000 },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: resolve(frontendRoot, 'public'),
  base: '/maintenance-assets/',
  resolve: {
    alias: {
      '@': resolve(frontendRoot, 'src'),
    },
  },
  build: {
    outDir: resolve(frontendRoot, 'dist-maintenance'),
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: fileURLToPath(new URL('./maintenance.html', import.meta.url)),
    },
  },
});

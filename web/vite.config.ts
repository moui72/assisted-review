import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Root is this `web/` dir (we run `vite web`). The build lands in ../dist,
// which the Node server serves. In dev, /api is proxied to the api-only server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': 'http://127.0.0.1:4319',
    },
    fs: { allow: ['..'] },
  },
});

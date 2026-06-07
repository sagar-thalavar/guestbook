import { defineConfig } from 'vite';

export default defineConfig({
  base: '/guestbook/', // Serve assets from the /guestbook/ subpath
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});

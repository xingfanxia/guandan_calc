import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        players: resolve(__dirname, 'players.html'),
        rooms: resolve(__dirname, 'rooms.html'),
        profile: resolve(__dirname, 'player-profile.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    // Dev proxies /api/* to production so we hit real KV through the deployed
    // Edge Functions. Otherwise Vite serves the API source files as static JS
    // modules (fetch parses them as JSON → SyntaxError). Set GD_NO_API_PROXY=1
    // to opt out (offline / fully-stubbed dev).
    proxy: process.env.GD_NO_API_PROXY ? undefined : {
      '/api': {
        target: 'https://gd.ax0x.ai',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
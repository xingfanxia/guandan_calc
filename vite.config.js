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
        profile: resolve(__dirname, 'player-profile.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
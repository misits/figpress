import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This is a simple base configuration
// For the actual build, use:
// - vite.ui.config.js for the UI
// - vite.plugin.config.js for the plugin code

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    hmr: true,
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [
      react(),
      viteSingleFile(), // For inlining scripts into HTML
    ],
    
    build: {
      sourcemap: !isProduction,
      minify: isProduction,
      outDir: 'dist',
      emptyOutDir: false, // Don't empty outDir as it may contain code.js
      assetsInlineLimit: 0, // Inline all assets regardless of size
      rollupOptions: {
        input: resolve(__dirname, './ui.html'),
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
    },

    server: {
      port: 3000,
      hmr: true,
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
    },

    define: {
      global: 'globalThis',
    },
  };
}); 
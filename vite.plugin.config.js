import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    build: {
      sourcemap: !isProduction,
      minify: isProduction,
      outDir: 'dist',
      emptyOutDir: false, // Don't empty outDir as it may contain ui files
      lib: {
        entry: resolve(__dirname, 'src/code.ts'),
        formats: ['es'],
        fileName: () => 'code.js',
      },
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
    },

    define: {
      global: 'globalThis',
    },
  };
}); 
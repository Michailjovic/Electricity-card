import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/electricity-panel-card.ts',
      formats: ['es'],
      fileName: 'electricity-panel-card',
    },
    rollupOptions: {
      output: {
        // Bundle everything including Lit — no external deps at runtime
      },
    },
    minify: false, // keep readable for debugging; set to 'esbuild' for production
    sourcemap: false,
  },
});

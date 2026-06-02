import { defineConfig } from 'vite';

// IIFE / global build: load via <script src="chatbot.iife.js"> -> window.Chatbot
// Runs after the ESM build, so emptyOutDir is false to keep both files.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    target: 'es2019',
    lib: {
      entry: 'src/iife.js',
      name: 'Chatbot',
      formats: ['iife'],
      fileName: () => 'chatbot.iife.js',
    },
  },
});

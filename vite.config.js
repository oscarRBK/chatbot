import { defineConfig } from 'vite';

// ESM build: `import { Chatbot } from 'provider-chatbot'`
// Also drives the dev server (`npm run dev`) which serves /demo.
export default defineConfig({
  server: {
    port: 5173,
    open: '/demo/',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2019',
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => 'chatbot.es.js',
    },
  },
});

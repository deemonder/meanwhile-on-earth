import { defineConfig } from 'vite';

// A relative base lets the built site run from any folder, including
// https://<user>.github.io/<repo>/ on GitHub Pages.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2500 },
});

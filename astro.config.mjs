// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ymapps.pages.dev',
  trailingSlash: 'never',
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});

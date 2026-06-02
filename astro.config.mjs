// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://y-m-apps-site.pages.dev',
  trailingSlash: 'never',
  integrations: [sitemap()],
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});

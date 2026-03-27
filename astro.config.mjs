import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://seg247.github.io',
  base: '/shoppingwithnoya-site-v2',
  integrations: [sitemap()],
  output: 'static',
});

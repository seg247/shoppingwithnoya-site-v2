import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://deals.shoppingwithnoya.com',
  base: '/',
  integrations: [sitemap()],
  output: 'static',
});

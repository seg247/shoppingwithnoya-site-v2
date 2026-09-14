import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { archiveEntries } from './src/lib/deal-archive.mjs';
const data=JSON.parse(readFileSync(new URL('./src/data/site-data.json',import.meta.url),'utf8'));
const archivedPaths=new Set(archiveEntries(data).map(p=>'/deals/'+p.slug));

export default defineConfig({
  site: 'https://deals.shoppingwithnoya.com',
  base: '/',
  integrations: [
    sitemap({
      filter: page => !archivedPaths.has(new URL(page).pathname.replace(/\/$/, '')),
      changefreq: 'daily',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  output: 'static',
});

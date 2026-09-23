import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';
import { archiveEntries } from './src/lib/deal-archive.mjs';
const data=JSON.parse(readFileSync(new URL('./src/data/site-data.json',import.meta.url),'utf8'));
const archivedPaths=new Set(archiveEntries(data).map(p=>'/deals/'+p.slug));

// Real per-URL lastmod. Previously every URL shared `new Date()` (build time),
// so all 636 pages claimed to change on every rebuild -- an unreliable signal
// Google is documented to ignore. Map each URL to the date its content actually
// changed, so lastmod stays stable across rebuilds.
const lastmodByPath = new Map();
for (const post of [...(data.posts || []), ...(data.archivedPosts || [])]) {
  if (post && post.slug && post.ts) {
    const t = new Date(post.ts);
    if (!isNaN(t)) lastmodByPath.set('/deals/' + post.slug, t);
  }
}
// Blog and beauty pages are date-addressed (/blog/YYYY-MM-DD/), so the URL
// carries the real content date.
const dateFromPath = (pathname) => {
  const m = pathname.match(/^\/(?:blog|beauty)\/(\d{4}-\d{2}-\d{2})\/?$/);
  if (!m) return null;
  const t = new Date(m[1] + 'T12:00:00.000Z');
  return isNaN(t) ? null : t;
};
// Static pages change only when the site is rebuilt from source; fall back to
// the data generation time rather than an ever-moving clock.
const siteGeneratedAt = (() => {
  const t = new Date(data.generatedAt);
  return isNaN(t) ? new Date() : t;
})();

export default defineConfig({
  site: 'https://deals.shoppingwithnoya.com',
  base: '/',
  integrations: [
    sitemap({
      filter: page => !archivedPaths.has(new URL(page).pathname.replace(/\/$/, '')),
      changefreq: 'daily',
      priority: 0.7,
      serialize: (item) => {
        const pathname = new URL(item.url).pathname.replace(/\/$/, '') || '/';
        const lastmod =
          lastmodByPath.get(pathname) || dateFromPath(pathname) || siteGeneratedAt;
        return { ...item, lastmod: lastmod.toISOString() };
      },
    }),
  ],
  output: 'static',
});

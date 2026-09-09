import type { APIRoute } from 'astro';
import blogData from '../data/blog-data.json';

// RSS 2.0 feed. Cheap syndication + discovery surface, and feed readers and
// aggregators are a real referral source for deal content.
const SITE = 'https://deals.shoppingwithnoya.com';

const esc = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const posts = ((blogData as any).posts || [])
    .slice()
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const items = posts
    .map((p: any) => {
      const url = `${SITE}/blog/${p.slug}/`;
      const pub = new Date(p.date + 'T12:00:00').toUTCString();
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(p.intro || '')}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Shopping With Noya — Daily Deals</title>
    <link>${SITE}/</link>
    <description>Hand-picked deals updated daily. Groceries, home, beauty, electronics, fashion and more.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};

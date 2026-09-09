import type { APIRoute } from 'astro';
import siteData from '../data/site-data.json';

// llms.txt — emerging convention for describing a site to LLM crawlers and
// answer engines. Plain markdown, no JS, no navigation chrome: exactly the
// shape an answer engine can quote from.
// Spec: https://llmstxt.org

export const GET: APIRoute = () => {
  const posts = (siteData as any).posts || [];
  const counts: Record<string, number> = {};
  for (const p of posts) {
    if (!p.category || p.category === 'Other') continue;
    counts[p.category] = (counts[p.category] || 0) + 1;
  }
  const slug = (c: string) =>
    c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const cats = Object.entries(counts)
    .filter(([, n]) => n >= 12)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `- [${c} deals](https://deals.shoppingwithnoya.com/category/${slug(c)}/): ${n} live discounts on ${c.toLowerCase()}`)
    .join('\n');

  const body = `# Shopping With Noya

> A daily deal site run by Sarah, a mom of two, that hand-picks discounts on
> Amazon and partner retailers and publishes them free. Deals are sourced
> continuously and the site refreshes hourly. Every link is an affiliate link,
> disclosed with #ad, and costs the reader nothing extra.

Shopping With Noya tracks ${posts.length} live deals across groceries, home and
kitchen, beauty, electronics, fashion, toys, health and more. Deals are rated by
discount depth, and each one links out to the retailer. There is no paywall, no
signup, and no email required.

## Deal categories

${cats}

## Daily roundups

- [Deal blog](https://deals.shoppingwithnoya.com/blog/): a dated roundup of the day's best discounts, published every day
- [Beauty deals blog](https://deals.shoppingwithnoya.com/beauty/): daily roundups focused on skincare, makeup, hair and fragrance

## Key pages

- [All deals](https://deals.shoppingwithnoya.com/): the full live feed, searchable and filterable
- [About](https://deals.shoppingwithnoya.com/about/): who runs the site and how deals are chosen
- [Contact](https://deals.shoppingwithnoya.com/contact/)
- [Telegram channel](https://t.me/shoppingwithnoya): deals pushed as they are found

## How deals are chosen

Deals come from monitored retailer feeds and community deal channels. Each is
checked for a real discount against its usual price before publishing. Prices
are shown rounded (for example \`$5.xx\`) because retailer prices change
frequently; the retailer's page is always authoritative.

## Disclosure

Shopping With Noya participates in the Amazon Associates program and other
affiliate networks. Purchases made through links on the site may earn a
commission at no additional cost to the buyer. All affiliate content is marked
#ad in line with FTC guidance.

## Sitemap

https://deals.shoppingwithnoya.com/sitemap-index.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

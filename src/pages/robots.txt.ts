import type { APIRoute } from 'astro';

// Served as a real text/plain endpoint. The previous robots.txt.astro rendered
// through Astro's HTML pipeline, which prepended <!DOCTYPE html> and set
// content-type: text/html -- strict crawlers can reject a robots file for that.
const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard

Sitemap: https://deals.shoppingwithnoya.com/sitemap-index.xml

# LLM/answer-engine description: https://llmstxt.org
# https://deals.shoppingwithnoya.com/llms.txt
`;

export const GET: APIRoute = () =>
  new Response(robots, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

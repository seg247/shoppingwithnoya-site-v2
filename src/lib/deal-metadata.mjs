// Editorial budgets, not Google ranking limits. Preserve the full product
// name on the page; keep the search/browser snippet concise and honest.
const SITE_SUFFIX = ' | Shopping With Noya';
const chars = (value) => Array.from(value);

export function cleanText(value) {
  return typeof value === 'string'
    ? value.replace(/[\t\r\n]+/g, ' ').replace(/[\uD800-\uDFFF\uFFFD]/gu, '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').replace(/^[\s\uFE0F]+/u, '').trim()
    : '';
}

export function shorten(value, limit) {
  const text = cleanText(value);
  if (chars(text).length <= limit) return text;
  const cut = chars(text).slice(0, Math.max(0, limit - 1)).join('');
  const lastSpace = cut.lastIndexOf(' ');
  // Avoid losing nearly the entire label when its first word is unusually long.
  const prefix = lastSpace > cut.length / 2 ? cut.slice(0, lastSpace) : cut;
  // Do not leave a bare quantity after cutting off its following unit.
  const compact = prefix.replace(/\s+\d+(?:\.\d+)?$/u, '');
  return `${compact.replace(/[\s,;:|–—-]+$/u, '')}…`;
}

export function dealMetadata(deal) {
  const name = cleanText(deal?.title) || 'Product deal';
  const descriptionSuffix = ' Check current price and availability at the retailer.';
  return {
    title: shorten(name, 60 - chars(SITE_SUFFIX).length) + SITE_SUFFIX,
    description: shorten(name, 155 - chars(descriptionSuffix).length) + descriptionSuffix,
  };
}

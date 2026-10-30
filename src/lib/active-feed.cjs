// Keep the bot and site copies byte-identical. The factory is also embedded in
// the homepage so build-time selection and browser selection run the same code.
'use strict';
function createFeedPolicy() {
  function httpUrl(value) {
    if (typeof value !== 'string') return false;
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }
  function expiryTime(value) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string') return NaN;
    // Date-only values are inclusive UTC calendar dates, never machine-local
    // dates. Full ISO instants retain their explicit Z/offset; never append a
    // time suffix to them. Unknown expiry stays unknown (no age-based TTL).
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!dateOnly && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
    const date = value.slice(0, 10);
    const midnight = Date.parse(date + 'T00:00:00Z');
    if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) return NaN;
    return dateOnly ? midnight + 86400000 - 1 : Date.parse(value);
  }
  function eligibility(deal, now = Date.now()) {
    const expires = expiryTime(deal.expiresAt);
    if (expires !== null && !Number.isFinite(expires)) return 'invalid-expiry';
    if (expires !== null && now >= expires) return 'expired';
    if (!httpUrl(deal.imageUrl)) return 'missing-image';
    if (!httpUrl(deal.url)) return 'invalid-url';
    return 'active';
  }
  function activeDeals(posts, { now = Date.now(), latest = false, categories = [], search = '', sort = 'newest' } = {}) {
    const seen = new Set();
    const q = search.trim().toLowerCase();
    return (posts || []).filter(deal => {
      if (eligibility(deal, now) !== 'active') return false;
      if (deal.asin && seen.has(deal.asin)) return false;
      if (deal.asin) seen.add(deal.asin);
      if (q) return (deal.title || '').toLowerCase().includes(q) || (deal.category || '').toLowerCase().includes(q);
      if (categories.length) return categories.includes('__promo__') ? !!deal.promoCode : categories.includes(deal.category);
      return !latest || deal.category !== 'Other';
    }).sort((a, b) => (sort === 'discount' ? (Number(b.discount) || 0) - (Number(a.discount) || 0) : 0) || (b.ts || '').localeCompare(a.ts || ''));
  }
  return { expiryTime, eligibility, activeDeals };
}
module.exports = createFeedPolicy;

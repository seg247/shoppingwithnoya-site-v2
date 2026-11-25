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
  // Browse-only, conservative named-model projection. Never change the data,
  // slugs or affiliate URLs. Unknown/ambiguous models retain ASIN identity.
  function familyKey(deal) {
    if (typeof deal.title !== 'string') return null;
    const t = deal.title.replace(/^[^a-z0-9]+/i, '').replace(/[™®]/g, '').toLowerCase().replace(/\s*:\s*cell phones & accessories\s*$/, '');
    // Material configurations and unrecognised bundles must not collapse.
    if (/\b(bundle|combo|kit|accessories|replacement|refurbished|renewed|wide|5g|lte|cellular|architect|essentials)\b|\b\d+\s*[- ]?\s*(pack|count|pcs|pieces)\b/.test(t)) return null;
    // Only these exact, known standard descriptions may use "with".
    // Any other explicit inclusion is uncertain configuration, not a color.
    const inclusions = t
      .replace(/\bcompatible with apple & android devices\b/g, 'compatible')
      .replace(/\bworks with all k-cup pods\b/g, 'works')
      .replace(/\bwith pouring shield(?=\s*(?:[-,:|]|$))/g, 'pouring shield')
      .replace(/\bwith handle and straw(?=\s*(?:\d+\s*oz\b|[|:]|$))/g, 'handle and straw')
      .replace(/^beats studio pro bluetooth noise cancelling headphones with apple 20w usb-c power adapter\s*-/, 'known beats adapter bundle -');
    if (/\bwith\b/.test(inclusions)) return null;
    if (/\bedition\b/.test(t) && !/^samsung galaxy tab a11\+ kids edition,/.test(t)) return null;
    // Abt model pages 242698/242699/242700 independently confirm these
    // exact 2026 2nd-gen Retinal 2K doorbell-only colors. Title alone cannot
    // distinguish generations; future/unknown ASINs remain ungrouped.
    if (t === 'ring battery doorbell | video doorbell camera' && ['B0G2D1R15Q', 'B0FHJ7TKZM', 'B0G2D25MF2'].includes(deal.asin)) return 'ring-battery-doorbell-2026-2nd-gen-only';
    if (/^beats studio pro over-ear headphones\b/.test(t) && !/\bwith\b/.test(t.split('|')[0])) return 'beats-studio-pro';
    if (/^beats studio pro bluetooth noise cancelling headphones with apple 20w usb-c power adapter\s*-/.test(t)) return 'beats-studio-pro-apple-20w';
    if (/^beats solo 4 on-ear headphones\b/.test(t) && !/\bwith\b/.test(t.split('|')[0])) return 'beats-solo-4';
    if (/^oura ring 5 smart ring\s*-/.test(t)) return 'oura-ring-5';
    let m = t.match(/^samsung galaxy tab a11\+\s+(\d+)\s*gb ram,\s*(\d+)\s*gb storage\b/);
    if (m) return `samsung-tab-a11-plus-${m[1]}gb-${m[2]}gb`;
    m = t.match(/^samsung galaxy tab a11\+ kids edition, (?:amazon exclusive, )?(\d+)\s*gb android tablet\b/);
    if (m) return `samsung-tab-a11-plus-kids-${m[1]}gb`;
    if (/\bedition\b/.test(t)) return null;
    if (/^playstation dualsense wireless controller\s*[-–]/.test(t) && !/\bwith\b/.test(t)) return 'playstation-dualsense-standard';
    if (/^adidas women's vl court 3\.0(?:,| sneakers\b)/.test(t)) return 'adidas-women-vl-court-3.0';
    m = t.match(/^stanley quencher h2\.0 flow state tumbler,\s*(\d+)\s*oz,/);
    if (m && !/\bfluted\b/.test(t)) return `stanley-quencher-h2.0-${m[1]}oz`;
    if (/^sony wh-1000xm6\b/.test(t) && !/\bwith\b/.test(t.split('|')[0])) return 'sony-wh-1000xm6';
    if (/^kitchenaid ksm150ps[a-z]{2}\b/.test(t)) return 'kitchenaid-ksm150ps';
    if (/^keurig k-express single serve\b/.test(t) && !/\bwith\b/.test(t.split('|')[0])) return 'keurig-k-express';
    if (/^skullcandy crusher evo wireless multi-sensory bass headphones\s*-/.test(t)) return 'skullcandy-crusher-evo';
    if (/^carhartt men's iconic k288 logo sweatshirt,/.test(t)) return 'carhartt-men-k288';
    m = t.match(/^google pixel 11 pro xl - unlocked smartphone[^|]*?\b(\d+)\s*(gb|tb)\s*-/);
    if (m) return `google-pixel-11-pro-xl-unlocked-${m[1]}${m[2]}`;
    m = t.match(/^stanley quencher h2\.0 tumbler with handle and straw (\d+)\s*oz\b/);
    if (m && /\bfluted\b/.test(t)) return `stanley-quencher-h2.0-fluted-${m[1]}oz`;
    m = t.match(/^stanley iceflow 2\.0 flip straw tumbler, (\d+)\s*oz,/);
    if (m) return `stanley-iceflow-2.0-${m[1]}oz`;
    m = t.match(/^owala freesip stainless steel water bottle (\d+)\s*oz\b/);
    if (m) return `owala-freesip-stainless-${m[1]}oz`;
    // Explicit stretch is a material configuration. Unspecified fabric stays
    // unchanged rather than assuming that all 505 listings use the same cloth.
    if (/^levi's men's 505 regular fit jeans\b/.test(t) && /\bstretch\b/.test(t) && !/\b(high|non)\s*[- ]?stretch\b/.test(t)) return 'levis-men-505-stretch';
    return null;
  }
  function activeDeals(posts, { now = Date.now(), latest = false, categories = [], search = '', sort = 'newest' } = {}) {
    const q = search.trim().toLowerCase();
    const matches = (posts || []).filter(deal => {
      if (eligibility(deal, now) !== 'active') return false;
      if (q) return (typeof deal.title === 'string' && deal.title.toLowerCase().includes(q)) || (typeof deal.category === 'string' && deal.category.toLowerCase().includes(q));
      if (categories.length) return categories.includes('__promo__') ? !!deal.promoCode : categories.includes(deal.category);
      return !latest || deal.category !== 'Other';
    }).sort((a, b) => (sort === 'discount' ? (Number(b.discount) || 0) - (Number(a.discount) || 0) : 0) || (b.ts || '').localeCompare(a.ts || ''));
    const seenAsins = new Set(), seenFamilies = new Set();
    return matches.filter(deal => {
      if (deal.asin && seenAsins.has(deal.asin)) return false;
      if (deal.asin) seenAsins.add(deal.asin);
      const key = familyKey(deal);
      if (key && seenFamilies.has(key)) return false;
      if (key) seenFamilies.add(key);
      return true;
    });
  }
  return { expiryTime, eligibility, familyKey, activeDeals };
}
module.exports = createFeedPolicy;

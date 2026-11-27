// Self-contained factory shared byte-for-byte with the canonical exporter.
// This does not discover offers: only reviewed structured retailer evidence qualifies.
module.exports = function createCampaignPolicy() {
  const DAY = 86400000;
  function timestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return NaN;
    const n = Date.parse(value);
    return Number.isFinite(n) && new Date(n).toISOString() === value ? n : NaN;
  }
  function officialUrl(value) {
    if (typeof value !== 'string' || /[\s\\]/.test(value)) return null;
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) return null;
      if (!['www.amazon.com','amazon.com','www.ae.com','www.walmart.com','www.kohls.com','www.clinique.com','www.ulta.com'].includes(u.hostname)) return null;
      return u;
    } catch { return null; }
  }
  function productIdentity(u) {
    if (/^(www\.)?amazon\.com$/.test(u.hostname)) return u.pathname.match(/^\/dp\/([A-Z0-9]{10})\/?$/)?.[1];
    if (u.hostname === 'www.ae.com') return u.pathname.match(/\/(\d{4}_\d{4}_\d{3})\/?$/)?.[1];
    if (u.hostname === 'www.walmart.com') return u.pathname.match(/\/ip\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
    if (u.hostname === 'www.kohls.com') return u.pathname.match(/\/product\/prd-(\d+)\//)?.[1];
    if (u.hostname === 'www.clinique.com' && u.pathname === '/products/almost-lipstick-in-black-honey-pink-honey-and-nude-honey') return u.searchParams.get('variant');
    if (u.hostname === 'www.ulta.com' && u.pathname === '/p/cheirosa-all-way-mini-perfume-mist-gift-set-pimprod2061914' && u.searchParams.get('sku') === '2661471') return '2661471';
    return null;
  }
  function getCampaign(deal, now = Date.now()) {
    const c = deal?.campaign;
    if (deal?.status === 'archived' || !c || c.kind !== 'black-friday' || c.offerVerified !== true || !Number.isFinite(now)) return null;
    if (typeof c.evidenceText !== 'string' || (!/\bblack friday\b/i.test(c.evidenceText) || /[$%]/.test(c.evidenceText))) return null;
    const verified = timestamp(c.verifiedAt), until = timestamp(c.validUntil);
    if (!Number.isFinite(verified) || !Number.isFinite(until) || verified > now || until <= now || until <= verified) return null;
    if (c.validityBasis === 'freshness-ttl') { if (until - verified > DAY) return null; }
    else if (c.validityBasis === 'retailer-end') {
      const end = timestamp(c.retailerEndsAt);
      if (!Number.isFinite(end) || until > end || end - verified > 14 * DAY) return null;
    } else return null;
    if (typeof deal.url !== 'string' || c.recordUrl !== deal.url) return null;
    const product = officialUrl(c.productUrl), source = officialUrl(c.sourceUrl);
    if (!product || !source || product.hostname.replace(/^www\./,'') !== source.hostname.replace(/^www\./,'')) return null;
    if (!c.productId || productIdentity(product) !== c.productId) return null;
    if (/amazon\.com$/.test(product.hostname)) {
      const target = officialUrl(deal.url);
      if (deal.asin !== c.productId || !target || productIdentity(target) !== c.productId) return null;
    } else {
      try { const target = new URL(deal.url); if (target.protocol !== 'https:' || target.hostname !== 'mavely.app.link' || target.username || target.password || target.port) return null; } catch { return null; }
      if (c.recordId !== deal.asin) return null;
    }
    const safe = {};
    for (const key of ['kind','productId','productUrl','sourceUrl','recordUrl','recordId','verifiedAt','validUntil','validityBasis','evidenceText','offerVerified','retailerEndsAt','retailerEndDate','validityNote']) {
      if (c[key] !== undefined) safe[key] = c[key];
    }
    return safe;
  }
  function escape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
  function renderCampaignBadge(deal, now = Date.now()) {
    const campaign = getCampaign(deal, now);
    if (!campaign) return '';
    const payload = JSON.stringify({asin:deal.asin || null,url:deal.url,campaign});
    return '<span class="sale-campaign" data-sale-campaign="' + escape(payload) + '">Black Friday Sale</span>';
  }
  return { getCampaign, renderCampaignBadge };
};

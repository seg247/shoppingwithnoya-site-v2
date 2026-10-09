// Pure identity guard from shoppingwithnoya/productIdentity.js, verified 2026-10-09.
'use strict';

// A deliberately conservative gate, not an entity resolver. False negatives
// quarantine a deal; fuzzy similarity must not lend one product another's offer.
const REJECTION_CODE = 'PRODUCT_IDENTITY_REJECTED';

function rejectIdentity(reason) {
  const error = new Error(`Product identity rejected: ${reason}`);
  error.code = REJECTION_CODE;
  // Only fixed reason codes are passed here; never put captions/URLs in errors.
  return error;
}

function isIdentityRejection(error) {
  return error?.code === REJECTION_CODE;
}

function extractAsin(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) ||
        !/^(?:www\.)?amazon\.(?:com|co\.uk|ca|de)$/i.test(url.hostname) ||
        url.username || url.password) return null;
    const path = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i);
    const redirects = url.searchParams.getAll('redirectAsin');
    if (redirects.length > 1) return null;
    if (redirects.length && !/^[A-Z0-9]{10}$/i.test(redirects[0])) return null;
    if (path && redirects.length && path[1].toUpperCase() !== redirects[0].toUpperCase()) return null;
    if (path) return path[1];
    return /^\/promotion\/psp(?:\/|$)/.test(url.pathname) ? redirects[0] || null : null;
  } catch {
    return null;
  }
}

function assertTargetIdentity(url, originalUrl) {
  const asin = extractAsin(url);
  if (!asin) throw rejectIdentity('target_asin_unavailable');
  const originalAsin = originalUrl && extractAsin(originalUrl);
  if (originalAsin && originalAsin.toUpperCase() !== asin.toUpperCase()) {
    throw rejectIdentity('target_asin_changed');
  }
  return asin;
}

const STOP_WORDS = new Set('a an the and or for with by of to in on at from your this that'.split(' '));
// These tokens can constrain a match, but cannot be its distinguishing evidence.
const GENERIC_WORDS = new Set((
  'new premium natural quality professional best great amazing hot deal sale off coupon save ' +
  'free special perfect original product products pack set kit size count women woman men man ' +
  'kids baby home portable large small white black blue red pink dry hair skin oil shampoo ' +
  'conditioner foundation charging cable usb wireless soft light daily use oz ounce ounces'
).split(' '));

function titleTokens(title) {
  if (typeof title !== 'string') return [];
  return [...new Set(title.normalize('NFKC').toLowerCase()
    .replace(/&amp;/g, ' and ')
    .replace(/\$\s*\d+(?:[.,]\d+)*(?:\.xx)?/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*%\s*(?:off)?/g, ' ')
    .match(/[\p{L}\p{N}]+/gu) || [])]
    .filter(word => !STOP_WORDS.has(word));
}

function sufficientEvidence(tokens) {
  return tokens.length >= 3 && tokens.filter(word =>
    word.length >= 3 && /\p{L}/u.test(word) && !GENERIC_WORDS.has(word)
  ).length >= 2;
}

function assertMerchantAsin(asin, merchantAsin) {
  if (merchantAsin != null && (typeof merchantAsin !== 'string' ||
      !/^[A-Z0-9]{10}$/i.test(merchantAsin) || merchantAsin.toUpperCase() !== asin.toUpperCase())) {
    throw rejectIdentity('merchant_asin_mismatch');
  }
}

function assertProductIdentity({ sourceTitle, merchantTitle, asin, merchantAsin, requireSource = false }) {
  assertMerchantAsin(asin, merchantAsin);
  if (typeof merchantTitle !== 'string' || /\b(?:robot check|captcha|automated access|sign[ -]?in|service unavailable)\b/i.test(merchantTitle)) {
    throw rejectIdentity('merchant_title_unavailable');
  }
  const merchant = titleTokens(merchantTitle);
  if (!sufficientEvidence(merchant)) throw rejectIdentity('merchant_title_unavailable');
  const source = titleTokens(sourceTitle);
  if (requireSource && !sufficientEvidence(source)) throw rejectIdentity('source_title_uncertain');
  if (source.length) {
    if (!sufficientEvidence(source)) throw rejectIdentity('source_title_uncertain');
    // Permit word-boundary truncation and reordering, but require every source
    // token: even a single differing model, variant or product type is unsafe.
    const merchantWords = new Set(merchant);
    if (!source.every(word => merchantWords.has(word))) throw rejectIdentity('title_mismatch');
  }
  // This attests title consistency only, not price/discount or image provenance.
  return { status: source.length ? 'matched' : 'merchant-only', method: 'conservative-title', asin };
}

module.exports = { extractAsin, assertTargetIdentity, assertMerchantAsin, assertProductIdentity, rejectIdentity, isIdentityRejection };

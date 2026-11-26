# Verified Black Friday Sale indicator

Only explicit, reviewed exact retailer BF evidence qualifies. The canonical bot `sale-campaigns.json` registry stores `kind`, exact `recordUrl`/`recordId`, retailer `productUrl`/`productId`, official `sourceUrl`, `evidenceText`, `offerVerified`, `verifiedAt`, `validUntil` and `validityBasis`. No title/date/discount/source/batch inference. Synthetic non-Amazon route identifiers remain unchanged, not treated as ASIN proof.

`sourceUrl` + `productUrl` bind official campaign terms to the exact SKU. Clinique standard Black Honey variant 54073304744131 ends 2026-12-04T08:00:00.000Z. Kohl TAKE20 terms expose November 28 but not a time: its badge uses a 24-hour evidence TTL, NOT an invented sale-end timestamp. Other unknown ends also use at most 24 hours after actual observation. Refresh never extends verification. Reverify retailer evidence before deliberately editing registry times; there is no new scheduled rechecker.

The exporter emits optional validated `campaign` only for an exact matched current record. No archive or family-level propagation. Shared factory is byte-identical across bot/site. Existing feed/family/sort/filter/routing policy is untouched.

SSR homepage/category/detail and hydrated search/filter/pagination use the same policy and fixed label. Shared head runtime observes arriving SSR/rehydrated badges, removes invalid/expired metadata, sets exact-expiry timeout, and rechecks on page restore/visibility. With JavaScript disabled, any static HTML remains a build-time snapshot; normal runtime prevents stale badges during deployment outages. Badge is berry text on pale pink, in text body rather than over photography.

Qualified initial evidence: AE77 2542_5034_001; Joyspun 20371719048; Aerie 2164_2169_135; Kohl1944597; Clinique variant54073304744131; Amazon B014E2D6BY/B0F979GZ8B/B0028MB3HM/B00BAGTNAQ. Medicube B09V7Z4TJG, Crayola650803535 and Target BISSELL3605 lack explicit item BF evidence and remain unbadged. LEGO was not approved and is not added. No scraped prices/ratings/discount claims are added.

TDD receipts, clean install/full suite, browser geometry, screenshot and release/natural-refresh readback are retained outside repo under Black-Friday-Deals-2026/website-sale-indicator.

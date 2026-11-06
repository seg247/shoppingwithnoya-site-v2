# Future QA traffic (opt-in, report-only)

Start deliberate browser QA with `?noya_test=qa-YYYYMMDD-purpose` (use `&` if a query already exists). Use only 1–64 ASCII letters, numbers, underscores or hyphens; no names, emails or identifiers. Duplicate/empty/invalid markers do nothing. Never add QA markers to public/shared campaigns.

The existing GA config and automatic events remain intact. On explicitly marked pages, `noya_test` is queued before GA config, and page_location retains the query. Same-origin page links (including hydrated links) and GET searches retain the marker; affiliate/external links, downloads, fragment-only links, POST forms and canonical/social/share data do not change. There is no cookie/session/local-storage persistence. Open a clean unmarked URL to stop marking. Do not copy QA navigation links to customers.

Keep raw Analytics totals. Use a separate reversible exploration/report filter: Hostname exactly matches `deals.shoppingwithnoya.com`; Page path + query string does not contain `noya_test=`. Existing Amazon click exploration also restricts Event name to click and verified Amazon shopping destinations. Retain its current URL regex. Do not activate data exclusion filters, delete events, classify all Direct traffic, or exclude household IPs. Historical unmarked traffic cannot be recovered or relabeled.

The page-path/query filter needs no custom dimension. Using `noya_test` as a standalone report dimension would require a separately registered event-scoped custom definition and prospective processing; this release does not create one. GA receiver collection is not proven by a local dataLayer assertion.

Default automated browser QA must block analytics/tag collectors BEFORE navigation and avoid merchant/Share clicks. Local runtime tests can inspect the real queue and destinations with collection blocked. A separately authorized end-to-end receiver proof would be a different test, explicitly marked and reported; do not generate production GA events merely to test this convention.

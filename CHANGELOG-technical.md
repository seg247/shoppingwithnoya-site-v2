# Technical changes — 2026-11-06

- Exclude `/dashboard/` from generated sitemap while retaining route, noindex and robots policy.
- Opt-in future `noya_test` QA marker: queued event parameter and source-page query survive internal navigation/GET searches; no storage or collection/report-history changes. Ordinary visits and retailer destinations unchanged. See docs/qa-traffic.md.

## 2026-11-25 — approved product-family browse cleanup

- One browse card per confidently identified model/configuration for color/size variants, with newest (or highest-discount) matching representative. Unknowns stay separate.
- Shared SSR/hydration/category policy; match before grouping and count/paginate after. Category route and individual deal URL retention unchanged; no feed record or affiliate URL deletions.
- Narrow approval: no posting, scheduler, service or redesign changes. See docs/product-family-cleanup.md and product-family regression tests.

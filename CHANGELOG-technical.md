# Technical changes — 2026-11-06

- Exclude `/dashboard/` from generated sitemap while retaining route, noindex and robots policy.
- Opt-in future `noya_test` QA marker: queued event parameter and source-page query survive internal navigation/GET searches; no storage or collection/report-history changes. Ordinary visits and retailer destinations unchanged. See docs/qa-traffic.md.

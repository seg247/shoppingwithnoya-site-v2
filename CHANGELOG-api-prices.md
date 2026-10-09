# API-verified website prices, 2026-10-09

Sarah approved exact Amazon API prices on the website only and storage of existing credentials as encrypted GitHub deployment secrets. Social captions remain price-free.

- Separate deployment-generated price snapshot. No prices, API secrets or caches committed to git.
- Existing ten-minute site-data pushes trigger deployment; it refreshes matching ASIN/title new buy-box offers. Valid previously published API observations can be reused for at most 45 minutes. Failed/missing/used/mismatched offers are not converted into numeric prices.
- Currency, exact API display amount, source, real observation time and one-hour expiry travel together. Browser hides observations at expiry, on fetch failure and during back/forward restoration until refreshed. No cookies/localStorage cache.
- Homepage, category and active deal pages share disclosure and timestamp behavior. No Offer schema, invented stock, merchant-as-seller claim, coupon price adjustment or archive prices.
- Deployment artifacts expire in one day. Product routes, affiliate destinations and existing marketing/social pipelines unchanged.
- Isolated browser comparison found pre-existing 320px results-header overflow on homepage/category; price addition did not change those widths. 390px/1280px price display and sampled deal-page 320px passed.

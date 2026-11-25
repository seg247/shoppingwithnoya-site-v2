# Product-family browse cleanup

Sarah approved one card per product model for color/size variants, keeping distinct models/configurations and genuine bundles separate. Individual listings, slugs and affiliate links remain untouched.

This change affects only the shared browse projection and its homepage/category consumers. No posting, scheduling, restart, archive or export-record changes. Unknown identity remains unchanged.
# Design

Use the byte-identical bot/site factory, also embedded in homepage HTML. Match eligibility/search/category before sorting and family projection. Pick newest by default, highest discount (then newest) for discount sort. Exact named-model rules only; never use title_norm, fuzzy matching, color stripping or guessed ASIN relationships. An independently verified exact-ASIN exception is documented below. Preserve RAM/storage, edition, explicit fabric/stretch, capacity, fluted design, generation, bundles, packs and extras. Unknown or incomplete model/configuration falls back to ASIN identity.

Category routes remain based on raw record volume. Category grids, sibling counts and homepage footer counts filter to the category before grouping. Zero-active categories do not become filter chips. Product routes continue using full records. The exporter still emits all eligible records; its activeTotal remains an eligibility count, not a browse-family count.

TDD: reproduce known snapshot duplicates and adversarial distinctions; observe RED before every implementation increment. Full build/test and actual Chrome desktop/mobile hydration plus public readback are release gates.
# Product-family browse policy

## Requirements
- Browse surfaces SHALL show at most one representative of a confidently identified model/configuration for color/size-only variants.
- Eligibility and query/category matching SHALL precede grouping; sorting SHALL determine representative selection before pagination/counts.
- Distinct models, capacities, connectivity/configurations, genuine bundles, packs and explicit extras SHALL remain separate. Unknown or incomplete identity SHALL not be guessed.
- All data records, individual deal routes/slugs, original affiliate destinations, archive/history and schedules SHALL remain intact.
- Bot siteFeedEligibility.cjs and site src/lib/active-feed.cjs SHALL remain byte-identical; SSR, hydration and category projection SHALL use this shared implementation.
- Category routes SHALL remain based on raw published records; displayed counts SHALL describe the relevant category projection. No zero-result historical category SHALL produce a dead filter chip.

## Scenarios
- Plain Beats Studio Pro colors collapse; Apple 20W adapter bundle remains separate (its colors collapse within that bundle).
- Oura Ring 5 color/size variants collapse; generations, sizing kits, special editions and extra chargers remain separate.
- Samsung Galaxy Tab A11+ colors collapse only within explicit RAM/storage and Kids Edition configurations; connectivity and keyboard/case extras remain separate.
- Standard DualSense colors collapse; Edge, special editions, accessories and bundles remain separate.
- STANLEY Quencher capacity and fluted design remain separate. Color variants collapse only where volume is explicit. Missing volume remains unchanged.
- adidas women VL Court 3.0 color/size variants collapse; gender, different models and widths remain separate.
- Exact named Sony WH-1000XM6, Beats Solo4, Skullcandy Crusher Evo, KSM150PS Artisan, Keurig K-Express, Carhartt K288, Pixel11ProXL unlocked+storage, Owala FreeSip stainless+capacity and IceFlow2.0+capacity color variants collapse conservatively. Levi505 groups only explicit stretch variants; unknown fabric stays separate.
- Search Silver returns the matching silver variant even if a newer gold variant represents its model in the unfiltered grid.
- Feed refreshes with new ASINs use the same model rules without edits to data or a hardcoded ID list.

## Independently verified Ring exception

The exact title `Ring Battery Doorbell | Video Doorbell Camera` is ambiguous across generations, so it is never grouped generically. Only B0G2D1R15Q, B0FHJ7TKZM and B0G2D25MF2 are grouped as the 2026 2nd-generation Retinal 2K doorbell-only model in Mocha/Speckled Gray/Speckled White. Parent independent HTTP verification confirms exact identifiers, 2ndGen and colors on:
- https://www.abt.com/Ring-Battery-Doorbell-with-Retinal-2K-in-Matte-Mocha-B0G2D1R15Q/p/242698.html
- https://www.abt.com/Ring-Battery-Doorbell-with-Retinal-2K-in-Speckled-Gray-B0FHJ7TKZM/p/242699.html
- https://www.abt.com/Ring-Battery-Doorbell-with-Retinal-2K-in-Speckled-White-B0G2D25MF2/p/242700.html

Unknown ASINs and changed titles (including bundles) stay separate. Images are unchanged.

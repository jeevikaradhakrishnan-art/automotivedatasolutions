## Scope

Large multi-area refactor. Implementing in this order:

### 1. Solutions list reorder & relabel (`src/data/solutions.ts`)

New order + titles + one-liners:
1. **OEM Configurator Data** (new, first) — "Bespoke car-configurator pipelines built per customer: scrape OEM build-and-price journeys, capture every option, package and trim, and emit fully-priced configurations not available off-the-shelf."
2. **EV Charging Network Insights** (rename from EV Charging Stations)
3. **Predictive Insights** (rename from News Monitoring)
4. **Plant Operations Intelligence** (rename from Plant/Production)
5. **Dealer & Inventory Intelligence**
6. **Vehicle Specification Data** — "Standardized spec sheets and brochure data published by brands on their public model pages — normalized to a single schema across OEMs." (remove OEM phrasing)

### 2. Sidebar (`src/components/layout/Sidebar.tsx`)
Replace `Admin` with `Capabilities` (icon: Sparkles). Admin route kept but unlinked — accessible only via `/admin` URL.

### 3. Capabilities section (new route `src/routes/_app.capabilities.tsx` + detail `_app.capabilities.$id.tsx`)
Landing grid of use-case cards (image + title + hover one-liner). Click → detailed landing page with: customer profile (anonymized as "Top-5 global OEM" etc.), problem statement, solution, key metrics tiles, tables/images where relevant, sample data download button (generates CSV locally via blob).

Use cases (6):
- **Honda — Polygon/Location Data for Fleet Management** (from xtract.io case study)
- **TrueCar — Independent Dealer Verification** (from proposal docx)
- **TrueCar — PDF-to-Excel Residual Data Extraction** (from proposal docx)
- **GM Maven — Competitor Pricing Intelligence** (techmobius case study)
- **eBay/Edmunds — Auto Fitment Data** (placeholder content)
- **Shimano — Market Research** (placeholder content)

Will parse the two TrueCar docx files and the techmobius/xtract pages for content.

### 4. OEM Configurator sources + bot integration (`src/data/solution-detail.ts`)
Add Tesla to BMW/etc. source list. Add metadata referencing the two uploaded Python scrapers (BMW_Data_Collector.py, tesla_data_extractor.py) as the runtime engine. Running a source → spawns job → HITL item with real-ish preview (rendered HTML mock of BMW/Tesla configurator page on LHS + extracted attributes on RHS).

### 5. HITL landing rework (`src/routes/_app.hitl.tsx`)
Landing now shows **table of jobs pending review** (not workflow grouping): columns Job ID, Solution, Workflow, Source, Rows, Assigned Reviewer, Tags, Action. Click row → existing validation LHS/RHS screen. Already supports per-job review queue; just reskin the landing.

### 6. Workflows configure drawer (`src/routes/_app.solutions.$id.tsx`)
Configure dialog should include: source multi-select (✓), refresh frequency dropdown (daily/weekly/monthly/on-demand), data points checklist, region dropdown, output template selector. Add missing fields.

### 7. Sources tab — run as job
Add a "Run" button per source row that spawns a job directly (mirrors workflow-run path, single source).

### 8. Integrations tab
Add "Data Push" destination types: Data Lake (S3/ADLS/GCS), Analytics (Snowflake/BigQuery/Redshift/Databricks), Reverse-ETL (Hightouch/Census), Webhook. Already has Snowflake/S3/BigQuery — extend with Databricks, ADLS, Hightouch, Webhook.

### 9. Admin
Keep route `/admin` working; remove from sidebar; remove TopBar link if any.

## Out of scope / placeholders
- Actually executing the Python scrapers — simulated via existing job system with realistic generated rows.
- Last two use cases (eBay, Shimano) — placeholder content as user stated.

## Files to edit/create
- `src/data/solutions.ts` (reorder, rename, one-liners)
- `src/data/solution-detail.ts` (add Tesla source, OEM configurator script refs)
- `src/data/capabilities.ts` (new — use case content)
- `src/routes/_app.capabilities.tsx` (new — landing)
- `src/routes/_app.capabilities.$id.tsx` (new — detail)
- `src/components/layout/Sidebar.tsx` (Capabilities replaces Admin)
- `src/routes/_app.hitl.tsx` (jobs table landing)
- `src/routes/_app.solutions.$id.tsx` (workflow configure fields, source run button, integrations expanded)
- `src/store/platform.ts` (job-from-source action, reviewer/tags on jobs)
- Generate 6 use-case hero images via imagegen

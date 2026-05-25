import { Car, MapPin, FileSpreadsheet, BadgeDollarSign, Cog, Search, type LucideIcon } from "lucide-react";

export interface CapabilityMetric {
  value: string;
  label: string;
  sub?: string;
}

export interface CapabilityCase {
  id: string;
  title: string;
  customerProfile: string;          // anonymized
  oneLiner: string;
  icon: LucideIcon;
  accent: string;                    // tailwind gradient classes
  problem: string;
  solution: string[];                // bullet points
  metrics: CapabilityMetric[];
  approach: { phase: string; detail: string }[];
  outputColumns: string[];
  sampleRows: Record<string, string | number>[];
  sourceUrl?: string;                // reference case study (not shown to user as customer name)
  placeholder?: boolean;
}

export const CAPABILITIES: CapabilityCase[] = [
  {
    id: "fleet-polygon",
    title: "Polygon Location Data for Fleet Management",
    customerProfile: "Top-3 global OEM · Mobility services division",
    oneLiner: "Hyper-accurate polygon boundaries for ride-share and fleet ops across 200+ urban zones.",
    icon: MapPin,
    accent: "from-cyan/30 to-primary/10",
    problem:
      "The customer's fleet management platform required precise polygon definitions for service zones, no-go areas, airport pickup boundaries and city operating regions across hundreds of cities. Public sources were inconsistent, often shifted boundaries year-over-year, and lacked the granularity needed for real-time driver routing and pricing.",
    solution: [
      "Sourced authoritative administrative boundaries from open civic data + commercial geospatial feeds",
      "Built a polygon normalization pipeline (GeoJSON, simplified for mobile rendering)",
      "Layered on operational overlays — airport pickup, downtown surge, school zones",
      "Versioned every polygon with effective dates and human QA on every boundary change",
    ],
    metrics: [
      { value: "200+",   label: "Cities mapped" },
      { value: "12,400", label: "Polygons delivered" },
      { value: "99.7%",  label: "Boundary accuracy" },
      { value: "48h",    label: "Refresh SLA" },
    ],
    approach: [
      { phase: "Discover",  detail: "Audit civic GIS portals + commercial geo feeds per city" },
      { phase: "Extract",   detail: "Pull KML / Shapefile / WFS layers, snap to OSM road network" },
      { phase: "Normalize", detail: "Simplify to mobile-friendly GeoJSON; tag operational overlays" },
      { phase: "QA",        detail: "Human reviewer validates every boundary change in HITL" },
      { phase: "Deliver",   detail: "Push to S3 + CDN with versioned URLs and changelog" },
    ],
    outputColumns: ["City", "Zone Name", "Type", "Polygon Vertices", "Effective Date"],
    sampleRows: [
      { City: "Austin, TX",    "Zone Name": "Downtown Core",   Type: "Operating",       "Polygon Vertices": 184, "Effective Date": "2026-01-15" },
      { City: "Austin, TX",    "Zone Name": "AUS Airport Pickup", Type: "Airport",      "Polygon Vertices": 28,  "Effective Date": "2025-11-04" },
      { City: "Boston, MA",    "Zone Name": "Logan Airport",    Type: "Airport",        "Polygon Vertices": 41,  "Effective Date": "2025-09-22" },
      { City: "Seattle, WA",   "Zone Name": "Downtown Surge",   Type: "Surge",          "Polygon Vertices": 96,  "Effective Date": "2026-02-10" },
      { City: "Miami, FL",     "Zone Name": "South Beach",      Type: "Operating",      "Polygon Vertices": 112, "Effective Date": "2025-12-01" },
    ],
    sourceUrl: "https://www.xtract.io/resources/casestudies/location-data-fleet-management",
  },
  {
    id: "dealer-verification",
    title: "Independent Dealer Verification (Live)",
    customerProfile: "Leading US automotive marketplace · listing-quality team",
    oneLiner: "Continuous verification of independent dealer rooftops — phone, address, hours, brand, listing legitimacy.",
    icon: Search,
    accent: "from-amber/30 to-cyan/10",
    problem:
      "Independent dealers churn far more than franchise rooftops. The customer's marketplace surfaced thousands of independent dealer listings whose addresses, phones, operating hours and brand affiliations went stale within weeks — eroding consumer trust and increasing support load.",
    solution: [
      "Built a continuous verification crawler hitting each dealer's own site + Google Business Profile",
      "Cross-checked phone & address against state DMV dealer license registries",
      "Live HITL queue for ambiguous matches (name variants, ownership changes)",
      "Pushed verification status (Verified / Suspect / Stale) back to the marketplace every 4 hours",
    ],
    metrics: [
      { value: "32,400", label: "Dealers under verification" },
      { value: "4h",     label: "Re-verification cadence" },
      { value: "94.6%",  label: "Auto-verified" },
      { value: "<5min",  label: "HITL turnaround" },
    ],
    approach: [
      { phase: "Crawl",    detail: "Daily multi-source pull: dealer site, GBP, state DMV registry" },
      { phase: "Match",    detail: "Fuzzy match name + address + phone with confidence score" },
      { phase: "Flag",     detail: "Route low-confidence cases to live HITL (median 4-min decision)" },
      { phase: "Publish",  detail: "Push status events to marketplace via webhook every 4h" },
    ],
    outputColumns: ["Dealer Name", "City", "State", "Phone", "License #", "Status", "Last Verified"],
    sampleRows: [
      { "Dealer Name": "Texas Auto Pros",       City: "Houston",     State: "TX", Phone: "(713) 555-0118", "License #": "TX-DLR-44219", Status: "Verified",     "Last Verified": "2h ago" },
      { "Dealer Name": "Sun State Motors",      City: "Tampa",       State: "FL", Phone: "(813) 555-0146", "License #": "FL-DLR-71204", Status: "Verified",     "Last Verified": "3h ago" },
      { "Dealer Name": "Westside Auto Outlet",  City: "Phoenix",     State: "AZ", Phone: "(602) 555-0177", "License #": "AZ-DLR-30182", Status: "Suspect",      "Last Verified": "30m ago" },
      { "Dealer Name": "Coastal Car Connection",City: "Wilmington",  State: "NC", Phone: "(910) 555-0193", "License #": "NC-DLR-18829", Status: "Stale",        "Last Verified": "5d ago" },
      { "Dealer Name": "Mile-High Imports",     City: "Denver",      State: "CO", Phone: "(303) 555-0142", "License #": "CO-DLR-29914", Status: "Verified",     "Last Verified": "1h ago" },
    ],
  },
  {
    id: "residual-pdf-excel",
    title: "PDF → Excel Residual Value Extraction",
    customerProfile: "Leading US automotive marketplace · valuations team",
    oneLiner: "Convert hundreds of monthly residual-value PDFs from finance providers into structured Excel models.",
    icon: FileSpreadsheet,
    accent: "from-success/30 to-primary/10",
    problem:
      "The customer's valuations team received residual value tables from multiple finance and leasing providers as PDF documents — different layouts every month, mixed page orientations, sub-tables, footnotes, term/mileage matrices. Manual transcription consumed 80+ analyst hours per month with high error rates.",
    solution: [
      "Auto-classified incoming PDFs by provider / publication date / model year",
      "Layout-aware extraction (table boundary detection + footnote/qualifier capture)",
      "Mapped raw extracted cells onto the customer's canonical residual schema (MY / Trim / Term / Miles → %)",
      "HITL gate on every PDF before Excel emission; downstream model auto-recalculated",
    ],
    metrics: [
      { value: "240+",  label: "PDFs / month" },
      { value: "97.8%", label: "Cell-level accuracy" },
      { value: "80→4",  label: "Analyst hours saved" },
      { value: "<10min",label: "PDF → Excel turnaround" },
    ],
    approach: [
      { phase: "Ingest",    detail: "Provider-keyed inbox + S3 drop folder picks up new PDFs" },
      { phase: "Classify",  detail: "Identify provider, publication month, model year scope" },
      { phase: "Extract",   detail: "Table-aware extraction; footnotes attached to cells they qualify" },
      { phase: "Map",       detail: "Onto customer's residual schema: MY × Trim × Term × Miles → %" },
      { phase: "Review",    detail: "Every PDF reviewed in HITL before Excel publish" },
      { phase: "Deliver",   detail: "Versioned XLSX dropped to the team's SharePoint + change log" },
    ],
    outputColumns: ["Provider", "MY", "Model", "Trim", "Term (mo)", "Miles", "Residual %"],
    sampleRows: [
      { Provider: "Provider A", MY: 2026, Model: "Sedan X",  Trim: "SE",   "Term (mo)": 36, Miles: 12000, "Residual %": "58.2%" },
      { Provider: "Provider A", MY: 2026, Model: "Sedan X",  Trim: "SE",   "Term (mo)": 36, Miles: 15000, "Residual %": "55.9%" },
      { Provider: "Provider B", MY: 2026, Model: "SUV Y",    Trim: "XLE",  "Term (mo)": 39, Miles: 12000, "Residual %": "61.4%" },
      { Provider: "Provider B", MY: 2026, Model: "SUV Y",    Trim: "XLE",  "Term (mo)": 48, Miles: 15000, "Residual %": "52.7%" },
      { Provider: "Provider C", MY: 2026, Model: "Truck Z",  Trim: "King", "Term (mo)": 36, Miles: 12000, "Residual %": "67.1%" },
    ],
  },
  {
    id: "rental-pricing",
    title: "Competitor Rental Pricing Intelligence",
    customerProfile: "Top US car-rental + car-share operator",
    oneLiner: "Daily competitor rate intelligence across rental and car-share categories with corridor-level pricing recommendations.",
    icon: BadgeDollarSign,
    accent: "from-amber/40 to-danger/10",
    problem:
      "The customer needed daily visibility into competitor rental rates across 40+ metros, multiple pickup windows, length-of-rental and vehicle class — with the ability to feed a pricing optimizer. Manual rate-shopping took 3 FTEs and lagged the market by 48–72 hours.",
    solution: [
      "Built city-level rate shoppers across all major competitor brands (rental + car-share)",
      "Captured rate, fees, vehicle class, pickup/return windows and LoR variations",
      "Normalized to the customer's pricing schema with daily delta and corridor pricing index",
      "Fed the customer's pricing optimizer + alerted on >5% competitor moves within 30 min",
    ],
    metrics: [
      { value: "40+",   label: "Metro markets" },
      { value: "8",     label: "Competitor brands" },
      { value: "Daily", label: "Refresh cadence" },
      { value: "30min", label: "Move-detection SLA" },
    ],
    approach: [
      { phase: "Shop",      detail: "Per-metro shoppers hit each competitor across pickup windows + LoR" },
      { phase: "Normalize", detail: "Rate + fees + class → customer pricing schema" },
      { phase: "Index",     detail: "Build per-corridor pricing index vs customer's own rates" },
      { phase: "Alert",     detail: "Threshold-based alerts on competitor moves >5%" },
      { phase: "Deliver",   detail: "Push to pricing optimizer via API + daily exec brief" },
    ],
    outputColumns: ["Metro", "Class", "Competitor", "Daily Rate", "Weekly Rate", "Delta vs Yesterday"],
    sampleRows: [
      { Metro: "Los Angeles", Class: "Mid-size SUV", Competitor: "Brand A", "Daily Rate": "$78", "Weekly Rate": "$462", "Delta vs Yesterday": "+2.3%" },
      { Metro: "Los Angeles", Class: "Mid-size SUV", Competitor: "Brand B", "Daily Rate": "$74", "Weekly Rate": "$438", "Delta vs Yesterday": "-1.1%" },
      { Metro: "New York",    Class: "Economy",      Competitor: "Brand A", "Daily Rate": "$62", "Weekly Rate": "$378", "Delta vs Yesterday": "+0.8%" },
      { Metro: "Miami",       Class: "Full-size",    Competitor: "Brand C", "Daily Rate": "$88", "Weekly Rate": "$524", "Delta vs Yesterday": "+4.2%" },
      { Metro: "Chicago",     Class: "Premium",      Competitor: "Brand D", "Daily Rate": "$112","Weekly Rate": "$662", "Delta vs Yesterday": "-2.4%" },
    ],
    sourceUrl: "https://www.techmobius.com/case-studies/competitor-pricing-intelligence/",
  },
  {
    id: "auto-fitment",
    title: "Auto Fitment Data",
    customerProfile: "Global automotive parts marketplace",
    oneLiner: "Year-Make-Model-Engine-Trim fitment graphs across millions of parts SKUs.",
    icon: Cog,
    accent: "from-primary/30 to-cyan/10",
    problem:
      "Parts marketplaces need to tell a shopper exactly which parts fit their exact vehicle (Year / Make / Model / Engine / Trim / Drive). Source fitment data is scattered across manufacturer catalogs, ACES/PIES feeds, and aftermarket suppliers in inconsistent shapes.",
    solution: [
      "Built ingest pipelines for ACES/PIES + manufacturer catalog feeds",
      "Built a canonical YMME graph and mapped every SKU's fitment range onto it",
      "Captured installation notes, position (front/rear, left/right) and quantity needed",
      "Continuous diff against vehicle taxonomy updates (new MY launches, mid-cycle refreshes)",
    ],
    metrics: [
      { value: "8.2M",  label: "SKUs with fitment" },
      { value: "62k",   label: "YMME variants" },
      { value: "99.1%", label: "Fitment precision" },
      { value: "Weekly",label: "Refresh cadence" },
    ],
    approach: [
      { phase: "Ingest",    detail: "Pull ACES/PIES + manufacturer feeds + aftermarket suppliers" },
      { phase: "Canonicalize", detail: "Map onto a unified YMMET (Year/Make/Model/Engine/Trim) graph" },
      { phase: "Enrich",    detail: "Install notes, position, quantity, OEM cross-references" },
      { phase: "Deliver",   detail: "Push to marketplace catalog system + edge-cached lookup API" },
    ],
    outputColumns: ["SKU", "Part", "Year", "Make", "Model", "Engine", "Position"],
    sampleRows: [
      { SKU: "BR-PD-44219", Part: "Brake Pads",     Year: 2024, Make: "Honda",  Model: "Civic",   Engine: "2.0L L4", Position: "Front" },
      { SKU: "AF-71204",    Part: "Air Filter",     Year: 2023, Make: "Toyota", Model: "RAV4",    Engine: "2.5L L4", Position: "Engine" },
      { SKU: "SP-30182",    Part: "Spark Plug",     Year: 2025, Make: "Ford",   Model: "F-150",   Engine: "5.0L V8", Position: "Engine" },
      { SKU: "SH-18829",    Part: "Strut Assembly", Year: 2022, Make: "Subaru", Model: "Outback", Engine: "2.5L H4", Position: "Front Left" },
      { SKU: "OF-29914",    Part: "Oil Filter",     Year: 2024, Make: "BMW",    Model: "330i",    Engine: "2.0L L4", Position: "Engine" },
    ],
    placeholder: true,
  },
  {
    id: "components-market-research",
    title: "Components Market Research",
    customerProfile: "Global drivetrain & components manufacturer",
    oneLiner: "Continuous market research across competitor product launches, pricing, distribution and sentiment.",
    icon: Car,
    accent: "from-cyan/40 to-success/10",
    problem:
      "The customer's strategy team needed continuous research across competitor product launches, pricing changes, distribution shifts and end-user sentiment across cycling, marine and other component categories. Existing market research was point-in-time and out of date within a quarter.",
    solution: [
      "Continuous monitoring across competitor sites + retailer catalogs + review sites",
      "Launch-detection feed + price-change alerts + sentiment shifts",
      "Quarterly competitive battlecards auto-generated from the live feed",
      "Strategic insights routed to product + brand teams",
    ],
    metrics: [
      { value: "18",     label: "Competitor brands" },
      { value: "Daily",  label: "Refresh cadence" },
      { value: "1,200+", label: "Retailers monitored" },
      { value: "12",     label: "Battlecards / quarter" },
    ],
    approach: [
      { phase: "Monitor",  detail: "Competitor sites + retailer catalogs + review sites" },
      { phase: "Detect",   detail: "New launches, price moves, distribution shifts, sentiment swings" },
      { phase: "Analyze",  detail: "Auto-generated battlecards + strategic insight digests" },
      { phase: "Deliver",  detail: "Pushed to product + brand teams weekly + on-event" },
    ],
    outputColumns: ["Competitor", "Category", "SKU", "List Price", "Δ 30d", "Sentiment"],
    sampleRows: [
      { Competitor: "Brand A", Category: "Drivetrain", SKU: "DT-7200-S", "List Price": "$489", "Δ 30d": "+3.1%", Sentiment: "+0.42" },
      { Competitor: "Brand B", Category: "Drivetrain", SKU: "DT-6100-X", "List Price": "$329", "Δ 30d": "+0.0%", Sentiment: "+0.18" },
      { Competitor: "Brand C", Category: "Brakes",     SKU: "BR-204-DH", "List Price": "$224", "Δ 30d": "-2.4%", Sentiment: "+0.11" },
      { Competitor: "Brand A", Category: "Brakes",     SKU: "BR-505-M",  "List Price": "$268", "Δ 30d": "+1.5%", Sentiment: "+0.38" },
      { Competitor: "Brand D", Category: "Shifters",   SKU: "SH-9100",   "List Price": "$182", "Δ 30d": "-0.8%", Sentiment: "-0.05" },
    ],
    placeholder: true,
  },
];

export const getCapability = (id: string) => CAPABILITIES.find((c) => c.id === id);

import { Car, MapPin, BadgeDollarSign, Cog, Search, Bike, type LucideIcon } from "lucide-react";

import imgFleetPolygon from "@/assets/case-fleet-polygon.jpg";
import imgDealerVerification from "@/assets/case-dealer-verification.jpg";
import imgAutoFitment from "@/assets/case-auto-fitment.jpg";
import imgIncentivesRebates from "@/assets/case-incentives-rebates.jpg";
import imgRentalPricing from "@/assets/case-rental-pricing.jpg";
import imgBikeTrends from "@/assets/case-bike-trends.jpg";

export interface CapabilityMetric {
  value: string;
  label: string;
  sub?: string;
}

export interface CapabilityCase {
  id: string;
  title: string;
  customerProfile: string;
  industryTag?: string;
  oneLiner: string;
  icon: LucideIcon;
  accent: string;
  image: string;
  problem: string;
  solution: string[];
  metrics: CapabilityMetric[];
  approach: { phase: string; detail: string }[];
  outputColumns: string[];
  sampleRows: Record<string, string | number>[];
  sourceUrl?: string;
  placeholder?: boolean;
}

export const CAPABILITIES: CapabilityCase[] = [
  {
    id: "fleet-polygon",
    title: "Polygon Location Data for Fleet Management",
    customerProfile: "Top-3 global OEM · Mobility services division",
    industryTag: "Mobility · Fleet Ops",
    oneLiner: "Hyper-accurate polygon boundaries for ride-share and fleet ops across 200+ urban zones.",
    icon: MapPin,
    accent: "from-cyan/30 to-primary/10",
    image: imgFleetPolygon,
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
    title: "Independent Dealer Verification",
    customerProfile: "Leading US automotive marketplace · listing-quality team",
    industryTag: "Automotive Marketplace",
    oneLiner: "Continuous verification of independent dealer rooftops — phone, address, hours, brand, listing legitimacy.",
    icon: Search,
    accent: "from-amber/30 to-cyan/10",
    image: imgDealerVerification,
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
    id: "incentives-rebates",
    title: "OEM Incentives & Rebates Extraction",
    customerProfile: "Leading US automotive research & shopping marketplace",
    industryTag: "Automotive Research · Consumer Marketplace",
    oneLiner: "Zip-code level extraction of manufacturer incentives, rebates and special offers across every major OEM site.",
    icon: BadgeDollarSign,
    accent: "from-success/30 to-cyan/10",
    image: imgIncentivesRebates,
    problem:
      "The customer's consumer-facing offer surface required current OEM incentive and rebate data — APR specials, cash-back, lease deals, conquest and loyalty offers — at the zip-code level across every major manufacturer. OEM sites change layouts frequently, gate offers behind interactive zip-code inputs, and update programs mid-month, making manual collection slow and error-prone.",
    solution: [
      "Scrape Incentives & Rebate information from OEM websites by passing the zip codes provided by the customer",
      "Per-OEM crawler specs reviewed and signed off by the customer before production",
      "Sample-output validation gate before every full crawl is launched",
      "Internal PEG QA pass on every batch before delivery in the customer's required format",
    ],
    metrics: [
      { value: "30+",    label: "OEM brands covered" },
      { value: "41k",    label: "US zip codes / cycle" },
      { value: "98.4%",  label: "Field-level accuracy" },
      { value: "Daily",  label: "Refresh cadence" },
    ],
    approach: [
      { phase: "Input",          detail: "Customer sends manufacturers + zip codes as the cycle input" },
      { phase: "Manual Crawl",   detail: "New OEM: manual crawl for a few zips/models to map site complexity" },
      { phase: "Spec & Approve", detail: "Crawler spec + sample output file prepared and approved by client" },
      { phase: "Script & Run",   detail: "Build script, generate sample output, manual check, then full crawl" },
      { phase: "PEG QA",         detail: "Internal QC across Year / Make / Model / Zip / Offer fields" },
      { phase: "Deliver",        detail: "Output delivered in the client's required format on the agreed cadence" },
    ],
    outputColumns: ["Year", "Make", "Model", "Zipcode", "Offer Type", "Offer", "Offer Value", "Offer Ends On"],
    sampleRows: [
      { Year: 2026, Make: "Toyota",    Model: "RAV4 Hybrid", Zipcode: "90210", "Offer Type": "APR",       Offer: "1.9% APR for 60 mo",         "Offer Value": "1.9%",   "Offer Ends On": "2026-06-30" },
      { Year: 2026, Make: "Ford",      Model: "F-150",       Zipcode: "10001", "Offer Type": "Cash Back", Offer: "$2,500 Customer Cash",       "Offer Value": "$2,500", "Offer Ends On": "2026-06-30" },
      { Year: 2026, Make: "Honda",     Model: "Civic",       Zipcode: "60601", "Offer Type": "Lease",     Offer: "$259/mo · 36 mo · $2,599 due","Offer Value": "$259",  "Offer Ends On": "2026-07-07" },
      { Year: 2026, Make: "Chevrolet", Model: "Silverado",   Zipcode: "33101", "Offer Type": "Conquest",  Offer: "$1,000 Competitive Bonus",   "Offer Value": "$1,000", "Offer Ends On": "2026-06-30" },
      { Year: 2026, Make: "Hyundai",   Model: "Tucson",      Zipcode: "98101", "Offer Type": "Loyalty",   Offer: "$500 Loyalty Cash",          "Offer Value": "$500",   "Offer Ends On": "2026-07-31" },
    ],
  },
  {
    id: "rental-pricing",
    title: "Competitor Rental Pricing Intelligence",
    customerProfile: "Top US car-rental + car-share operator",
    industryTag: "Car Rental · Car-Share",
    oneLiner: "Daily competitor rate intelligence across rental and car-share categories with corridor-level pricing recommendations.",
    icon: BadgeDollarSign,
    accent: "from-amber/40 to-danger/10",
    image: imgRentalPricing,
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
    title: "Auto Fitment Service",
    customerProfile: "Global online marketplace · automotive parts category",
    industryTag: "Parts Marketplace · Motorcycles & Cars",
    oneLiner: "Mapping seller SKUs to the marketplace's master vehicle list — full Year-Make-Model-Submodel-Engine fitment rows per SKU.",
    icon: Cog,
    accent: "from-primary/30 to-cyan/10",
    image: imgAutoFitment,
    problem:
      "Marketplace sellers list ~100,000+ auto-parts SKUs without structured fitment data, so shoppers can't reliably search by their vehicle. The customer needed every SKU mapped against the marketplace's Master Vehicle List (MVL) — across motorcycles, cars and trucks for the US region — with consistent, machine-readable fitment rows per SKU.",
    solution: [
      "Ingest seller-supplied SKU data: ePID, Product Title, MPN / OEM Number, Product Page URL, Seller eBay Page Link",
      "Map each SKU to the marketplace MVL and generate full fitment rows per applicable vehicle",
      "Motorcycle output schema: ePID, Make, Model, Model_Submodel, Submodel, Year, Vehicle Type, Motorcycle Type",
      "Car/Truck output schema covering Aspiration, Body, Cylinder, Drive Type, Engine (Block / CC / CID / Cylinders / Liter Display), Fuel Type, KBB_MODEL, Make, Model, NumDoors, Parts Model, Submodel, Trim, Year, Region",
      "Deliver output in Excel using the template mutually agreed with the customer",
    ],
    metrics: [
      { value: "100k+", label: "Seller SKUs / batch" },
      { value: "50",    label: "Fitment rows / SKU (base)" },
      { value: "23",    label: "Car/Truck output fields" },
      { value: "8",     label: "Motorcycle output fields" },
    ],
    approach: [
      { phase: "Input",       detail: "Receive seller SKUs with ePID, Title, MPN/OEM, Product URL, Seller URL" },
      { phase: "Identify",    detail: "Resolve each part to OEM cross-reference + applicable vehicle scope" },
      { phase: "MVL Map",     detail: "Map every applicable vehicle into the marketplace's Master Vehicle List" },
      { phase: "Generate",    detail: "Emit one fitment row per (SKU × YMME variant) up to and beyond 50 rows" },
      { phase: "QC",          detail: "Internal QA on sampled SKUs before delivery" },
      { phase: "Deliver",     detail: "Excel in the mutually agreed template, on a weekly / bi-weekly / monthly cadence" },
    ],
    outputColumns: ["ePID", "Make", "Model", "Submodel", "Year", "Engine - Liter_Display", "Drive Type", "Body", "Region"],
    sampleRows: [
      { ePID: "10042118", Make: "Honda",     Model: "Civic",      Submodel: "EX",    Year: 2024, "Engine - Liter_Display": "2.0L L4", "Drive Type": "FWD", Body: "Sedan",   Region: "US" },
      { ePID: "10042118", Make: "Honda",     Model: "Civic",      Submodel: "Sport", Year: 2024, "Engine - Liter_Display": "1.5L L4", "Drive Type": "FWD", Body: "Sedan",   Region: "US" },
      { ePID: "10058921", Make: "Toyota",    Model: "RAV4",       Submodel: "XLE",   Year: 2023, "Engine - Liter_Display": "2.5L L4", "Drive Type": "AWD", Body: "SUV",     Region: "US" },
      { ePID: "10058921", Make: "Toyota",    Model: "RAV4 Hybrid",Submodel: "XSE",   Year: 2024, "Engine - Liter_Display": "2.5L L4", "Drive Type": "AWD", Body: "SUV",     Region: "US" },
      { ePID: "20071804", Make: "Harley-Davidson", Model: "Street Glide", Submodel: "Special", Year: 2023, "Engine - Liter_Display": "1.9L V2", "Drive Type": "RWD", Body: "Touring", Region: "US" },
    ],
  },
  {
    id: "components-market-research",
    title: "Bicycle Industry Trend & Sentiment Monitoring",
    customerProfile: "Global cycling components manufacturer · UK strategy team",
    industryTag: "Cycling Components · Consumer Insights",
    oneLiner: "Continuous insight on upcoming and current trends in the bicycle industry — preferences, geo sales signals, competitor activity and social sentiment.",
    icon: Bike,
    accent: "from-cyan/40 to-success/10",
    image: imgBikeTrends,
    problem:
      "The customer's strategy team needed a repeatable process for generating insights on upcoming and current trends in the bicycle industry, plus sources for customer preferences, sales-by-geography signals and competitor activity. Existing research was point-in-time and out of date within a quarter — and lacked any structured social-listening layer for hashtags like #gravelbike, #gravelgrinder and #cyclocross.",
    solution: [
      "Identified primary social platforms for UK cycling chatter — Facebook, Twitter/X, Instagram, YouTube, Vimeo, Pinterest, Tumblr, Reddit, Bloglovin, Google+",
      "Built hashtag-driven monitoring across #gravelbike, #gravelgrinder, #gravelrace, #cyclocross, refined by geography and date",
      "Used a combination of native search, advanced Google operators and 3rd-party aggregation tools (Socialmention, Hashtracking) for activity, reach and sentiment",
      "Quarterly competitive battlecards auto-generated from the live feed and routed to product + brand teams",
    ],
    metrics: [
      { value: "10",    label: "Social platforms monitored" },
      { value: "Daily", label: "Refresh cadence" },
      { value: "4",     label: "Core hashtag clusters" },
      { value: "40k",   label: "Avg. monthly reach / hashtag" },
    ],
    approach: [
      { phase: "Scope",     detail: "Define trend questions: preferences, geo, competitor, sentiment" },
      { phase: "Sources",   detail: "Map the UK social stack: FB, Twitter, IG, YT, Vimeo, Pinterest, Tumblr, Reddit, Bloglovin, G+" },
      { phase: "Hashtags",  detail: "Track #gravelbike, #gravelgrinder, #gravelrace, #cyclocross by geo + date" },
      { phase: "Aggregate", detail: "Combine native search + advanced Google + Socialmention + Hashtracking" },
      { phase: "Sentiment", detail: "Score positive / neutral / negative + extract top keywords and influencers" },
      { phase: "Deliver",   detail: "Quarterly battlecards + on-event alerts to product + brand teams" },
    ],
    outputColumns: ["Platform", "Hashtag", "Geography", "Mentions (30d)", "Reach", "Sentiment", "Top Influencer"],
    sampleRows: [
      { Platform: "Twitter/X",  Hashtag: "#gravelbike",    Geography: "United Kingdom", "Mentions (30d)": 62,    Reach: "40,000",  Sentiment: "+0.18", "Top Influencer": "@gravelbikecom" },
      { Platform: "Instagram",  Hashtag: "#gravelgrinder", Geography: "United Kingdom", "Mentions (30d)": 1480,  Reach: "212,000", Sentiment: "+0.34", "Top Influencer": "@immediatebikes" },
      { Platform: "Facebook",   Hashtag: "#cyclocross",    Geography: "United Kingdom", "Mentions (30d)": 942,   Reach: "188,400", Sentiment: "+0.21", "Top Influencer": "British Cycling" },
      { Platform: "YouTube",    Hashtag: "#gravelrace",    Geography: "United Kingdom", "Mentions (30d)": 84,    Reach: "96,200",  Sentiment: "+0.42", "Top Influencer": "GCN" },
      { Platform: "Reddit",     Hashtag: "#gravelbike",    Geography: "United Kingdom", "Mentions (30d)": 311,   Reach: "54,800",  Sentiment: "+0.11", "Top Influencer": "r/cycling" },
    ],
  },
];

export const getCapability = (id: string) => CAPABILITIES.find((c) => c.id === id);

import { type SolutionId } from "@/data/solutions";

interface SolutionDetailContent {
  kpis: { label: string; value: string; sub?: string }[];
  highlights: { title: string; body: string }[];
}

export const SOLUTION_DETAIL: Record<SolutionId, SolutionDetailContent> = {
  "oem-config": {
    kpis: [
      { label: "OEM configurators", value: "6", sub: "bespoke bots" },
      { label: "Option permutations", value: "82,000+" },
      { label: "Avg fields / config",  value: "47" },
      { label: "Pricing freshness",   value: "≤24h" },
    ],
    highlights: [
      { title: "Built per customer",  body: "Each configurator pipeline is hand-crafted to the customer's output template — option labels, package codes and pricing rules are mapped on day one." },
      { title: "Reference bots",      body: "BMW (BMW_Data_Collector.py) and Tesla (tesla_data_extractor.py) ship as live reference scripts. New OEMs are onboarded the same way." },
      { title: "Real session walk",   body: "We don't approximate — the bots walk the configurator like a buyer, click every package, capture inter-dependent option pricing, and emit the final priced config." },
    ],
  },
  "vehicle-spec": {
    kpis: [
      { label: "Brands tracked", value: "32", sub: "global" },
      { label: "Models",         value: "1,284" },
      { label: "Trims",          value: "4,917" },
      { label: "Daily delta",    value: "+18", sub: "new / updated" },
    ],
    highlights: [
      { title: "What you can do",     body: "Subscribe to a brand or model, watch for new trims, price changes, powertrain swaps and feature flag movement — fully normalized." },
      { title: "Two source types",    body: "Pulls both the HTML model spec page and the downloadable brochure PDF, normalizing both into a single record." },
      { title: "How it works",        body: "XDAS crawls brand sites and brochure PDFs, normalizes against a canonical schema, diffs vs the prior run, and emits an append-only change log." },
    ],
  },
  "ev-charging": {
    kpis: [
      { label: "Stations",      value: "62,401" },
      { label: "Networks",      value: "31" },
      { label: "DC fast share", value: "38%" },
      { label: "Coverage gaps", value: "147", sub: "flagged" },
    ],
    highlights: [
      { title: "What you get",        body: "Clean, geocoded station-level dataset (Mobius FLO schema) plus AI whitespace insights on where the next charger should go." },
      { title: "Insight engine",      body: "Detects coverage gaps along EV corridors, broken-charger clusters, pricing outliers and upcoming connection-date activations." },
      { title: "Refresh cadence",     body: "Daily incremental pulls per network, full refresh weekly. Availability fields are refreshed every 4h." },
    ],
  },
  "news": {
    kpis: [
      { label: "Stories / day",      value: "2,418" },
      { label: "Active clusters",    value: "184" },
      { label: "Open insights",      value: "12", sub: "high impact" },
      { label: "Sources",            value: "62" },
    ],
    highlights: [
      { title: "Predictive insights", body: "Every cluster is scored on Impact, Priority and Confidence with executive summary, revenue opportunity, financial impact and forward-looking actions." },
      { title: "Real-time triage",    body: "Continuous monitoring with 15-min cadence. AI deduplicates near-identical reporting across 60+ outlets and surfaces the canonical story." },
      { title: "Reviewable",          body: "Low-confidence clusters route to HITL before publishing — no insight ships without a human check when AI is unsure." },
    ],
  },
  "plants": {
    kpis: [
      { label: "Suppliers",     value: "8,014" },
      { label: "Plants",        value: "12,486" },
      { label: "Countries",     value: "94" },
      { label: "Geocode hit",   value: "98.2%" },
    ],
    highlights: [
      { title: "Reference dataset",  body: "Mapped against the global supplier universe — every plant geocoded with standardized region / country / state / city / admin levels." },
      { title: "Schema-ready",       body: "Output follows the published Mobius schema: Supplier Group, Supplier, URL, Lat / Lng, VP region/market/country fields." },
      { title: "How XDAS does it",   body: "Crawl corporate sites → extract plant entries → geocode (Google primary, OSM secondary) → normalize admin names per geography → human QA for ambiguous matches." },
    ],
  },
  "dealer-inventory": {
    kpis: [
      { label: "Dealers",         value: "18,932" },
      { label: "Units in stock",  value: "1.42M" },
      { label: "Avg days-on-lot", value: "41d" },
      { label: "Velocity index",  value: "2.0x", sub: "vs baseline" },
    ],
    highlights: [
      { title: "One dealer record",    body: "Unifies firmographics, OEM affiliations, geocode, current inventory snapshot and sell-through velocity per rooftop." },
      { title: "Pricing intelligence", body: "Tracks dealer-level pricing aggressiveness vs market and surfaces aging-inventory risk before margin damage." },
      { title: "Field-ready",          body: "Hand the field team a dealer-level brief: who they are, where they are, what they hold, how fast it moves, and what to do about it." },
    ],
  },
  "market": {
    kpis: [],
    highlights: [],
  },
};

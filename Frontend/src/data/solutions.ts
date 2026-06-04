import { Car, Zap, Newspaper, Factory, Store, Settings2, LucideIcon } from "lucide-react";

export type SolutionId = "oem-config" | "ev-charging" | "news" | "plants" | "dealer-inventory" | "vehicle-spec" | "market";
export type OutputType = "Data" | "Data + Insights";

export interface SourceBot {
  name: string;
  url: string;
  region?: string;
  /** Optional reference to the runtime bot script powering this source. */
  script?: string;
}

export interface SolutionDef {
  id: SolutionId;
  code: string;
  title: string;
  short: string;
  icon: LucideIcon;
  type: OutputType;
  problem: string;
  input: string;
  output: string;
  formats: string[];
  sampleColumns: string[];
  sampleRows: Record<string, string | number>[];
  sources: SourceBot[];
  hasInsights: boolean;
}

const oemConfig: SolutionDef = {
  id: "oem-config",
  code: "CFG",
  title: "OEM Configurator Data",
  short:
    "Bespoke car-configurator pipelines built per customer — walk the OEM build-and-price journey, capture every option, package and trim, and emit fully-priced configurations not available off-the-shelf.",
  icon: Settings2,
  type: "Data",
  problem:
    "OEM build-and-price configurators (BMW, Tesla, Mercedes, Audi, etc.) are session-driven and rebuild dynamically with every option click. There is no public dataset of all priced permutations — customers have to commission a bespoke scraper to walk the entire configurator tree and emit clean, priced configurations to their template.",
  input:
    "Customer-defined output schema, target OEMs, regions, and the option / package depth required. The platform ships with reference bots for BMW and Tesla; new OEMs are onboarded as a script per build.",
  output:
    "Per-configuration record: OEM, model, trim, every selected option / package, base price, options price, total price, FX, region. Delivered CSV / JSON in the customer's template.",
  formats: ["CSV", "JSON"],
  sampleColumns: ["OEM", "Model", "Trim", "Packages", "Options", "Base", "Options $", "Total"],
  sampleRows: [
    { OEM: "BMW",     Model: "iX1",     Trim: "xDrive30 M Sport", Packages: "Premium + Driving Asst Pro",          Options: "Heat-comfort pkg, 20\" alloys",     Base: "$49,900", "Options $": "$4,650", Total: "$54,550" },
    { OEM: "BMW",     Model: "i5",      Trim: "eDrive40",          Packages: "Executive + Premium",                  Options: "Bowers&Wilkins, Sky Lounge roof",   Base: "$66,800", "Options $": "$7,200", Total: "$74,000" },
    { OEM: "Tesla",   Model: "Model Y", Trim: "Long Range AWD",    Packages: "Enhanced Autopilot",                   Options: "Tow hitch, Black/White interior",   Base: "$48,990", "Options $": "$7,500", Total: "$56,490" },
    { OEM: "Tesla",   Model: "Model 3", Trim: "Performance",       Packages: "Full Self-Driving",                    Options: "Ultra Red paint, 20\" Überturbine", Base: "$52,990", "Options $": "$10,500", Total: "$63,490" },
    { OEM: "BMW",     Model: "X5",      Trim: "xDrive50e",         Packages: "Premium + Climate Comfort + Off-Road", Options: "Iconic Glow, Air suspension",       Base: "$73,800", "Options $": "$9,400", Total: "$83,200" },
    { OEM: "Tesla",   Model: "Model X", Trim: "Plaid",             Packages: "FSD + Premium Connectivity",           Options: "6-seat interior, Tow package",      Base: "$104,990", "Options $": "$13,500", Total: "$118,490" },
  ],
  sources: [
    { name: "BMW Configurator",   url: "bmwusa.com/build",   region: "NA", script: "BMW_Data_Collector.py" },
    { name: "Tesla Configurator", url: "tesla.com/models/design", region: "Global", script: "tesla_data_extractor.py" },
    { name: "Mercedes-Benz EQE",  url: "mbusa.com/build" },
    { name: "Audi USA",           url: "audiusa.com/configurator" },
    { name: "Porsche Car Config", url: "porsche.com/usa/modelstart" },
    { name: "Volvo Build",        url: "volvocars.com/us/build" },
  ],
  hasInsights: false,
};

const ev: SolutionDef = {
  id: "ev-charging",
  code: "EVI",
  title: "EV Charging Network Insights",
  short:
    "Geocoded view of every public charging station — network, charger type, power, pricing and availability — plus whitespace insights on where the next charger should go.",
  icon: Zap,
  type: "Data + Insights",
  problem:
    "Charging networks publish overlapping, inconsistent station data. Network planners need a clean, geocoded view of every station, its hardware, and its availability — and signals on where coverage gaps exist.",
  input:
    "Country / state / network filters. Optionally a list of charging networks (ChargePoint, EVgo, Ionity, Electrify America, Tesla Supercharger, etc.). Sample dataset attribute schema matches Mobius FLO EV Charging Station feed.",
  output:
    "Station-level dataset: name, address, geocode, network, charger type (J1772 / CCS / CHAdeMO / NACS), power (kW), pricing, availability and connection date. CSV / JSON / XLSX.",
  formats: ["CSV", "JSON", "XLSX"],
  sampleColumns: ["Station Name", "City", "State", "Network", "Type", "Power", "Pricing", "Availability"],
  sampleRows: [
    { "Station Name": "Montefiore Nyack Hospital", City: "Nyack",         State: "NY", Network: "—",            Type: "J1772",      Power: "6.24 kW", Pricing: "Free", Availability: "Available" },
    { "Station Name": "Whole Foods Market",        City: "Austin",        State: "TX", Network: "ChargePoint",   Type: "CCS",        Power: "62.5 kW", Pricing: "$0.31/kWh", Availability: "In Use" },
    { "Station Name": "Tesla Supercharger - Buellton", City: "Buellton",  State: "CA", Network: "Tesla",         Type: "NACS",       Power: "250 kW",  Pricing: "$0.36/kWh", Availability: "Available" },
    { "Station Name": "Electrify America - Walmart",  City: "Orlando",   State: "FL", Network: "Electrify America", Type: "CCS",    Power: "350 kW",  Pricing: "$0.43/kWh", Availability: "Available" },
    { "Station Name": "EVgo Boston Common",        City: "Boston",        State: "MA", Network: "EVgo",          Type: "CHAdeMO",    Power: "100 kW",  Pricing: "$0.39/kWh", Availability: "Out of Service" },
  ],
  sources: [
    { name: "ChargePoint",        url: "chargepoint.com" },
    { name: "EVgo",               url: "evgo.com" },
    { name: "Electrify America",  url: "electrifyamerica.com" },
    { name: "Tesla Supercharger", url: "tesla.com/findus" },
    { name: "Ionity (EU)",        url: "ionity.eu" },
    { name: "Shell Recharge",     url: "shellrecharge.com" },
  ],
  hasInsights: true,
};

const news: SolutionDef = {
  id: "news",
  code: "PRX",
  title: "Predictive Insights",
  short:
    "Cluster automotive newswire in real time and surface forward-looking AI insights — impact, priority and recommended actions for strategy and product teams.",
  icon: Newspaper,
  type: "Data + Insights",
  problem:
    "Automotive news breaks across thousands of sources in dozens of languages. Strategy, comms and product teams cannot manually triage, cluster and decide what matters.",
  input:
    "Topics, OEMs, keywords, regions, and competitor watchlists. Optional source allow/deny list. Schedule continuous monitoring or one-off pulls.",
  output:
    "Clustered stories with sentiment + impact score, plus AI-generated Strategic Insights (Executive summary, Revenue opportunity, Financial impact, recommended Immediate / Medium-term / Monitoring actions) and source article links.",
  formats: ["CSV", "JSON"],
  sampleColumns: ["Story", "Cluster", "Sources", "Sentiment", "Impact", "Updated"],
  sampleRows: [
    { Story: "BYD secures lithium offtake from Salar de Atacama through 2031", Cluster: "EV Supply", Sources: 14, Sentiment: "+0.34", Impact: 82, Updated: "3m ago" },
    { Story: "GM reopens Orion Township for next-gen Bolt EV — Q4 2026",        Cluster: "OEM Production", Sources: 9, Sentiment: "+0.42", Impact: 71, Updated: "12m ago" },
    { Story: "California ACC II enforcement letter to 6 OEMs",                   Cluster: "Regulatory",  Sources: 6, Sentiment: "-0.18", Impact: 88, Updated: "26m ago" },
    { Story: "Tesla cuts Model Y MSRP by $1,250 in EU5",                         Cluster: "Pricing",     Sources: 22, Sentiment: "+0.08", Impact: 76, Updated: "41m ago" },
  ],
  sources: [
    { name: "Reuters Autos",   url: "reuters.com/business/autos-transportation" },
    { name: "Automotive News", url: "autonews.com" },
    { name: "Electrek",        url: "electrek.co" },
    { name: "Bloomberg HT Mobility", url: "bloomberg.com/green/transportation" },
    { name: "Nikkei Asia Auto", url: "asia.nikkei.com/Business/Automobiles" },
    { name: "Custom RSS feeds", url: "user-configured" },
  ],
  hasInsights: true,
};

const plants: SolutionDef = {
  id: "plants",
  code: "POI",
  title: "Plant Operations Intelligence",
  short:
    "Geocoded manufacturing site intelligence across supplier / OEM company lists — classified by region, country, city and standardized administrative naming for global supply-chain teams.",
  icon: Factory,
  type: "Data",
  problem:
    "Global mobility and supply-chain teams need standardized, geocoded plant data across thousands of supplier companies. Source websites are inconsistent, plant pages are buried inside corporate sites, and administrative naming conventions (state / province / county / taluk) vary by geography — making the dataset unusable without heavy manual cleanup.",
  input:
    "A list of supplier / OEM companies with their corporate websites (reference benchmark: ~8,000 companies). Optionally a canonical entity URL per supplier for de-duplication.",
  output:
    "Per-plant records: Supplier Group, Supplier, Customer-provided Website, Canonical Entity URL, Location Name, Address, Region, Market, Country / Territory, City, Plant State / Province, Production Plant flag, Latitude, Longitude. Admin levels normalized per geography. Delivered as CSV / XLSX.",
  formats: ["CSV", "XLSX"],
  sampleColumns: ["Supplier", "Plant", "Country", "City", "State / Province", "Latitude", "Longitude"],
  sampleRows: [
    { Supplier: "Bosch",        Plant: "Bosch Bamberg",        Country: "Germany",   City: "Bamberg",   "State / Province": "Bavaria",  Latitude: 49.8988, Longitude: 10.9028 },
    { Supplier: "Denso",        Plant: "Denso Kariya HQ",      Country: "Japan",     City: "Kariya",    "State / Province": "Aichi",    Latitude: 34.9886, Longitude: 137.0021 },
    { Supplier: "ZF Friedrichshafen", Plant: "ZF Saarbrücken", Country: "Germany",   City: "Saarbrücken", "State / Province": "Saarland", Latitude: 49.2402, Longitude: 6.9969 },
    { Supplier: "Magna",        Plant: "Magna Graz",            Country: "Austria",   City: "Graz",      "State / Province": "Styria",   Latitude: 47.0707, Longitude: 15.4395 },
    { Supplier: "CATL",         Plant: "CATL Ningde",           Country: "China",     City: "Ningde",    "State / Province": "Fujian",   Latitude: 26.6656, Longitude: 119.5476 },
  ],
  sources: [
    { name: "Supplier company list (input)",  url: "user-uploaded" },
    { name: "Company corporate sites",        url: "~8,000 URLs" },
    { name: "Google Geocoding API",           url: "geocoding" },
    { name: "OSM Nominatim",                  url: "admin-boundaries" },
  ],
  hasInsights: false,
};

const dealer: SolutionDef = {
  id: "dealer-inventory",
  code: "DLR",
  title: "Dealer & Inventory Intelligence",
  short: "Per-dealer firmographics, location, inventory held and key sell-through insight — unified dealer + inventory view.",
  icon: Store,
  type: "Data + Insights",
  problem:
    "Inventory and dealer data live in separate silos. Field, network and pricing teams need a single dealer-level record showing who they are, where they are, what they hold, and how it is moving.",
  input:
    "Dealer rooftop list (OEM, name, address) and/or VIN-level inventory feeds. Optional sales velocity feed.",
  output:
    "Dealer record + held inventory snapshot: firmographics, geocode, OEM affiliations, # units in stock by segment, avg days-on-lot, sales velocity vs benchmark, pricing aggressiveness, key insight.",
  formats: ["CSV", "JSON"],
  sampleColumns: ["Dealer", "OEM", "City", "Inventory", "Avg DoL", "Velocity", "Insight"],
  sampleRows: [
    { Dealer: "AutoNation Houston", OEM: "Multi", City: "Houston, TX",  Inventory: 612, "Avg DoL": "31d", Velocity: "2.4x", Insight: "Overweight pickups — accelerating sell-through" },
    { Dealer: "Lithia Reno",        OEM: "Multi", City: "Reno, NV",     Inventory: 484, "Avg DoL": "38d", Velocity: "2.1x", Insight: "Pricing 0.4% below market — winning EV share" },
    { Dealer: "Sonic Charlotte",    OEM: "BMW",   City: "Charlotte, NC",Inventory: 391, "Avg DoL": "44d", Velocity: "1.9x", Insight: "X3 supply gap forming" },
    { Dealer: "Group 1 Boston",     OEM: "Toyota",City: "Boston, MA",   Inventory: 348, "Avg DoL": "49d", Velocity: "1.7x", Insight: "Hybrid demand outpacing inventory build" },
    { Dealer: "Penske Phoenix",     OEM: "Multi", City: "Phoenix, AZ",  Inventory: 522, "Avg DoL": "52d", Velocity: "1.6x", Insight: "Aging luxury inventory — pricing action needed" },
  ],
  sources: [
    { name: "OEM rooftop registry",      url: "user-uploaded" },
    { name: "Dealer inventory feed (VIN)",url: "scraped" },
    { name: "Sales velocity benchmark",   url: "internal" },
  ],
  hasInsights: true,
};

const veh: SolutionDef = {
  id: "vehicle-spec",
  code: "VEH",
  title: "Vehicle Specification Data",
  short:
    "Standardized spec sheets and brochure data published on each brand's public model pages — normalized into a single schema across every vehicle make and model.",
  icon: Car,
  type: "Data",
  problem:
    "Vehicle specs are scattered across hundreds of brand sites and downloadable brochures in inconsistent formats. Catalog, pricing and product teams spend weeks manually consolidating trim, powertrain, dimensions and feature data.",
  input:
    "A list of brand websites and/or model pages. Subscribe to a brand or specific models — bots discover trim variants automatically and pull both HTML spec pages and brochure PDFs.",
  output:
    "Normalized vehicle records: VIN/trim id, MSRP, powertrain, range, 0-60, dimensions, drivetrain, feature flags. Delivered as CSV or JSON, append-only with change-log per run.",
  formats: ["CSV", "JSON"],
  sampleColumns: ["Brand", "Model", "Trim", "MSRP", "Range / Engine", "0-60", "Drive"],
  sampleRows: [
    { Brand: "Tesla",   Model: "Model Y",    Trim: "LR AWD",       MSRP: "$48,990", "Range / Engine": "330 mi",  "0-60": "4.8s", Drive: "AWD" },
    { Brand: "Ford",    Model: "Mustang Mach-E", Trim: "Premium",   MSRP: "$45,995", "Range / Engine": "290 mi",  "0-60": "5.2s", Drive: "AWD" },
    { Brand: "BMW",     Model: "iX1",        Trim: "xDrive30",      MSRP: "$49,900", "Range / Engine": "270 mi",  "0-60": "5.4s", Drive: "AWD" },
    { Brand: "Hyundai", Model: "IONIQ 5",    Trim: "SEL AWD",       MSRP: "$49,500", "Range / Engine": "260 mi",  "0-60": "5.1s", Drive: "AWD" },
    { Brand: "Toyota",  Model: "RAV4 Hybrid",Trim: "XLE Premium",   MSRP: "$34,720", "Range / Engine": "2.5L HEV","0-60": "7.8s", Drive: "AWD" },
    { Brand: "VW",      Model: "ID.4",       Trim: "Pro S",         MSRP: "$45,495", "Range / Engine": "291 mi",  "0-60": "5.7s", Drive: "RWD" },
  ],
  sources: [
    { name: "Tesla",     url: "tesla.com",       region: "Global" },
    { name: "Ford",      url: "ford.com",        region: "NA" },
    { name: "BMW",       url: "bmwusa.com",      region: "NA/EU" },
    { name: "Toyota",    url: "toyota.com",      region: "Global" },
    { name: "Hyundai",   url: "hyundaiusa.com",  region: "NA" },
    { name: "Volkswagen",url: "vw.com",          region: "Global" },
    { name: "Stellantis",url: "stellantis.com",  region: "EU/NA" },
    { name: "BYD",       url: "byd.com",         region: "APAC" },
  ],
  hasInsights: false,
};

export const SOLUTIONS: SolutionDef[] = [oemConfig, ev, news, plants, dealer, veh];

export const getSolution = (id: string) => SOLUTIONS.find((s) => s.id === id);

// ---- News strategic insight sample (rich detail) ----
export interface NewsInsight {
  id: string;
  headline: string;
  cluster: string;
  impact: "High" | "Medium" | "Low";
  priority: "Immediate" | "Non-immediate";
  confidence: number;
  criticalImpact: string;
  executiveSummary: string;
  revenueOpportunity: string;
  financialImpact: string;
  immediateActions: string[];
  mediumTermActions: string[];
  monitoring: string[];
  sources: { title: string; outlet: string; url: string }[];
}

export const NEWS_INSIGHTS: NewsInsight[] = [
  {
    id: "ni-1",
    headline: "BYD secures multi-year lithium offtake from Salar de Atacama through 2031",
    cluster: "EV Supply Chain",
    impact: "High",
    priority: "Immediate",
    confidence: 86,
    criticalImpact:
      "Locks ~18% of currently uncommitted high-purity carbonate supply, materially tightening 2026–2028 market for non-Chinese OEMs and cell makers.",
    executiveSummary:
      "BYD's 7-year offtake removes a swing supplier from spot markets, pressuring battery cell economics for Western OEMs and accelerating vertical-integration moves at Tier-1 cell partners.",
    revenueOpportunity:
      "$220–340M / yr for cathode and refining partners that can backfill displaced spot demand in EU/NA. Premium pricing of $1.4–2.2k/t expected over 6–9 months.",
    financialImpact:
      "Estimated +6–11% input cost exposure for Western pack programs not already hedged. ~$3.1B aggregate impact across monitored OEM watchlist over 24 months.",
    immediateActions: [
      "Audit lithium hedge coverage across active programs",
      "Convene supply review with Tier-1 cell partners within 14 days",
      "Brief CFO + procurement leadership on cost pass-through scenarios",
    ],
    mediumTermActions: [
      "Open commercial dialogue with two named alternative South American producers",
      "Model 2026/2027 pack cost under tightened carbonate scenarios",
      "Evaluate co-investment in refining capacity in NA / EU",
    ],
    monitoring: [
      "Quarterly tracking of Chilean export quotas",
      "Watchlist updates on competing offtake announcements",
      "Pricing telemetry on Asia–EU carbonate corridor",
    ],
    sources: [
      { title: "BYD signs Atacama lithium pact",          outlet: "Reuters",          url: "https://www.reuters.com" },
      { title: "What BYD's lithium deal means for the West", outlet: "Bloomberg",      url: "https://www.bloomberg.com" },
      { title: "Atacama producers and the global Li market", outlet: "Automotive News",url: "https://www.autonews.com" },
    ],
  },
  {
    id: "ni-2",
    headline: "California ACC II enforcement letter targets 6 OEMs over reporting gaps",
    cluster: "Regulatory",
    impact: "High",
    priority: "Immediate",
    confidence: 92,
    criticalImpact:
      "CARB signals stepped-up enforcement of ACC II reporting. Non-compliant OEMs face credit-bank penalties and market access risk in 17 ZEV-aligned states.",
    executiveSummary:
      "Six OEMs have 30 days to respond. Pattern suggests CARB will pursue formal Notices of Violation by Q2, with financial penalties tied to under-reported ZEV credit obligations.",
    revenueOpportunity:
      "Compliance advisory and credit-trading desks see $40–60M near-term opportunity supporting affected OEMs and credit buyers.",
    financialImpact:
      "Potential penalties $12–48M per affected OEM; secondary impact on credit prices estimated at +9–14%.",
    immediateActions: [
      "Confirm whether any watchlist OEM appears in the enforcement list",
      "Pull current ZEV credit position across CARB-aligned states",
      "Prepare regulatory talking points for executive team",
    ],
    mediumTermActions: [
      "Stand up an ACC II reporting working group",
      "Re-baseline ZEV credit forecast through 2027",
    ],
    monitoring: [
      "Track CARB filings weekly",
      "Watch for NOV issuance in Q2",
    ],
    sources: [
      { title: "CARB letter targets 6 automakers",     outlet: "Reuters",          url: "https://www.reuters.com" },
      { title: "ACC II enforcement signals tighter regime", outlet: "Automotive News", url: "https://www.autonews.com" },
    ],
  },
];

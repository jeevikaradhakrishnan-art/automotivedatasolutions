import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { SolutionId } from "@/data/solutions";

export interface Dataset {
  id: string;
  solutionId: SolutionId;
  name: string;
  uploadedAt: string;
  rows: number;
  columns: string[];
  data: Record<string, string | number>[];
}

export type JobStatus = "queued" | "running" | "review" | "success" | "failed";

export interface JobStep {
  name: string;
  status: "ok" | "running" | "fail" | "pending";
  ts: string;
  note?: string;
}

export interface Job {
  id: string;
  solutionId: SolutionId;
  source: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  runtimeMs?: number;
  rowsProduced?: number;
  format: "CSV" | "JSON" | "XLSX";
  workflow?: string;
  steps?: JobStep[];
  mode?: "full" | "delta";
  deltaSummary?: { added: number; updated: number; removed: number };
  reviewTotal?: number;
  reviewApproved?: number;
  reviewRejected?: number;
}

export type HitlStatus = "pending" | "approved" | "rejected" | "skipped";
export interface HitlField { group?: string; name: string; value: string; confidence: number }
export interface HitlItem {
  id: string;
  solutionId: SolutionId;
  jobId?: string;
  workflow?: string;
  recordName?: string;
  summary: string;
  detail: string;
  field?: string;
  proposed?: string;
  current?: string;
  fields?: HitlField[];
  confidence: number;
  status: HitlStatus;
  createdAt: string;
  reviewer?: string;
  previewKind?: "html" | "pdf";
}

export interface Feedback {
  id: string;
  solutionId: SolutionId;
  workflow?: string;
  jobId?: string;
  rating: "up" | "down";
  message: string;
  createdAt: string;
}

export interface IntegrationLink {
  id: string;
  integrationId: string;
  solutionId: SolutionId;
  workflowId?: string;
  target?: string; // e.g., "MOBILITY.VEHICLE_SPEC"
  createdAt: string;
}

interface PlatformState {
  subscriptions: SolutionId[];
  datasets: Dataset[];
  jobs: Job[];
  hitl: HitlItem[];
  feedback: Feedback[];
  integrationLinks: IntegrationLink[];
  toggleSubscription: (id: SolutionId) => void;
  addDataset: (d: Dataset) => void;
  removeDataset: (id: string) => void;
  addJob: (j: Job) => void;
  updateJob: (id: string, patch: Partial<Job>) => void;
  resolveHitl: (id: string, status: HitlStatus) => void;
  addHitl: (h: HitlItem) => void;
  addFeedback: (f: Feedback) => void;
  addIntegrationLink: (l: IntegrationLink) => void;
  removeIntegrationLink: (id: string) => void;
  completeJobReview: (jobId: string) => void;
}

const VEHICLE_FIELDS = (oem: string, model: string, trim: string, msrp: string): HitlField[] => [
  { group: "vehicle", name: "oem", value: oem, confidence: 100 },
  { group: "vehicle", name: "model", value: model, confidence: 100 },
  { group: "vehicle", name: "trim", value: trim, confidence: 96 },
  { group: "vehicle", name: "msrp", value: msrp, confidence: 92 },
  { group: "powertrain", name: "drivetrain", value: "AWD", confidence: 100 },
  { group: "powertrain", name: "battery_kwh", value: "75", confidence: 78 },
  { group: "powertrain", name: "range_mi", value: "290", confidence: 84 },
  { group: "powertrain", name: "zero_to_sixty_s", value: "4.8", confidence: 88 },
  { group: "dimensions", name: "length_in", value: "187.0", confidence: 100 },
  { group: "dimensions", name: "wheelbase_in", value: "113.8", confidence: 100 },
];
const PLANT_FIELDS = (name: string): HitlField[] => [
  { group: "plant_information", name: "plant_name", value: name, confidence: 100 },
  { group: "plant_information", name: "supplier_group", value: "ZF Friedrichshafen AG", confidence: 68 },
  { group: "plant_information", name: "address_line1", value: "1 Industriestrasse", confidence: 100 },
  { group: "plant_information", name: "city", value: "Friedrichshafen", confidence: 100 },
  { group: "plant_information", name: "country", value: "Germany", confidence: 100 },
  { group: "plant_information", name: "site_type", value: "Manufacturing", confidence: 92 },
  { group: "geo", name: "latitude", value: "47.6541", confidence: 81 },
  { group: "geo", name: "longitude", value: "9.4779", confidence: 81 },
  { group: "operations", name: "headcount", value: "2,400", confidence: 70 },
  { group: "operations", name: "annual_capacity", value: "1.2M units", confidence: 64 },
];
const NEWS_FIELDS: HitlField[] = [
  { group: "article", name: "headline", value: "BYD secures lithium supply deal in Atacama", confidence: 100 },
  { group: "article", name: "publisher", value: "Reuters Autos", confidence: 100 },
  { group: "article", name: "published_at", value: "2025-05-21T08:14Z", confidence: 100 },
  { group: "classification", name: "cluster", value: "EV Supply Chain", confidence: 81 },
  { group: "classification", name: "sentiment", value: "Positive", confidence: 86 },
  { group: "classification", name: "impact", value: "High", confidence: 78 },
  { group: "entities", name: "primary_oem", value: "BYD", confidence: 100 },
  { group: "entities", name: "region", value: "South America", confidence: 95 },
];
// ---- Seeded jobs (a couple already reviewed, one pending review with HITL batch) ----

const TS_3H_AGO = Date.now() - 1000 * 60 * 60 * 3;
const TS_25M_AGO = Date.now() - 1000 * 60 * 25;
const TS_6H_AGO = Date.now() - 1000 * 60 * 60 * 6;
const TS_18M_AGO = Date.now() - 1000 * 60 * 18;

const seedJobs = (): Job[] => [
  { id: "j-evgo-001", solutionId: "ev-charging", source: "EVgo", status: "success", workflow: "EV Stations · Daily Pull", mode: "delta", deltaSummary: { added: 146, updated: 22, removed: 0 }, startedAt: new Date(TS_3H_AGO).toISOString(), finishedAt: new Date(TS_3H_AGO + 62_000).toISOString(), runtimeMs: 62_000, rowsProduced: 168, reviewTotal: 6, reviewApproved: 6, reviewRejected: 0, format: "CSV", steps: [
    { name: "Aggregate · source crawl",  status: "ok", ts: "T+00:02", note: "1,842 raw records fetched" },
    { name: "Transform · normalize",     status: "ok", ts: "T+00:14", note: "Mapped to Mobius FLO schema" },
    { name: "Enrich · geocode",          status: "ok", ts: "T+00:31", note: "OSM Nominatim · 100% hit" },
    { name: "Delta · diff vs last run",  status: "ok", ts: "T+00:42", note: "146 new · 22 updated · 0 removed" },
    { name: "QA · confidence scoring",   status: "ok", ts: "T+00:51", note: "Confidence avg 94%" },
    { name: "Deliver · persist + notify",status: "ok", ts: "T+01:02" },
  ] },
  { id: "j-veh-101", solutionId: "vehicle-spec", source: "Ford · ford.com", status: "review", workflow: "OEM Catalog · Weekly Crawl", mode: "delta", startedAt: new Date(TS_18M_AGO).toISOString(), finishedAt: new Date(TS_18M_AGO + 91_000).toISOString(), runtimeMs: 91_000, rowsProduced: 118, reviewTotal: 4, reviewApproved: 0, reviewRejected: 0, format: "CSV", steps: [
    { name: "Aggregate · configurator crawl", status: "ok", ts: "T+00:04" },
    { name: "Transform · trim normalize",     status: "ok", ts: "T+00:22" },
    { name: "Enrich · MSRP + incentives",     status: "ok", ts: "T+00:48" },
    { name: "QA · awaiting human review",     status: "running", ts: "T+01:31" },
  ] },
  { id: "j-veh-102", solutionId: "vehicle-spec", source: "BMW · bmwusa.com", status: "review", workflow: "OEM Catalog · Weekly Crawl", mode: "delta", startedAt: new Date(TS_18M_AGO + 1000).toISOString(), finishedAt: new Date(TS_18M_AGO + 88_000).toISOString(), runtimeMs: 87_000, rowsProduced: 64, reviewTotal: 3, reviewApproved: 0, reviewRejected: 0, format: "CSV", steps: [
    { name: "Aggregate · configurator crawl", status: "ok", ts: "T+00:03" },
    { name: "Transform · trim normalize",     status: "ok", ts: "T+00:18" },
    { name: "Enrich · MSRP + incentives",     status: "ok", ts: "T+00:41" },
    { name: "QA · awaiting human review",     status: "running", ts: "T+01:27" },
  ] },
  { id: "j-news-014", solutionId: "news", source: "Reuters Autos", status: "review", workflow: "News · Continuous", mode: "delta", startedAt: new Date(TS_25M_AGO).toISOString(), finishedAt: new Date(TS_25M_AGO + 18_000).toISOString(), runtimeMs: 18_000, rowsProduced: 38, reviewTotal: 3, reviewApproved: 0, reviewRejected: 0, format: "JSON", steps: [
    { name: "Aggregate · RSS pull",      status: "ok", ts: "T+00:01" },
    { name: "Transform · language",      status: "ok", ts: "T+00:03" },
    { name: "Enrich · cluster",          status: "ok", ts: "T+00:08", note: "12 clusters" },
    { name: "Enrich · insight gen",      status: "ok", ts: "T+00:14" },
    { name: "QA · awaiting human review",status: "running", ts: "T+00:18" },
  ] },
  { id: "j-plant-007", solutionId: "plants", source: "Supplier list (8,014)", status: "review", workflow: "Plants · Full Refresh", mode: "full", startedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), finishedAt: new Date(Date.now() - 1000 * 60 * 11).toISOString(), runtimeMs: 34 * 60_000, rowsProduced: 412, reviewTotal: 5, reviewApproved: 0, reviewRejected: 0, format: "XLSX", steps: [
    { name: "Aggregate · load input",    status: "ok", ts: "T+00:00", note: "8,014 companies" },
    { name: "Aggregate · site crawl",    status: "ok", ts: "T+12:14" },
    { name: "Enrich · geocode",          status: "ok", ts: "T+21:48" },
    { name: "Transform · admin map",     status: "ok", ts: "T+29:10" },
    { name: "QA · awaiting human review",status: "running", ts: "T+34:02" },
  ] },
  { id: "j-dlr-002", solutionId: "dealer-inventory", source: "OEM rooftop registry", status: "failed", workflow: "Dealer · Weekly Snapshot", mode: "delta", startedAt: new Date(TS_6H_AGO).toISOString(), finishedAt: new Date(TS_6H_AGO + 11_000).toISOString(), runtimeMs: 11_000, format: "CSV", steps: [
    { name: "Aggregate · pull rooftops", status: "ok",   ts: "T+00:02" },
    { name: "Aggregate · inventory feed",status: "fail", ts: "T+00:11", note: "Auth 401 from VIN feed — credentials expired" },
  ] },
];

const seedHitl = (): HitlItem[] => {
  const items: HitlItem[] = [];
  // Vehicle Ford batch (4 records)
  const fordModels = [
    { model: "Mustang Mach-E", trim: "Rally GT Performance", msrp: "$64,995" },
    { model: "F-150 Lightning", trim: "Platinum",            msrp: "$84,995" },
    { model: "Explorer",        trim: "ST-Line",             msrp: "$48,795" },
    { model: "Bronco Sport",    trim: "Badlands",            msrp: "$36,890" },
  ];
  fordModels.forEach((m, i) => items.push({
    id: `h-veh-ford-${i}`, solutionId: "vehicle-spec", jobId: "j-veh-101", workflow: "OEM Catalog · Weekly Crawl",
    recordName: `${m.model} · ${m.trim}`,
    summary: `${m.model} ${m.trim}`,
    detail: `New trim discovered on Ford configurator. Verify MSRP and powertrain mapping against customer template.`,
    field: "trim/msrp", proposed: m.trim, current: "—",
    fields: VEHICLE_FIELDS("Ford", m.model, m.trim, m.msrp),
    confidence: 78 - i * 3, status: "pending", createdAt: new Date(TS_18M_AGO + i * 1000).toISOString(), previewKind: i % 2 === 0 ? "pdf" : "html",
  }));
  // Vehicle BMW batch (3 records)
  const bmwModels = [
    { model: "iX1", trim: "xDrive30 M Sport", msrp: "$52,900" },
    { model: "i5",  trim: "eDrive40",         msrp: "$66,800" },
    { model: "X5",  trim: "xDrive50e",        msrp: "$73,800" },
  ];
  bmwModels.forEach((m, i) => items.push({
    id: `h-veh-bmw-${i}`, solutionId: "vehicle-spec", jobId: "j-veh-102", workflow: "OEM Catalog · Weekly Crawl",
    recordName: `${m.model} · ${m.trim}`,
    summary: `${m.model} ${m.trim}`,
    detail: `Confidence below threshold on battery_kwh field — verify before shipping to customer template.`,
    field: "battery_kwh", proposed: "82 kWh", current: "—",
    fields: VEHICLE_FIELDS("BMW", m.model, m.trim, m.msrp),
    confidence: 74 - i * 4, status: "pending", createdAt: new Date(TS_18M_AGO + 5000 + i * 1000).toISOString(), previewKind: i === 1 ? "pdf" : "html",
  }));
  // News batch (3 articles)
  ["BYD secures lithium supply deal in Atacama", "Toyota patent splits V2G / V2X classification", "GM Cruise restarts limited autonomy pilot"].forEach((h, i) => items.push({
    id: `h-news-${i}`, solutionId: "news", jobId: "j-news-014", workflow: "News · Continuous",
    recordName: h, summary: h, detail: "Verify clustering, sentiment and impact classification before shipping insight.",
    field: "cluster", proposed: "EV Supply Chain", current: "Lithium",
    fields: NEWS_FIELDS,
    confidence: 81 - i * 5, status: "pending", createdAt: new Date(TS_25M_AGO + i * 1000).toISOString(), previewKind: "html",
  }));
  // Plants batch (5 records)
  ["ZF Friedrichshafen Plant 1", "ZF Saarbrücken", "ZF Schweinfurt", "ZF Lebanon TN", "ZF Pune"].forEach((n, i) => items.push({
    id: `h-plant-${i}`, solutionId: "plants", jobId: "j-plant-007", workflow: "Plants · Full Refresh",
    recordName: n, summary: n, detail: "Verify supplier-group normalization and geocoding accuracy.",
    field: "supplier_group", proposed: "ZF Friedrichshafen AG", current: "ZF Group",
    fields: PLANT_FIELDS(n),
    confidence: 70 - i * 2, status: "pending", createdAt: new Date(Date.now() - 1000 * 60 * (15 + i)).toISOString(), previewKind: "pdf",
  }));
  return items;
};

export const usePlatform = create<PlatformState>()(
  persist(
    (set, get) => ({
      subscriptions: ["ev-charging", "news"],
      datasets: [],
      jobs: seedJobs(),
      hitl: seedHitl(),
      feedback: [],
      integrationLinks: [
        { id: "il-1", integrationId: "snowflake", solutionId: "ev-charging", workflowId: "w-ev-1", target: "MOBILITY.EV_STATIONS", createdAt: new Date().toISOString() },
        { id: "il-2", integrationId: "s3",        solutionId: "news",        workflowId: "w-news-1", target: "s3://xdas-news/daily/", createdAt: new Date().toISOString() },
      ],
      toggleSubscription: (id) =>
        set((s) => ({
          subscriptions: s.subscriptions.includes(id)
            ? s.subscriptions.filter((x) => x !== id)
            : [...s.subscriptions, id],
        })),
      addDataset: (d) => set((s) => ({ datasets: [d, ...s.datasets] })),
      removeDataset: (id) => set((s) => ({ datasets: s.datasets.filter((d) => d.id !== id) })),
      addJob: (j) => set((s) => ({ jobs: [j, ...s.jobs] })),
      updateJob: (id, patch) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),
      addHitl: (h) => set((s) => ({ hitl: [h, ...s.hitl] })),
      resolveHitl: (id, status) => {
        set((s) => ({ hitl: s.hitl.map((h) => (h.id === id ? { ...h, status, reviewer: "E. Mercer" } : h)) }));
        // Update job counters
        const item = get().hitl.find((h) => h.id === id);
        if (item?.jobId) {
          const items = get().hitl.filter((h) => h.jobId === item.jobId);
          const approved = items.filter((h) => h.status === "approved").length;
          const rejected = items.filter((h) => h.status === "rejected").length;
          set((s) => ({ jobs: s.jobs.map((j) => j.id === item.jobId ? { ...j, reviewApproved: approved, reviewRejected: rejected } : j) }));
        }
      },
      addFeedback: (f) => set((s) => ({ feedback: [f, ...s.feedback] })),
      addIntegrationLink: (l) => set((s) => ({ integrationLinks: [l, ...s.integrationLinks] })),
      removeIntegrationLink: (id) => set((s) => ({ integrationLinks: s.integrationLinks.filter((l) => l.id !== id) })),
      completeJobReview: (jobId) => {
        const items = get().hitl.filter((h) => h.jobId === jobId);
        const approved = items.filter((h) => h.status === "approved").length;
        const rejected = items.filter((h) => h.status === "rejected").length;
        const pending = items.filter((h) => h.status === "pending").length;
        // Auto-approve remaining pending? No — require explicit. Allow complete when none pending.
        if (pending > 0) return;
        set((s) => ({
          jobs: s.jobs.map((j) => j.id === jobId ? {
            ...j,
            status: approved > 0 ? "success" : "failed",
            reviewApproved: approved,
            reviewRejected: rejected,
          } : j),
        }));
      },
    }),
    {
      name: "xdas-platform-v4",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : (undefined as unknown as Storage),
      ),
    },
  ),
);



// ============ Workflows (per-solution, configurable presets) ============
export type StageKind = "aggregate" | "transform" | "enrich" | "delta" | "qa" | "deliver";

export interface WorkflowStage {
  kind: StageKind;
  name: string;
  detail: string;
}

export type ParamType = "text" | "select" | "multiselect" | "toggle" | "number";
export interface WorkflowParam {
  key: string;
  label: string;
  type: ParamType;
  default: string | number | boolean | string[];
  options?: string[];
  help?: string;
}

export interface Workflow {
  id: string;
  solutionId: SolutionId;
  name: string;
  description: string;
  schedule: string;
  sources: number;
  lastRun: string;
  nextRun: string;
  status: "active" | "paused";
  successRate: number;
  deltaCapable: boolean;
  stages: WorkflowStage[];
  params: WorkflowParam[];
}

const STAGE = {
  aggregate: (name: string, detail = ""): WorkflowStage => ({ kind: "aggregate", name, detail }),
  transform: (name: string, detail = ""): WorkflowStage => ({ kind: "transform", name, detail }),
  enrich:    (name: string, detail = ""): WorkflowStage => ({ kind: "enrich",    name, detail }),
  delta:     (detail = "Compare with last run · only changes"): WorkflowStage => ({ kind: "delta", name: "Delta diff", detail }),
  qa:        (detail = "Confidence scoring · HITL gate"): WorkflowStage => ({ kind: "qa", name: "QA gate", detail }),
  deliver:   (detail = "Persist · webhook · integration push"): WorkflowStage => ({ kind: "deliver", name: "Deliver", detail }),
};

export const WORKFLOWS: Workflow[] = [
  // OEM Configurator
  {
    id: "w-cfg-1", solutionId: "oem-config", name: "BMW + Tesla Configurator Walk",
    description: "Walk the BMW and Tesla build-and-price journeys, capture every priced option/package permutation, and emit configurations to the customer template.",
    schedule: "Daily · 03:00 UTC", sources: 2, lastRun: "4h ago", nextRun: "in 20h", status: "active", successRate: 96, deltaCapable: true,
    stages: [
      STAGE.aggregate("Configurator session walk", "BMW_Data_Collector.py + tesla_data_extractor.py"),
      STAGE.transform("Option / package normalize", "Map raw codes → customer schema"),
      STAGE.enrich("Pricing rollup + FX", "Base + options + destination, locale FX"),
      STAGE.delta("Only new + reprice events"),
      STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "oems", label: "Configurators", type: "multiselect", default: ["BMW","Tesla"], options: ["BMW","Tesla","Mercedes-Benz","Audi","Porsche","Volvo"] },
      { key: "frequency", label: "Refresh frequency", type: "select", default: "Daily", options: ["On-demand","Hourly","Daily","Weekly","Monthly"] },
      { key: "datapoints", label: "Data points", type: "multiselect", default: ["Trim","Packages","Options","Pricing"], options: ["Trim","Packages","Options","Pricing","Colors","Wheels","Interior","Delivery dates"] },
      { key: "region", label: "Region", type: "select", default: "NA", options: ["NA","EU","APAC","Global"] },
      { key: "template", label: "Output template", type: "select", default: "Customer · Configurator v1", options: ["Customer · Configurator v1","Raw passthrough"] },
      { key: "delta", label: "Delta only", type: "toggle", default: true },
    ],
  },
  {
    id: "w-cfg-2", solutionId: "oem-config", name: "Pricing Delta · Hourly Sweep",
    description: "Targeted hourly sweep of priced options and incentives across BMW & Tesla — fires alerts on >2% MSRP shifts.",
    schedule: "Hourly", sources: 2, lastRun: "12m ago", nextRun: "in 48m", status: "active", successRate: 98, deltaCapable: true,
    stages: [
      STAGE.aggregate("Price endpoint sweep", "Trim × options matrix only"),
      STAGE.transform("Normalize option codes"),
      STAGE.delta("MSRP / incentive moves only"),
      STAGE.qa("Auto-flag >2% moves"), STAGE.deliver(),
    ],
    params: [
      { key: "oems", label: "Configurators", type: "multiselect", default: ["BMW","Tesla"], options: ["BMW","Tesla","Mercedes-Benz","Audi","Porsche","Volvo"] },
      { key: "threshold", label: "Alert threshold (%)", type: "number", default: 2 },
      { key: "frequency", label: "Refresh frequency", type: "select", default: "Hourly", options: ["15m","30m","Hourly","Daily"] },
    ],
  },
  {
    id: "w-cfg-3", solutionId: "oem-config", name: "New Model Year · Launch Watch",
    description: "Detect newly published model years and trims across configurator catalogs the moment they go live.",
    schedule: "Daily · 05:00 UTC", sources: 2, lastRun: "8h ago", nextRun: "in 16h", status: "paused", successRate: 92, deltaCapable: true,
    stages: [
      STAGE.aggregate("Catalog index crawl"),
      STAGE.transform("MY / trim hierarchy diff"),
      STAGE.delta("New nodes only"),
      STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "oems", label: "Configurators", type: "multiselect", default: ["BMW","Tesla"], options: ["BMW","Tesla","Mercedes-Benz","Audi","Porsche","Volvo"] },
      { key: "region", label: "Region", type: "select", default: "NA", options: ["NA","EU","APAC","Global"] },
    ],
  },
  {
    id: "w-veh-1", solutionId: "vehicle-spec", name: "OEM Catalog · Weekly Crawl",
    description: "Crawl OEM brand sites, normalize to customer trim template, detect new trims & price changes.",
    schedule: "Every Mon · 02:00 UTC", sources: 8, lastRun: "2d ago", nextRun: "in 4d", status: "active", successRate: 98, deltaCapable: true,
    stages: [
      STAGE.aggregate("Multi-source crawl", "8 OEM brand sites in parallel"),
      STAGE.transform("Normalize to customer trim template", "Map raw spec fields → unified schema"),
      STAGE.enrich("Pricing + incentives lookup", "Cross-reference MSRP with regional incentive feed"),
      STAGE.delta("Only new + changed trims since last run"),
      STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "oems", label: "OEM watchlist", type: "multiselect", default: ["Tesla","Ford","BMW","Toyota"], options: ["Tesla","Ford","BMW","Toyota","Hyundai","Volkswagen","Stellantis","BYD"] },
      { key: "region", label: "Region", type: "select", default: "NA", options: ["NA","EU","APAC","Global"] },
      { key: "template", label: "Output template", type: "select", default: "Customer · Unified Trim v2", options: ["Customer · Unified Trim v2","Mobius FLO","Raw passthrough"] },
      { key: "delta", label: "Delta only", type: "toggle", default: true, help: "Skip full re-scrape; ship only changes" },
    ],
  },
  {
    id: "w-veh-2", solutionId: "vehicle-spec", name: "New Model Detection · Daily",
    description: "Lightweight daily sweep for newly listed models or trims across the watchlist.",
    schedule: "Daily · 04:00 UTC", sources: 8, lastRun: "5h ago", nextRun: "in 19h", status: "active", successRate: 94, deltaCapable: true,
    stages: [
      STAGE.aggregate("Configurator page diff", "Crawl model index pages"),
      STAGE.transform("Extract trim hierarchy", "Detect newly listed nodes"),
      STAGE.delta("New + removed trims only"),
      STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "oems", label: "OEM watchlist", type: "multiselect", default: ["Tesla","Ford"], options: ["Tesla","Ford","BMW","Toyota","Hyundai","Volkswagen","Stellantis","BYD"] },
      { key: "threshold", label: "Confidence threshold", type: "number", default: 75 },
    ],
  },

  // EV
  {
    id: "w-ev-1", solutionId: "ev-charging", name: "EV Stations · Daily Pull",
    description: "Daily delta of public station data, geocoded and merged into a single canonical view.",
    schedule: "Daily · 03:00 UTC", sources: 6, lastRun: "3h ago", nextRun: "in 21h", status: "active", successRate: 99, deltaCapable: true,
    stages: [
      STAGE.aggregate("6 network APIs + scrapers", "ChargePoint, EVgo, EA, Tesla, Ionity, Shell"),
      STAGE.transform("Unify connector / power / pricing schema", "Standardize NACS/CCS/CHAdeMO + kW"),
      STAGE.enrich("Geocode + admin boundaries", "Google + OSM Nominatim"),
      STAGE.delta("Net-new and changed stations only"),
      STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "networks", label: "Networks", type: "multiselect", default: ["ChargePoint","EVgo","Tesla"], options: ["ChargePoint","EVgo","Electrify America","Tesla","Ionity (EU)","Shell Recharge"] },
      { key: "country", label: "Country", type: "select", default: "USA", options: ["USA","Canada","EU-27","UK","Mexico"] },
      { key: "delta", label: "Delta only", type: "toggle", default: true },
    ],
  },
  {
    id: "w-ev-2", solutionId: "ev-charging", name: "Utilization Heatmap · Hourly",
    description: "Hourly session + occupancy pings stitched into a utilization heatmap per corridor.",
    schedule: "Hourly", sources: 4, lastRun: "22m ago", nextRun: "in 38m", status: "active", successRate: 95, deltaCapable: true,
    stages: [
      STAGE.aggregate("Network telemetry pings"),
      STAGE.transform("Bucket by station × hour"),
      STAGE.enrich("Corridor + admin overlay"),
      STAGE.delta("Hourly buckets only"), STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "networks", label: "Networks", type: "multiselect", default: ["ChargePoint","EVgo"], options: ["ChargePoint","EVgo","Electrify America","Tesla","Ionity (EU)","Shell Recharge"] },
      { key: "corridor", label: "Corridor mode", type: "toggle", default: true },
    ],
  },
  {
    id: "w-ev-3", solutionId: "ev-charging", name: "New Site Detection · Daily",
    description: "Daily watch for newly commissioned stations across all networks with confidence-scored alerts.",
    schedule: "Daily · 05:00 UTC", sources: 6, lastRun: "7h ago", nextRun: "in 17h", status: "paused", successRate: 91, deltaCapable: true,
    stages: [
      STAGE.aggregate("Network site index"),
      STAGE.transform("New site dedupe"),
      STAGE.delta("Net-new sites only"), STAGE.qa("Alert on confidence ≥ 80"), STAGE.deliver(),
    ],
    params: [
      { key: "region", label: "Region", type: "select", default: "USA", options: ["USA","Canada","EU-27","UK","Mexico"] },
      { key: "threshold", label: "Alert confidence (%)", type: "number", default: 80 },
    ],
  },

  // News
  {
    id: "w-news-1", solutionId: "news", name: "News · Continuous",
    description: "Continuous newswire ingest, cluster, score and surface AI strategic insights.",
    schedule: "Every 15 min", sources: 6, lastRun: "12m ago", nextRun: "in 3m", status: "active", successRate: 96, deltaCapable: true,
    stages: [
      STAGE.aggregate("6 wire / RSS sources", "Reuters, Bloomberg, AN, Electrek, Nikkei, custom"),
      STAGE.transform("Language detect + de-dup", "EN + native"),
      STAGE.enrich("Topic cluster + sentiment + impact", "AI clusterer"),
      STAGE.enrich("Strategic insight generation", "Exec summary, actions, $$ impact"),
      STAGE.qa("Cluster split/merge review"),
      STAGE.deliver(),
    ],
    params: [
      { key: "keywords", label: "Watch keywords", type: "text", default: "EV, lithium, ACC II, autonomy" },
      { key: "oems", label: "OEM watchlist", type: "multiselect", default: ["Tesla","BYD","GM"], options: ["Tesla","Ford","BMW","Toyota","Hyundai","Volkswagen","Stellantis","BYD","GM","Lucid"] },
      { key: "frequency", label: "Pull cadence", type: "select", default: "15m", options: ["5m","15m","1h"] },
    ],
  },
  {
    id: "w-news-2", solutionId: "news", name: "Patents & Filings · Daily",
    description: "USPTO/EPO + SEC filings sweep, classified by theme with strategic insight digest.",
    schedule: "Daily · 02:00 UTC", sources: 3, lastRun: "9h ago", nextRun: "in 15h", status: "active", successRate: 97, deltaCapable: true,
    stages: [
      STAGE.aggregate("USPTO / EPO / SEC EDGAR"),
      STAGE.transform("Filing type classify"),
      STAGE.enrich("Theme + OEM tagging"),
      STAGE.delta("New filings only"), STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "themes", label: "Themes", type: "multiselect", default: ["ADAS","Solid-state","V2G"], options: ["ADAS","Solid-state","V2G","Autonomy","Powertrain","Manufacturing"] },
      { key: "oems", label: "OEM watchlist", type: "multiselect", default: ["Tesla","Toyota","BYD"], options: ["Tesla","Toyota","BYD","Volkswagen","Lucid","Ford","GM"] },
    ],
  },
  {
    id: "w-news-3", solutionId: "news", name: "Exec Brief · Weekly Digest",
    description: "Weekly auto-generated executive brief rolling up clusters, themes and momentum shifts.",
    schedule: "Weekly · Mon 06:00 UTC", sources: 6, lastRun: "3d ago", nextRun: "in 4d", status: "active", successRate: 100, deltaCapable: false,
    stages: [
      STAGE.aggregate("Week's clusters + insights"),
      STAGE.transform("Rank by impact"),
      STAGE.enrich("Auto-write exec narrative"), STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "audience", label: "Audience", type: "select", default: "Strategy", options: ["Strategy","Product","Sales","Board"] },
    ],
  },

  // Plants
  {
    id: "w-mfg-1", solutionId: "plants", name: "Plants · Full Refresh",
    description: "Walk supplier corporate sites, extract plant data, geocode and normalize per-geography admin levels.",
    schedule: "Monthly · 1st", sources: 4, lastRun: "today", nextRun: "in 27d", status: "active", successRate: 92, deltaCapable: false,
    stages: [
      STAGE.aggregate("Site crawl from input list", "Walk supplier corporate sites"),
      STAGE.transform("Plant page extraction", "Address, site type, capacity"),
      STAGE.enrich("Geocode (Google + Nominatim)", "Lat/Long + admin boundary"),
      STAGE.transform("Admin normalization per geography", "State / Province / Taluk per ISO 3166-2"),
      STAGE.qa("Supplier-name entity resolution"),
      STAGE.deliver(),
    ],
    params: [
      { key: "input", label: "Input company list", type: "select", default: "Customer upload (Admin)", options: ["Customer upload (Admin)","Default 8,014 benchmark"] },
      { key: "geocoder", label: "Geocoder priority", type: "select", default: "Google → OSM", options: ["Google → OSM","OSM only","Google only"] },
      { key: "dedupe", label: "Entity dedupe", type: "toggle", default: true },
    ],
  },
  {
    id: "w-mfg-2", solutionId: "plants", name: "Plants · Quarterly Delta",
    description: "Targeted re-crawl of suppliers flagged with changes; ship only new/removed plants.",
    schedule: "Quarterly", sources: 4, lastRun: "—", nextRun: "in 60d", status: "paused", successRate: 0, deltaCapable: true,
    stages: [
      STAGE.aggregate("Targeted site recrawl", "Only suppliers w/ change signal"),
      STAGE.transform("Plant extract"),
      STAGE.enrich("Geocode + admin"),
      STAGE.delta("New / closed plants only"),
      STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "delta", label: "Delta only", type: "toggle", default: true },
    ],
  },
  {
    id: "w-mfg-3", solutionId: "plants", name: "Capacity Watch · Monthly",
    description: "Monthly capacity & headcount refresh for the top-200 plants by strategic importance.",
    schedule: "Monthly · 15th", sources: 2, lastRun: "12d ago", nextRun: "in 18d", status: "active", successRate: 90, deltaCapable: true,
    stages: [
      STAGE.aggregate("Top-200 watchlist crawl"),
      STAGE.transform("Capacity / headcount extract"),
      STAGE.delta("Capacity moves only"), STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "size", label: "Watchlist size", type: "number", default: 200 },
    ],
  },

  // Dealer
  {
    id: "w-dlr-1", solutionId: "dealer-inventory", name: "Dealer · Weekly Snapshot",
    description: "Per-rooftop firmographics + VIN inventory snapshot, joined with sales velocity benchmark.",
    schedule: "Every Sun · 22:00 UTC", sources: 3, lastRun: "6h ago", nextRun: "in 6d", status: "active", successRate: 88, deltaCapable: true,
    stages: [
      STAGE.aggregate("Rooftop registry + VIN feed", "OEM registry + inventory scrape"),
      STAGE.transform("Join VIN → dealer rooftop", "Per-rooftop inventory"),
      STAGE.enrich("Sales velocity vs benchmark", "Days-on-lot, pricing aggressiveness"),
      STAGE.enrich("Key insight per dealer", "AI summary"),
      STAGE.delta("Inventory deltas, anomalies"),
      STAGE.qa("Anomaly review"),
      STAGE.deliver(),
    ],
    params: [
      { key: "oems", label: "OEMs", type: "multiselect", default: ["BMW","Toyota"], options: ["BMW","Toyota","Ford","GM","Multi-brand"] },
      { key: "region", label: "Region", type: "select", default: "USA", options: ["USA","Canada"] },
      { key: "delta", label: "Delta only", type: "toggle", default: true },
    ],
  },
  {
    id: "w-dlr-2", solutionId: "dealer-inventory", name: "Independent Dealer Verify · 4-hour",
    description: "Continuous verification of independent dealer rooftops — phone, address, hours, license.",
    schedule: "Every 4h", sources: 3, lastRun: "1h ago", nextRun: "in 3h", status: "active", successRate: 95, deltaCapable: true,
    stages: [
      STAGE.aggregate("Dealer site + GBP + DMV registry"),
      STAGE.transform("Fuzzy match name/addr/phone"),
      STAGE.enrich("Confidence score + status"),
      STAGE.qa("Live HITL on low-conf"), STAGE.deliver(),
    ],
    params: [
      { key: "states", label: "States", type: "multiselect", default: ["CA","TX","FL","NY"], options: ["CA","TX","FL","NY","IL","PA","OH","GA","AZ","NC"] },
      { key: "threshold", label: "HITL threshold (%)", type: "number", default: 80 },
    ],
  },
  {
    id: "w-dlr-3", solutionId: "dealer-inventory", name: "Pricing Aggressiveness · Daily",
    description: "Daily price-relative-to-market index across dealer inventory, flags aggressive movers.",
    schedule: "Daily · 04:00 UTC", sources: 3, lastRun: "5h ago", nextRun: "in 19h", status: "active", successRate: 92, deltaCapable: true,
    stages: [
      STAGE.aggregate("Dealer inventory feeds"),
      STAGE.transform("Price vs market benchmark"),
      STAGE.enrich("Aggressiveness index"),
      STAGE.delta("Movers only"), STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "oems", label: "OEMs", type: "multiselect", default: ["BMW","Toyota"], options: ["BMW","Toyota","Ford","GM","Multi-brand"] },
    ],
  },

  // Market
  {
    id: "w-mkt-1", solutionId: "market", name: "Competitor Activity · Daily",
    description: "PR + patent + filings sweep, scored as a per-theme momentum index.",
    schedule: "Daily · 06:00 UTC", sources: 4, lastRun: "1h ago", nextRun: "in 23h", status: "active", successRate: 97, deltaCapable: true,
    stages: [
      STAGE.aggregate("PR wires + USPTO/EPO + SEC + press", "4 source families"),
      STAGE.transform("Theme tagging", "ADAS, solid-state, V2G, autonomy"),
      STAGE.enrich("Momentum index per theme/OEM", "Weighted scoring"),
      STAGE.delta("New signals since last run"),
      STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "themes", label: "Themes", type: "multiselect", default: ["ADAS","Solid-state","V2G"], options: ["ADAS","Solid-state","V2G","Autonomy","Launches","Pricing"] },
      { key: "oems", label: "OEMs", type: "multiselect", default: ["Tesla","Toyota","BYD"], options: ["Tesla","Toyota","BYD","Volkswagen","Lucid","Ford","GM"] },
      { key: "delta", label: "Delta only", type: "toggle", default: true },
    ],
  },
  {
    id: "w-mkt-2", solutionId: "market", name: "Battlecard · Weekly Auto-gen",
    description: "Auto-generated competitor battlecards from the week's signals, routed to product + brand teams.",
    schedule: "Weekly · Fri 08:00 UTC", sources: 4, lastRun: "2d ago", nextRun: "in 5d", status: "active", successRate: 100, deltaCapable: false,
    stages: [
      STAGE.aggregate("Week's signals"),
      STAGE.transform("Per-competitor rollup"),
      STAGE.enrich("Auto-write narrative"), STAGE.qa(), STAGE.deliver(),
    ],
    params: [
      { key: "competitors", label: "Competitors", type: "multiselect", default: ["Tesla","Toyota","BYD"], options: ["Tesla","Toyota","BYD","Volkswagen","Lucid","Ford","GM","Honda"] },
    ],
  },
  {
    id: "w-mkt-3", solutionId: "market", name: "Price-Move Alert · Hourly",
    description: "Hourly competitor price/list-price sweep, alerts on >5% moves.",
    schedule: "Hourly", sources: 2, lastRun: "18m ago", nextRun: "in 42m", status: "active", successRate: 96, deltaCapable: true,
    stages: [
      STAGE.aggregate("List-price endpoints"),
      STAGE.transform("Normalize SKU"),
      STAGE.delta("Price moves only"),
      STAGE.qa("Alert ≥ threshold"), STAGE.deliver(),
    ],
    params: [
      { key: "threshold", label: "Alert threshold (%)", type: "number", default: 5 },
    ],
  },
];

export const getWorkflowsFor = (id: SolutionId) => WORKFLOWS.filter((w) => w.solutionId === id);

// ============ Integrations catalog (push destinations) ============
export interface IntegrationDef {
  id: string;
  name: string;
  kind: "Data warehouse" | "Data lake" | "Lakehouse" | "Analytics" | "Custom";
  detail: string;
}
export const INTEGRATIONS: IntegrationDef[] = [
  { id: "snowflake",  name: "Snowflake",     kind: "Data warehouse", detail: "Push to a Snowflake schema · upsert per workflow run" },
  { id: "bigquery",   name: "Google BigQuery", kind: "Data warehouse", detail: "Stream rows to a BigQuery dataset" },
  { id: "s3",         name: "AWS S3",        kind: "Data lake",      detail: "Drop CSV / Parquet per run into your bucket" },
  { id: "databricks", name: "Databricks",    kind: "Lakehouse",      detail: "Land in a Unity Catalog volume / Delta table" },
  { id: "powerbi",    name: "Power BI",      kind: "Analytics",      detail: "Refresh a Power BI dataset on every run" },
  { id: "webhook",    name: "HTTP Webhook",  kind: "Custom",         detail: "POST each completed run to your endpoint" },
];

// Helpers
export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCSV(columns: string[], rows: Record<string, string | number>[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
}

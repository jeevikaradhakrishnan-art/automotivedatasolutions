import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SOLUTIONS, type SolutionDef, type SolutionId } from "@/data/solutions";

export interface SolutionOverride {
  solution_id: string;
  enabled: boolean;
  title: string | null;
  description: string | null;
  metrics: { label: string; value: string }[];
  tags: string[];
  download_assets: { label: string; url: string }[];
  sample_datasets: { label: string; url: string }[];
  updated_at: string;
}

export interface SolutionDatasetRow {
  id: string;
  solution_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  row_count: number | null;
  columns: string[] | null;
  preview: Record<string, unknown>[] | null;
  is_active: boolean;
  uploaded_at: string;
}

export type EffectiveSolution = SolutionDef & {
  enabled: boolean;
  metrics: { label: string; value: string }[];
  tags: string[];
  downloadAssets: { label: string; url: string }[];
  sampleDatasets: { label: string; url: string }[];
  updatedAt?: string;
};

/** Fetches overrides + subscribes to realtime changes. */
export function useSolutionOverrides() {
  const [overrides, setOverrides] = useState<Record<string, SolutionOverride>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("solution_overrides").select("*");
      if (!active) return;
      const map: Record<string, SolutionOverride> = {};
      (data ?? []).forEach((r) => { map[r.solution_id] = r as unknown as SolutionOverride; });
      setOverrides(map);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("solution_overrides_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "solution_overrides" }, () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  return { overrides, loading };
}

export function useEffectiveSolutions(includeDisabled = false): EffectiveSolution[] {
  const { overrides } = useSolutionOverrides();
  return useMemo(() => {
    return SOLUTIONS
      .map((s) => {
        const o = overrides[s.id];
        const eff: EffectiveSolution = {
          ...s,
          title: o?.title || s.title,
          short: o?.description || s.short,
          enabled: o?.enabled ?? true,
          metrics: o?.metrics ?? [],
          tags: o?.tags ?? [],
          downloadAssets: o?.download_assets ?? [],
          sampleDatasets: o?.sample_datasets ?? [],
          updatedAt: o?.updated_at,
        };
        return eff;
      })
      .filter((s) => includeDisabled || s.enabled);
  }, [overrides, includeDisabled]);
}

export function useEffectiveSolution(id: SolutionId | string): EffectiveSolution | undefined {
  const list = useEffectiveSolutions(true);
  return list.find((s) => s.id === id);
}

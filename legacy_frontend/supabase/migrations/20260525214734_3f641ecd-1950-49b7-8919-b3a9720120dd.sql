
-- Solution overrides (one row per solution id from the SOLUTIONS catalog)
CREATE TABLE public.solution_overrides (
  solution_id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  title TEXT,
  description TEXT,
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  download_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_datasets JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.solution_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solution_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  row_count INTEGER,
  columns JSONB,
  preview JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_solution_datasets_solution ON public.solution_datasets(solution_id, uploaded_at DESC);

CREATE TABLE public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  solution_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_log_created ON public.admin_activity_log(created_at DESC);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_overrides_updated BEFORE UPDATE ON public.solution_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: hidden-URL admin -> allow anon full access; public site reads
ALTER TABLE public.solution_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all overrides" ON public.solution_overrides
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all datasets" ON public.solution_datasets
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public all activity" ON public.admin_activity_log
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.solution_overrides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solution_datasets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_activity_log;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('solution-assets', 'solution-assets', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read solution-assets" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'solution-assets');
CREATE POLICY "public write solution-assets" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'solution-assets');
CREATE POLICY "public update solution-assets" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'solution-assets');
CREATE POLICY "public delete solution-assets" ON storage.objects
  FOR DELETE TO anon, authenticated USING (bucket_id = 'solution-assets');

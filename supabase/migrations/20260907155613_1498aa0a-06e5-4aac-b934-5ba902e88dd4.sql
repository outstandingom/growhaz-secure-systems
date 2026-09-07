-- Isolated provenance module tables (Arbitrum). No existing table is modified.

CREATE TABLE public.provenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_id uuid,
  record_id text NOT NULL UNIQUE,
  issuer_wallet text,
  current_version integer NOT NULL DEFAULT 0,
  chain_network text NOT NULL DEFAULT 'arbitrum-sepolia',
  contract_address text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provenance_records TO anon;
GRANT SELECT, INSERT, UPDATE ON public.provenance_records TO authenticated;
GRANT ALL ON public.provenance_records TO service_role;
ALTER TABLE public.provenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provenance records are publicly viewable"
  ON public.provenance_records FOR SELECT USING (true);
CREATE POLICY "Owners can create provenance records"
  ON public.provenance_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their provenance records"
  ON public.provenance_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.provenance_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  record_id text NOT NULL REFERENCES public.provenance_records(record_id) ON DELETE CASCADE,
  version integer NOT NULL,
  previous_version integer,
  file_hash text,
  content_hash text,
  merkle_root text,
  semantic_hash text,
  actor_wallet text,
  issuer_wallet text,
  event_type text NOT NULL DEFAULT 'REGISTERED',
  state text NOT NULL DEFAULT 'ACTIVE',
  metadata_uri text,
  chain_network text NOT NULL DEFAULT 'arbitrum-sepolia',
  contract_address text,
  tx_hash text,
  block_hash text,
  block_number bigint,
  explorer_url text,
  chain_timestamp timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, version)
);
GRANT SELECT ON public.provenance_versions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.provenance_versions TO authenticated;
GRANT ALL ON public.provenance_versions TO service_role;
ALTER TABLE public.provenance_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provenance versions are publicly viewable"
  ON public.provenance_versions FOR SELECT USING (true);
CREATE POLICY "Owners can add provenance versions"
  ON public.provenance_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their provenance versions"
  ON public.provenance_versions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.provenance_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  record_id text NOT NULL REFERENCES public.provenance_records(record_id) ON DELETE CASCADE,
  version integer NOT NULL,
  actor_wallet text,
  role text NOT NULL DEFAULT 'ISSUER',
  statement text,
  proof_hash text,
  tx_hash text,
  block_number bigint,
  explorer_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provenance_attestations TO anon;
GRANT SELECT, INSERT ON public.provenance_attestations TO authenticated;
GRANT ALL ON public.provenance_attestations TO service_role;
ALTER TABLE public.provenance_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attestations are publicly viewable"
  ON public.provenance_attestations FOR SELECT USING (true);
CREATE POLICY "Signed-in users can add attestations"
  ON public.provenance_attestations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.provenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  record_id text NOT NULL REFERENCES public.provenance_records(record_id) ON DELETE CASCADE,
  version integer,
  event_type text NOT NULL,
  actor_wallet text,
  tx_hash text,
  block_hash text,
  block_number bigint,
  explorer_url text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provenance_events TO anon;
GRANT SELECT, INSERT ON public.provenance_events TO authenticated;
GRANT ALL ON public.provenance_events TO service_role;
ALTER TABLE public.provenance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provenance events are publicly viewable"
  ON public.provenance_events FOR SELECT USING (true);
CREATE POLICY "Signed-in users can log provenance events"
  ON public.provenance_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_provenance_versions_record ON public.provenance_versions(record_id, version);
CREATE INDEX idx_provenance_versions_file_hash ON public.provenance_versions(file_hash);
CREATE INDEX idx_provenance_versions_content_hash ON public.provenance_versions(content_hash);
CREATE INDEX idx_provenance_records_document ON public.provenance_records(document_id);
CREATE INDEX idx_provenance_events_record ON public.provenance_events(record_id);

CREATE TRIGGER update_provenance_records_updated_at
  BEFORE UPDATE ON public.provenance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_provenance_versions_updated_at
  BEFORE UPDATE ON public.provenance_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
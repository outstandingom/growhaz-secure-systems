ALTER TABLE public.verified_documents
  ADD COLUMN IF NOT EXISTS chain_block_hash text,
  ADD COLUMN IF NOT EXISTS chain_network text,
  ADD COLUMN IF NOT EXISTS chain_explorer_url text,
  ADD COLUMN IF NOT EXISTS merkle_root text,
  ADD COLUMN IF NOT EXISTS anchor_status text NOT NULL DEFAULT 'not_anchored',
  ADD COLUMN IF NOT EXISTS anchor_cost_coins integer,
  ADD COLUMN IF NOT EXISTS anchored_at timestamptz,
  ADD COLUMN IF NOT EXISTS anchor_error text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS verified_documents_file_hash_idx ON public.verified_documents (file_hash);
CREATE INDEX IF NOT EXISTS verified_documents_tx_idx ON public.verified_documents (chain_tx_hash);

GRANT SELECT ON public.verified_documents TO anon;
GRANT SELECT, INSERT, UPDATE ON public.verified_documents TO authenticated;
GRANT ALL ON public.verified_documents TO service_role;
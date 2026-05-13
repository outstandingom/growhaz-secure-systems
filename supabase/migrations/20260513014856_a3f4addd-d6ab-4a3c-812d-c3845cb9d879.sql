ALTER TABLE public.verified_documents
  ADD COLUMN IF NOT EXISTS ipfs_cid TEXT,
  ADD COLUMN IF NOT EXISTS ipfs_url TEXT,
  ADD COLUMN IF NOT EXISTS chain_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS chain_block_number BIGINT,
  ADD COLUMN IF NOT EXISTS chain_issuer_address TEXT,
  ADD COLUMN IF NOT EXISTS chain_contract_address TEXT;
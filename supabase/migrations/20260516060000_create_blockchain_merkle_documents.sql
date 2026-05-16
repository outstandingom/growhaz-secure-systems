-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCKCHAIN MERKLE DOCUMENTS INDEX
-- Stores Merkle root, wallet address, transaction hash, contract address,
-- file hash, content hash, IPFS CIDs for every MerkleDocumentRegistry tx.
-- Paste this in Supabase SQL Editor and click RUN.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.blockchain_merkle_documents (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core blockchain identifiers
    transaction_hash    TEXT        NOT NULL UNIQUE,
    block_hash          TEXT        NOT NULL,
    block_number        BIGINT      NOT NULL,
    contract_address    TEXT        NOT NULL,
    wallet_address      TEXT        NOT NULL,

    -- Merkle verification data
    merkle_root         TEXT        NOT NULL,
    file_hash           TEXT,
    content_hash        TEXT,
    total_chunks        INTEGER,
    total_tokens        INTEGER,

    -- IPFS storage
    ipfs_cid            TEXT,
    ipfs_metadata_cid   TEXT,
    ipfs_url            TEXT,

    -- Document metadata
    document_name       TEXT,
    document_type       TEXT,
    issuer_name         TEXT,

    -- Cross-reference to verified_documents table
    verified_document_id UUID,

    -- Event type: 'DocumentRegistered' | 'DocumentVerified'
    event_type          TEXT        NOT NULL DEFAULT 'DocumentRegistered',

    -- Timestamps
    on_chain_timestamp  BIGINT,
    indexed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bcmd_merkle_root   ON public.blockchain_merkle_documents (merkle_root);
CREATE INDEX IF NOT EXISTS idx_bcmd_wallet        ON public.blockchain_merkle_documents (wallet_address);
CREATE INDEX IF NOT EXISTS idx_bcmd_tx_hash       ON public.blockchain_merkle_documents (transaction_hash);
CREATE INDEX IF NOT EXISTS idx_bcmd_contract      ON public.blockchain_merkle_documents (contract_address);
CREATE INDEX IF NOT EXISTS idx_bcmd_file_hash     ON public.blockchain_merkle_documents (file_hash);
CREATE INDEX IF NOT EXISTS idx_bcmd_content_hash  ON public.blockchain_merkle_documents (content_hash);
CREATE INDEX IF NOT EXISTS idx_bcmd_block_number  ON public.blockchain_merkle_documents (block_number);

-- RLS
ALTER TABLE public.blockchain_merkle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read merkle document index"
    ON public.blockchain_merkle_documents FOR SELECT
    TO PUBLIC USING (true);

CREATE POLICY "Authenticated users can index merkle documents"
    ON public.blockchain_merkle_documents FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update merkle document index"
    ON public.blockchain_merkle_documents FOR UPDATE
    TO authenticated USING (true);

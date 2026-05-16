-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCKCHAIN INDEX TABLES
-- Paste this entire file into Supabase SQL Editor and click RUN.
--
-- PURPOSE:
--   Blockchain data cannot be searched. We use Supabase ONLY as an index
--   so the app can instantly find records by wallet_address, transaction_hash,
--   contract_address, or block_hash — without scanning the chain.
--
-- TABLES CREATED:
--   1. blockchain_user_registrations  — UserRegistry contract events
--   2. blockchain_document_registry   — DocumentRegistry contract events
--   3. blockchain_access_grants       — DocumentAccessControl contract events
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: blockchain_user_registrations
-- Indexes registerUser() and updateProfile() transactions from UserRegistry.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blockchain_user_registrations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core blockchain identifiers
    transaction_hash    TEXT        NOT NULL UNIQUE,
    block_hash          TEXT        NOT NULL,
    block_number        BIGINT      NOT NULL,
    contract_address    TEXT        NOT NULL,
    wallet_address      TEXT        NOT NULL,

    -- Cached payload from the smart contract call
    ipfs_cid            TEXT,
    user_name           TEXT,
    profession          TEXT,
    phone_hash          TEXT,

    -- 'UserRegistered' or 'ProfileUpdated'
    event_type          TEXT        NOT NULL DEFAULT 'UserRegistered',

    on_chain_timestamp  BIGINT,
    indexed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcur_wallet       ON public.blockchain_user_registrations (wallet_address);
CREATE INDEX IF NOT EXISTS idx_bcur_tx_hash      ON public.blockchain_user_registrations (transaction_hash);
CREATE INDEX IF NOT EXISTS idx_bcur_contract     ON public.blockchain_user_registrations (contract_address);
CREATE INDEX IF NOT EXISTS idx_bcur_block_number ON public.blockchain_user_registrations (block_number);

ALTER TABLE public.blockchain_user_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user registration index"
    ON public.blockchain_user_registrations FOR SELECT
    TO PUBLIC USING (true);

CREATE POLICY "Authenticated users can index their registrations"
    ON public.blockchain_user_registrations FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update their registration index"
    ON public.blockchain_user_registrations FOR UPDATE
    TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: blockchain_document_registry
-- Indexes registerDocument() (V2) and verifyDocument() (V1) transactions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blockchain_document_registry (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core blockchain identifiers
    transaction_hash        TEXT        NOT NULL UNIQUE,
    block_hash              TEXT        NOT NULL,
    block_number            BIGINT      NOT NULL,
    contract_address        TEXT        NOT NULL,
    wallet_address          TEXT        NOT NULL,

    -- Document identifiers
    document_id             TEXT,
    file_hash               TEXT,
    content_hash            TEXT,
    merkle_root             TEXT,

    -- IPFS references
    ipfs_cid                TEXT,
    ipfs_metadata_cid       TEXT,
    ipfs_url                TEXT,

    -- Cached metadata
    document_name           TEXT,
    document_type           TEXT,
    issuer_name             TEXT,

    -- Link back to verified_documents table (optional)
    verified_document_id    UUID,

    -- 'v1' or 'v2'
    contract_version        TEXT        NOT NULL DEFAULT 'v2',

    -- 'DocumentRegistered' or 'DocumentVerified'
    event_type              TEXT        NOT NULL DEFAULT 'DocumentRegistered',

    on_chain_timestamp      BIGINT,
    indexed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcdr_wallet        ON public.blockchain_document_registry (wallet_address);
CREATE INDEX IF NOT EXISTS idx_bcdr_tx_hash       ON public.blockchain_document_registry (transaction_hash);
CREATE INDEX IF NOT EXISTS idx_bcdr_contract      ON public.blockchain_document_registry (contract_address);
CREATE INDEX IF NOT EXISTS idx_bcdr_doc_id        ON public.blockchain_document_registry (document_id);
CREATE INDEX IF NOT EXISTS idx_bcdr_file_hash     ON public.blockchain_document_registry (file_hash);
CREATE INDEX IF NOT EXISTS idx_bcdr_ipfs_cid      ON public.blockchain_document_registry (ipfs_cid);
CREATE INDEX IF NOT EXISTS idx_bcdr_block_number  ON public.blockchain_document_registry (block_number);

ALTER TABLE public.blockchain_document_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read document registry index"
    ON public.blockchain_document_registry FOR SELECT
    TO PUBLIC USING (true);

CREATE POLICY "Authenticated users can index document registrations"
    ON public.blockchain_document_registry FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update document registry index"
    ON public.blockchain_document_registry FOR UPDATE
    TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: blockchain_access_grants
-- Indexes grantAccess() and revokeAccess() from DocumentAccessControl.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blockchain_access_grants (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core blockchain identifiers
    transaction_hash    TEXT        NOT NULL UNIQUE,
    block_hash          TEXT        NOT NULL,
    block_number        BIGINT      NOT NULL,
    contract_address    TEXT        NOT NULL,

    -- The two wallets involved
    owner_wallet        TEXT        NOT NULL,
    viewer_wallet       TEXT        NOT NULL,

    -- Which document the access applies to
    document_id         TEXT        NOT NULL,

    -- Access details
    expires_at          BIGINT,
    is_active           BOOLEAN     NOT NULL DEFAULT true,

    -- 'AccessGranted' or 'AccessRevoked'
    event_type          TEXT        NOT NULL DEFAULT 'AccessGranted',

    on_chain_timestamp  BIGINT,
    indexed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bcag_owner_wallet  ON public.blockchain_access_grants (owner_wallet);
CREATE INDEX IF NOT EXISTS idx_bcag_viewer_wallet ON public.blockchain_access_grants (viewer_wallet);
CREATE INDEX IF NOT EXISTS idx_bcag_tx_hash       ON public.blockchain_access_grants (transaction_hash);
CREATE INDEX IF NOT EXISTS idx_bcag_contract      ON public.blockchain_access_grants (contract_address);
CREATE INDEX IF NOT EXISTS idx_bcag_doc_id        ON public.blockchain_access_grants (document_id);
CREATE INDEX IF NOT EXISTS idx_bcag_is_active     ON public.blockchain_access_grants (is_active);

ALTER TABLE public.blockchain_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read access grant index"
    ON public.blockchain_access_grants FOR SELECT
    TO PUBLIC USING (true);

CREATE POLICY "Authenticated users can index access grants"
    ON public.blockchain_access_grants FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update access grant index"
    ON public.blockchain_access_grants FOR UPDATE
    TO authenticated USING (true);

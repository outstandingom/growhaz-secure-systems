-- Create the blockchain_blocks table to serve as a ledger
CREATE TABLE IF NOT EXISTS public.blockchain_blocks (
    block_index BIGINT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL,
    previous_hash TEXT NOT NULL,
    hash TEXT NOT NULL UNIQUE,
    nonce BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.blockchain_blocks ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the blockchain (public ledger)
CREATE POLICY "Anyone can view blockchain blocks" 
ON public.blockchain_blocks FOR SELECT 
TO PUBLIC 
USING (true);

-- Allow authenticated users to insert new blocks
CREATE POLICY "Authenticated users can insert blocks" 
ON public.blockchain_blocks FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Implement the Genesis Block!
-- We use block_index 0 and hardcode the first hash so the chain always has a starting point.
INSERT INTO public.blockchain_blocks (block_index, timestamp, data, previous_hash, hash, nonce)
VALUES (
    0, 
    '2026-01-01T00:00:00Z', 
    '"Genesis Block"'::jsonb, 
    '0', 
    '214f89cd591ca2135e3320b4de5b7cca20eada2e34dc7ad3f9f23529a00f1a71', -- The hash of the Genesis block
    0
) ON CONFLICT (block_index) DO NOTHING;

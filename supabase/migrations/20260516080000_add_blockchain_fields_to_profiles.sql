-- Add blockchain profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chain_wallet_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chain_contract_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chain_tx_hash text;

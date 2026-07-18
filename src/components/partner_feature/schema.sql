-- Schema extensions for the "Become a Partner" feature
-- Run this in your Supabase SQL Editor

-- 1. Create partner_profiles table
CREATE TABLE IF NOT EXISTS public.partner_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_partner BOOLEAN DEFAULT false,
  partner_code VARCHAR(50) UNIQUE,
  wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table to track purchases where a coupon was applied
CREATE TABLE IF NOT EXISTS public.partner_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES auth.users(id),
  product_name VARCHAR(255) NOT NULL,
  original_price NUMERIC(10, 2) NOT NULL,
  discount_applied NUMERIC(10, 2) DEFAULT 0.00,
  final_price NUMERIC(10, 2) NOT NULL,
  applied_partner_code VARCHAR(50) REFERENCES public.partner_profiles(partner_code),
  partner_reward_coins NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_partner_code ON public.partner_profiles(partner_code);
CREATE INDEX IF NOT EXISTS idx_partner_purchases_buyer ON public.partner_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_partner_purchases_code ON public.partner_purchases(applied_partner_code);

-- 4. Enable RLS on partner_profiles
ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to READ partner_profiles (needed for coupon validation)
CREATE POLICY "Anyone can validate a partner code"
  ON public.partner_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own partner profile
CREATE POLICY "Users can create their own partner profile"
  ON public.partner_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own partner profile (e.g. wallet_balance is updated by system)
-- We also allow service role to update (for wallet credit)
CREATE POLICY "Users can update their own partner profile"
  ON public.partner_profiles FOR UPDATE
  TO authenticated
  USING (true);

-- 5. Enable RLS on partner_purchases
ALTER TABLE public.partner_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert purchases"
  ON public.partner_purchases FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Users can view their own purchases"
  ON public.partner_purchases FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid());

-- 6. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_partner_profiles_modtime
BEFORE UPDATE ON public.partner_profiles
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

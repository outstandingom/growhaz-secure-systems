-- Add new columns to user_titles
ALTER TABLE public.user_titles ADD COLUMN IF NOT EXISTS multiplier integer NOT NULL DEFAULT 1;
ALTER TABLE public.user_titles ADD COLUMN IF NOT EXISTS user_display_name text;

-- Create an RPC to safely upsert and increment the multiplier
CREATE OR REPLACE FUNCTION public.claim_user_title(
  p_user_id uuid,
  p_title_key text,
  p_title_name text,
  p_title_emoji text,
  p_cost integer,
  p_display_name text
) RETURNS void AS $$
BEGIN
  INSERT INTO public.user_titles (
    user_id, 
    title_key, 
    title_name, 
    title_emoji, 
    cost, 
    user_display_name, 
    multiplier, 
    claimed_at
  )
  VALUES (
    p_user_id, 
    p_title_key, 
    p_title_name, 
    p_title_emoji, 
    p_cost, 
    p_display_name, 
    1, 
    now()
  )
  ON CONFLICT (user_id, title_key) DO UPDATE
  SET 
    multiplier = public.user_titles.multiplier + 1,
    claimed_at = now(),
    user_display_name = EXCLUDED.user_display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.claim_user_title TO authenticated;

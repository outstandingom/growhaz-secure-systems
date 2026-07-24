REVOKE EXECUTE ON FUNCTION public.spend_user_coins(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_user_coins(uuid, numeric, text) FROM anon;

CREATE OR REPLACE FUNCTION public.spend_user_coins(
  p_user_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized coin spend';
  END IF;

  SELECT balance INTO v_balance
  FROM public.coin_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No coin balance found for user';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.coin_balances
  SET balance = balance - p_amount,
      total_spent = total_spent + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions (user_id, type, amount, description, status)
  VALUES (p_user_id, 'spend'::transaction_type, p_amount, p_description, 'completed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_user_coins(uuid, numeric, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
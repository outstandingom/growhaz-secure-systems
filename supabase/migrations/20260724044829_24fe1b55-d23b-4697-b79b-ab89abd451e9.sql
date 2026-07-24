ALTER FUNCTION public.update_coin_balance(uuid, numeric, text, text) RENAME TO update_coin_balance_legacy;

NOTIFY pgrst, 'reload schema';
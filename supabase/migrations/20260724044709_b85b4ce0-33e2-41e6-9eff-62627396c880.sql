REVOKE EXECUTE ON FUNCTION public.update_coin_balance(uuid, numeric, public.transaction_type, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_coin_balance(uuid, numeric, public.transaction_type, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_coin_balance(uuid, numeric, public.transaction_type, text, text, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
REVOKE EXECUTE ON FUNCTION public.update_coin_balance(uuid, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_coin_balance(uuid, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_coin_balance(uuid, numeric, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.update_coin_balance(uuid, numeric, public.transaction_type, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.spend_user_coins(uuid, numeric, text) TO authenticated, service_role;
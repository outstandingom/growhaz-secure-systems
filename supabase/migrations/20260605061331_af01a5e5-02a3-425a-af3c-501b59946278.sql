
-- demo_processes
CREATE TABLE public.demo_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  entity_type text NOT NULL DEFAULT 'document',
  entity_ref text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_processes TO authenticated;
GRANT ALL ON public.demo_processes TO service_role;
ALTER TABLE public.demo_processes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read demo_processes" ON public.demo_processes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert demo_processes" ON public.demo_processes FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update demo_processes" ON public.demo_processes FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete demo_processes" ON public.demo_processes FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_demo_processes_updated BEFORE UPDATE ON public.demo_processes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- demo_process_steps
CREATE TABLE public.demo_process_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.demo_processes(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  title text NOT NULL,
  description text,
  assignee_name text,
  status text NOT NULL DEFAULT 'pending',
  completed_by text,
  completed_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  verification_notes text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_process_steps TO authenticated;
GRANT ALL ON public.demo_process_steps TO service_role;
ALTER TABLE public.demo_process_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read demo_steps" ON public.demo_process_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert demo_steps" ON public.demo_process_steps FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.demo_processes p WHERE p.id = process_id AND p.owner_id = auth.uid())
);
CREATE POLICY "auth update demo_steps" ON public.demo_process_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "owner delete demo_steps" ON public.demo_process_steps FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.demo_processes p WHERE p.id = process_id AND p.owner_id = auth.uid())
);
CREATE TRIGGER trg_demo_steps_updated BEFORE UPDATE ON public.demo_process_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- demo_user_registry
CREATE TABLE public.demo_user_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  wallet_address text NOT NULL,
  name text NOT NULL,
  profession text,
  phone_hash text,
  ipfs_cid text,
  registered_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_user_registry TO authenticated;
GRANT ALL ON public.demo_user_registry TO service_role;
ALTER TABLE public.demo_user_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read user_registry" ON public.demo_user_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert user_registry" ON public.demo_user_registry FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update user_registry" ON public.demo_user_registry FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete user_registry" ON public.demo_user_registry FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- demo_chain_wallets
CREATE TABLE public.demo_chain_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  wallet_address text NOT NULL,
  label text,
  display_balance text DEFAULT '0',
  network text NOT NULL DEFAULT 'polygon-amoy',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_chain_wallets TO authenticated;
GRANT ALL ON public.demo_chain_wallets TO service_role;
ALTER TABLE public.demo_chain_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read wallets" ON public.demo_chain_wallets FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert wallets" ON public.demo_chain_wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update wallets" ON public.demo_chain_wallets FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete wallets" ON public.demo_chain_wallets FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- ============================================================
-- Migration: Title Leaderboard + Build Queue System
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. user_titles — stores which titles a user has claimed
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_titles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_key   text        NOT NULL,   -- e.g. "supporter", "ninja"
  title_name  text        NOT NULL,   -- display name
  title_emoji text        NOT NULL,   -- e.g. "🏆"
  cost        integer     NOT NULL,   -- coins spent
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_key)
);

-- Grants
GRANT SELECT, INSERT ON public.user_titles TO authenticated;
GRANT ALL ON public.user_titles TO service_role;

-- RLS
ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view titles" ON public.user_titles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can claim their own titles" ON public.user_titles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 2. build_queue — manages the 20-concurrent-build limit
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.build_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  build_id      text        NOT NULL,
  status        text        NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting', 'building', 'completed', 'failed')),
  position      integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.build_queue TO authenticated;
GRANT ALL ON public.build_queue TO service_role;

-- RLS
ALTER TABLE public.build_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queue entries" ON public.build_queue
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue entries" ON public.build_queue
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue entries" ON public.build_queue
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access" ON public.build_queue
  FOR ALL TO service_role USING (true);

-- Index for fast lookups of active builds
CREATE INDEX idx_build_queue_status ON public.build_queue (status);
CREATE INDEX idx_build_queue_user   ON public.build_queue (user_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────
-- 3. Helper functions
-- ──────────────────────────────────────────────────────────────

-- Get count of currently running builds
CREATE OR REPLACE FUNCTION public.get_active_build_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.build_queue
  WHERE status = 'building';
$$;

GRANT EXECUTE ON FUNCTION public.get_active_build_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_build_count() TO service_role;

-- Atomically try to start a queued build (returns true if promoted)
CREATE OR REPLACE FUNCTION public.try_start_build(p_queue_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_count integer;
BEGIN
  -- Lock the row to prevent race conditions
  PERFORM 1 FROM public.build_queue WHERE id = p_queue_id AND status = 'waiting' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.build_queue
  WHERE status = 'building';

  IF v_active_count >= 20 THEN
    RETURN false;
  END IF;

  UPDATE public.build_queue
  SET status = 'building', started_at = now()
  WHERE id = p_queue_id AND status = 'waiting';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_start_build(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_start_build(uuid) TO service_role;

-- Get queue position for a waiting entry
CREATE OR REPLACE FUNCTION public.get_queue_position(p_queue_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM public.build_queue
  WHERE status = 'waiting'
    AND created_at <= (SELECT created_at FROM public.build_queue WHERE id = p_queue_id)
$$;

GRANT EXECUTE ON FUNCTION public.get_queue_position(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_queue_position(uuid) TO service_role;

-- Enable realtime for build_queue so clients get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.build_queue;

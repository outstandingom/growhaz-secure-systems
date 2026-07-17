
-- Add user_id to apk_builds so users can see their own builds
ALTER TABLE public.apk_builds ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_apk_builds_user_id ON public.apk_builds(user_id);

-- Tighten RLS: users manage their own; keep service_role full access
DROP POLICY IF EXISTS "Anyone can create builds" ON public.apk_builds;
DROP POLICY IF EXISTS "Anyone can read builds" ON public.apk_builds;
DROP POLICY IF EXISTS "Service role can update builds" ON public.apk_builds;

CREATE POLICY "Users can insert own builds"
  ON public.apk_builds FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own builds"
  ON public.apk_builds FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own builds"
  ON public.apk_builds FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access apk_builds"
  ON public.apk_builds FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Storage policy: authenticated users can read their APK files from app-builds bucket.
-- Files are stored as {build_id}/app.apk — match the first folder segment to an owned build.
DROP POLICY IF EXISTS "Users can read own apk files" ON storage.objects;
CREATE POLICY "Users can read own apk files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'app-builds'
    AND EXISTS (
      SELECT 1 FROM public.apk_builds b
      WHERE b.user_id = auth.uid()
        AND b.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

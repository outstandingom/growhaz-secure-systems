
DROP POLICY IF EXISTS "Anyone can view active verified mentors" ON public.mentors;
CREATE POLICY "Anyone can view active mentors"
  ON public.mentors FOR SELECT
  TO public
  USING (is_active = true);

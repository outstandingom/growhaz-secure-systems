-- Allow admins to view ALL profiles (not just mentor profiles or own profile)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
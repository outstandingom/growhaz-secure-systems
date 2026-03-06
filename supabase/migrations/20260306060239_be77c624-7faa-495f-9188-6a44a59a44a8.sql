
-- 1. Drop the old text-based update_coin_balance function that causes ambiguity
DROP FUNCTION IF EXISTS public.update_coin_balance(uuid, numeric, text, text);

-- 2. Add SELECT policy for users to see their own learning_requests (any status)
CREATE POLICY "Users can view their own learning requests"
ON public.learning_requests FOR SELECT
USING (auth.uid() = user_id);

-- 3. Add report_url and report_status to security_reports for admin workflow
ALTER TABLE public.security_reports 
ADD COLUMN IF NOT EXISTS report_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS report_status text NOT NULL DEFAULT 'pending';

-- 4. Allow admins to view all security reports
CREATE POLICY "Admins can view all security reports"
ON public.security_reports FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Allow admins to update security reports (to add drive link)
CREATE POLICY "Admins can update security reports"
ON public.security_reports FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_name text NOT NULL,
  file_hash text NOT NULL,
  content_hash text NOT NULL,
  file_hash_match boolean NOT NULL DEFAULT false,
  content_hash_match boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'unknown',
  matched_document_id uuid,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own verifications"
ON public.verification_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own verifications"
ON public.verification_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX verification_logs_user_idx ON public.verification_logs(user_id, created_at DESC);
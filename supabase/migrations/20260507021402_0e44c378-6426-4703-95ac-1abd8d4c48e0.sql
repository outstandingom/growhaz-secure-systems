-- Create table for verified documents (intelligent document verification)
CREATE TABLE public.verified_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT,
  file_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  knowledge_graph JSONB DEFAULT '{}'::jsonb,
  ai_validation JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'authentic',
  blockchain_tx TEXT,
  issuer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_verified_documents_file_hash ON public.verified_documents(file_hash);
CREATE INDEX idx_verified_documents_content_hash ON public.verified_documents(content_hash);
CREATE INDEX idx_verified_documents_user_id ON public.verified_documents(user_id);

ALTER TABLE public.verified_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own documents"
ON public.verified_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own documents"
ON public.verified_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can verify by hash (public lookup)"
ON public.verified_documents FOR SELECT
USING (true);

CREATE POLICY "Users can update own documents"
ON public.verified_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_verified_documents_updated_at
BEFORE UPDATE ON public.verified_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('verified-documents', 'verified-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'verified-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Documents are publicly viewable for verification"
ON storage.objects FOR SELECT
USING (bucket_id = 'verified-documents');

-- Add scanner contact information to security_reports table
ALTER TABLE public.security_reports 
ADD COLUMN scanner_name text,
ADD COLUMN scanner_phone text;
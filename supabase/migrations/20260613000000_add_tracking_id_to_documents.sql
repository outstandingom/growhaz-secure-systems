-- Add unique tracking_id to verified_documents table
ALTER TABLE verified_documents
ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(20) UNIQUE;

-- Create an index on tracking_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_verified_documents_tracking_id ON verified_documents(tracking_id);

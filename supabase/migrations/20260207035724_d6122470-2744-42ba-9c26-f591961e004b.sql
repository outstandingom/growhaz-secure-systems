-- Add mentorship and verification fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN github_url text,
ADD COLUMN linkedin_url text,
ADD COLUMN leetcode_url text,
ADD COLUMN certificates jsonb DEFAULT '[]'::jsonb,
ADD COLUMN skills text[] DEFAULT '{}'::text[],
ADD COLUMN hourly_rate numeric,
ADD COLUMN bio text,
ADD COLUMN is_available_as_mentor boolean DEFAULT false,
ADD COLUMN experience_years integer DEFAULT 0;

-- Add index for finding available mentors
CREATE INDEX idx_profiles_mentor_available ON public.profiles(is_available_as_mentor) WHERE is_available_as_mentor = true;

-- Update RLS to allow users to view other profiles (for mentor discovery)
CREATE POLICY "Anyone can view mentor profiles"
ON public.profiles
FOR SELECT
USING (is_available_as_mentor = true);

-- Keep existing policy for own profile management (already exists)
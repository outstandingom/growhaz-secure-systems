-- Add category column to blog_posts
ALTER TABLE public.blog_posts ADD COLUMN category text NOT NULL DEFAULT 'general';

-- Create index on category for faster filtering
CREATE INDEX idx_blog_posts_category ON public.blog_posts(category);

-- Create mentors table
CREATE TABLE public.mentors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  bio text NOT NULL,
  avatar_url text,
  expertise text[] NOT NULL DEFAULT '{}',
  experience_years integer NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  linkedin_url text,
  calendly_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create mentorship topics table
CREATE TABLE public.mentorship_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create mentorship bookings table
CREATE TABLE public.mentorship_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mentor_id UUID NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.mentorship_topics(id) ON DELETE CASCADE,
  scheduled_at timestamp with time zone NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  total_price numeric NOT NULL,
  meeting_link text,
  meeting_type text NOT NULL DEFAULT 'google_meet',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_bookings ENABLE ROW LEVEL SECURITY;

-- Mentors: Public read for active verified mentors
CREATE POLICY "Anyone can view active verified mentors"
ON public.mentors
FOR SELECT
USING (is_active = true AND is_verified = true);

-- Mentorship topics: Public read for active topics
CREATE POLICY "Anyone can view active topics"
ON public.mentorship_topics
FOR SELECT
USING (is_active = true);

-- Mentorship bookings: Users can view their own bookings
CREATE POLICY "Users can view their own bookings"
ON public.mentorship_bookings
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own bookings
CREATE POLICY "Users can create their own bookings"
ON public.mentorship_bookings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own bookings
CREATE POLICY "Users can update their own bookings"
ON public.mentorship_bookings
FOR UPDATE
USING (auth.uid() = user_id);

-- Insert default mentorship topics
INSERT INTO public.mentorship_topics (name, slug, description, icon) VALUES
('Cybersecurity', 'cybersecurity', 'Learn ethical hacking, penetration testing, and security fundamentals', 'Shield'),
('Website Security Testing', 'website-security', 'Master vulnerability assessment and web application security', 'Lock'),
('Generative AI', 'generative-ai', 'Build AI agents, prompt engineering, and LLM applications', 'Brain'),
('SEO & Digital Marketing', 'seo-marketing', 'Rank higher on Google and grow organic traffic', 'TrendingUp'),
('Web Development', 'web-development', 'Build modern websites with React, Node.js, and more', 'Code'),
('Automation & RPA', 'automation', 'Automate workflows and business processes', 'Zap'),
('Programming Fundamentals', 'programming', 'Learn Python, JavaScript, and software development basics', 'Terminal');

-- Add trigger for updated_at on mentors
CREATE TRIGGER update_mentors_updated_at
BEFORE UPDATE ON public.mentors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on mentorship_bookings
CREATE TRIGGER update_mentorship_bookings_updated_at
BEFORE UPDATE ON public.mentorship_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create enum for request status
CREATE TYPE public.learning_request_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

-- Create enum for request type
CREATE TYPE public.learning_request_type AS ENUM ('learn', 'consulting', 'project_help');

-- Create learning requests table
CREATE TABLE public.learning_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  request_type learning_request_type NOT NULL DEFAULT 'learn',
  skills TEXT[] NOT NULL DEFAULT '{}',
  budget_min NUMERIC,
  budget_max NUMERIC,
  preferred_duration TEXT,
  urgency TEXT DEFAULT 'normal',
  status learning_request_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.learning_requests ENABLE ROW LEVEL SECURITY;

-- Users can view all open requests (for mentors to see)
CREATE POLICY "Anyone can view open learning requests"
ON public.learning_requests
FOR SELECT
USING (status = 'open');

-- Users can create their own requests
CREATE POLICY "Users can create their own learning requests"
ON public.learning_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own requests
CREATE POLICY "Users can update their own learning requests"
ON public.learning_requests
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own requests
CREATE POLICY "Users can delete their own learning requests"
ON public.learning_requests
FOR DELETE
USING (auth.uid() = user_id);

-- Create responses table for mentors/students to respond
CREATE TABLE public.learning_request_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.learning_requests(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL,
  responder_name TEXT NOT NULL,
  responder_skills TEXT[] NOT NULL DEFAULT '{}',
  message TEXT NOT NULL,
  proposed_rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_request_responses ENABLE ROW LEVEL SECURITY;

-- Responders can create responses
CREATE POLICY "Authenticated users can respond to requests"
ON public.learning_request_responses
FOR INSERT
WITH CHECK (auth.uid() = responder_id);

-- Request owners can view responses to their requests
CREATE POLICY "Request owners can view responses"
ON public.learning_request_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.learning_requests
    WHERE id = request_id AND user_id = auth.uid()
  )
  OR responder_id = auth.uid()
);

-- Responders can update their own responses
CREATE POLICY "Responders can update their responses"
ON public.learning_request_responses
FOR UPDATE
USING (auth.uid() = responder_id);

-- Trigger for updated_at
CREATE TRIGGER update_learning_requests_updated_at
BEFORE UPDATE ON public.learning_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
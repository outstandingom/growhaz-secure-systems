
-- Create session_reviews table
CREATE TABLE public.session_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  mentor_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  session_completed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_reviews ENABLE ROW LEVEL SECURITY;

-- Only the learner of the booking can insert a review
CREATE POLICY "Learner can create review"
ON public.session_reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1 FROM mentorship_bookings
    WHERE mentorship_bookings.id = session_reviews.booking_id
    AND mentorship_bookings.user_id = auth.uid()
    AND mentorship_bookings.status = 'confirmed'
  )
);

-- Both participants can view reviews
CREATE POLICY "Participants can view reviews"
ON public.session_reviews
FOR SELECT
USING (
  reviewer_id = auth.uid()
  OR mentor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM mentorship_bookings
    WHERE mentorship_bookings.id = session_reviews.booking_id
    AND (mentorship_bookings.user_id = auth.uid() OR mentorship_bookings.mentor_id = auth.uid())
  )
);

-- Anyone can view reviews publicly (for profile display)
CREATE POLICY "Anyone can view reviews"
ON public.session_reviews
FOR SELECT
USING (true);

-- Function to transfer coins to mentor on session completion
CREATE OR REPLACE FUNCTION public.transfer_coins_on_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  IF NEW.session_completed = true THEN
    SELECT * INTO v_booking FROM mentorship_bookings WHERE id = NEW.booking_id;
    
    IF v_booking IS NOT NULL THEN
      -- Credit coins to mentor
      PERFORM update_coin_balance(
        v_booking.mentor_id,
        v_booking.total_price,
        'earn'::transaction_type,
        'Earned from mentorship session'
      );
      
      -- Update booking status to completed
      UPDATE mentorship_bookings SET status = 'completed' WHERE id = NEW.booking_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_review_transfer_coins
AFTER INSERT ON public.session_reviews
FOR EACH ROW
EXECUTE FUNCTION public.transfer_coins_on_review();

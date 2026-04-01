
CREATE TABLE public.booking_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.mentorship_bookings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking participants can view messages"
  ON public.booking_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.mentorship_bookings
    WHERE id = booking_messages.booking_id
    AND (user_id = auth.uid() OR mentor_id = auth.uid())
  ));

CREATE POLICY "Booking participants can send messages"
  ON public.booking_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.mentorship_bookings
      WHERE id = booking_messages.booking_id
      AND (user_id = auth.uid() OR mentor_id = auth.uid())
    )
  );

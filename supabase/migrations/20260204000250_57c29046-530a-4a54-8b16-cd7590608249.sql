-- Allow mentors to view bookings assigned to them
CREATE POLICY "Mentors can view their assigned bookings"
ON public.mentorship_bookings
FOR SELECT
USING (auth.uid() = mentor_id);

-- Allow mentors to update their assigned bookings (meeting link, status, notes)
CREATE POLICY "Mentors can update their assigned bookings"
ON public.mentorship_bookings
FOR UPDATE
USING (auth.uid() = mentor_id)
WITH CHECK (auth.uid() = mentor_id);
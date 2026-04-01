

## Problem Summary

Currently, when a user books a mentor, coins are deducted and a `mentorship_bookings` record is created with status "pending", but:
1. The mentor has **no way to see incoming booking requests** (no UI for mentors to view their bookings)
2. The mentor has **no way to add a meeting link** to accept the booking
3. There is **no communication channel** between the learner and mentor

## Plan

### 1. Create a `booking_messages` table for chat between mentor and learner

New migration to create a messages table tied to bookings:
- `id`, `booking_id` (references mentorship_bookings), `sender_id`, `message`, `created_at`
- RLS: only the mentor and learner of that booking can read/write messages

### 2. Add a "My Bookings" tab to the Mentorship page

Add a 5th tab called "My Bookings" that shows:
- **As a learner**: bookings you've made, their status (pending/confirmed/completed), and the meeting link once the mentor provides it
- **As a mentor**: incoming booking requests with ability to accept/decline, add a meeting link, and mark as completed

### 3. Create a `BookingChat` component

A dialog/sheet component that opens when clicking on a booking, showing:
- Booking details (mentor name, topic, date, status, meeting link)
- Real-time chat messages between the mentor and learner using Supabase realtime subscriptions
- Input to send new messages

### 4. Add mentor actions on bookings

When a mentor views an incoming booking:
- "Accept" button that updates status to "confirmed" and requires a meeting link input
- "Decline" button that updates status to "cancelled" (and ideally refunds coins)
- Meeting link field that the learner can see once provided

### 5. Update RLS policies

- `mentorship_bookings` already has policies for mentor/learner to view and update — these are sufficient
- New `booking_messages` table needs SELECT/INSERT policies scoped to participants of the booking

### Technical Details

**New DB table:**
```sql
CREATE TABLE public.booking_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES mentorship_bookings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

-- Only booking participants can view/send messages
CREATE POLICY "Booking participants can view messages"
  ON public.booking_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mentorship_bookings
    WHERE id = booking_messages.booking_id
    AND (user_id = auth.uid() OR mentor_id = auth.uid())
  ));

CREATE POLICY "Booking participants can send messages"
  ON public.booking_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM mentorship_bookings
      WHERE id = booking_messages.booking_id
      AND (user_id = auth.uid() OR mentor_id = auth.uid())
    )
  );
```

**Files to create:**
- `src/components/mentorship/BookingChat.tsx` — chat dialog with real-time messages
- `src/components/mentorship/MyBookings.tsx` — bookings list for both mentor and learner roles

**Files to modify:**
- `src/pages/Mentorship.tsx` — add "My Bookings" tab, import new components
- `src/pages/Mentorship.tsx` — update `handleBookWithCoins` to show clearer "request sent" messaging

**Booking flow after changes:**
1. Learner clicks "Book" → coins deducted → booking created as "pending" → learner sees "Request sent"
2. Mentor sees incoming booking in "My Bookings" tab
3. Mentor accepts (adds meeting link) → status becomes "confirmed" → learner sees meeting link
4. Both can chat via the booking chat feature
5. Mentor can decline → status becomes "cancelled" (coins refunded via RPC)


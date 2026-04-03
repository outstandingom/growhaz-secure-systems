
-- Fix sync trigger to use user_id (auth UUID) instead of profile internal id
CREATE OR REPLACE FUNCTION public.sync_mentor_from_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.is_available_as_mentor = true AND NEW.mentor_approved = true THEN
        INSERT INTO public.mentors (id, name, title, bio, avatar_url, expertise, experience_years, hourly_rate, is_verified, linkedin_url, is_active)
        VALUES (
            NEW.user_id,
            NEW.full_name,
            COALESCE(NEW.bio, 'Community mentor'),
            COALESCE(NEW.bio, 'Available for mentorship'),
            NULL,
            COALESCE(NEW.skills, '{}'::text[]),
            COALESCE(NEW.experience_years, 0),
            COALESCE(NEW.hourly_rate, 500),
            false,
            NEW.linkedin_url,
            true
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            title = EXCLUDED.title,
            bio = EXCLUDED.bio,
            expertise = EXCLUDED.expertise,
            experience_years = EXCLUDED.experience_years,
            hourly_rate = EXCLUDED.hourly_rate,
            linkedin_url = EXCLUDED.linkedin_url,
            is_active = true;
    ELSIF NEW.is_available_as_mentor = false OR NEW.mentor_approved = false THEN
        DELETE FROM public.mentors WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$function$;

-- Also clean up any existing mentors with wrong IDs (profile internal id instead of user_id)
DELETE FROM public.mentors m
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.id)
AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.id);

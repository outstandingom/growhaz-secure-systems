
CREATE OR REPLACE FUNCTION public.sync_mentor_from_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Only process if mentor fields actually changed
    IF NEW.is_available_as_mentor = true AND NEW.mentor_approved = true THEN
        INSERT INTO public.mentors (id, name, title, bio, avatar_url, expertise, experience_years, hourly_rate, is_verified, linkedin_url, is_active)
        VALUES (
            NEW.id,
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
        -- Only delete if the mentor record exists
        DELETE FROM public.mentors WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$function$;

-- Drop existing trigger if any and recreate only on UPDATE (not INSERT)
DROP TRIGGER IF EXISTS sync_mentor_trigger ON public.profiles;
CREATE TRIGGER sync_mentor_trigger
    AFTER UPDATE OF is_available_as_mentor, mentor_approved ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_mentor_from_profile();

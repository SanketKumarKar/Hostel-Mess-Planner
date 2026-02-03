-- Function to check registration settings
CREATE OR REPLACE FUNCTION check_registration_open()
RETURNS TRIGGER AS $$
DECLARE
    is_caterer_allowed text;
    is_admin_allowed text;
BEGIN
    -- Check for Caterer
    IF NEW.role = 'caterer' THEN
        SELECT setting_value INTO is_caterer_allowed FROM system_settings WHERE setting_key = 'caterer_registration';
        IF is_caterer_allowed = 'false' THEN
            RAISE EXCEPTION 'Caterer registration is currently closed.';
        END IF;
    END IF;

    -- Check for Admin
    IF NEW.role = 'admin' THEN
        SELECT setting_value INTO is_admin_allowed FROM system_settings WHERE setting_key = 'admin_registration';
        IF is_admin_allowed = 'false' THEN
            RAISE EXCEPTION 'Admin registration is currently closed.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run before insert on profiles
DROP TRIGGER IF EXISTS check_registration_trigger ON public.profiles;
CREATE TRIGGER check_registration_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION check_registration_open();

-- 1) Add user_email column to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS user_email text;

-- 2) Function to set user_id from user_email
CREATE OR REPLACE FUNCTION public.set_user_id_from_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_user_id uuid;
BEGIN
  IF NEW.user_id IS NULL AND NEW.user_email IS NOT NULL THEN
    SELECT id INTO matched_user_id
    FROM auth.users
    WHERE lower(email) = lower(NEW.user_email)
    LIMIT 1;

    IF matched_user_id IS NOT NULL THEN
      NEW.user_id := matched_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Trigger to apply the function before insert/update
DROP TRIGGER IF EXISTS trg_set_user_id_from_email ON public.transactions;
CREATE TRIGGER trg_set_user_id_from_email
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_user_id_from_email();

-- 4) Backfill existing rows
UPDATE public.transactions t
SET user_id = u.id
FROM auth.users u
WHERE t.user_id IS NULL
  AND t.user_email IS NOT NULL
  AND lower(u.email) = lower(t.user_email);

-- Sanitize 'null' string in transferation_destination on insert/update
BEGIN;

-- One-time cleanup (idempotent)
UPDATE public.transactions
SET transferation_destination = NULL
WHERE transferation_destination = 'null';

-- Create or replace trigger function to sanitize values
CREATE OR REPLACE FUNCTION public.sanitize_transactions_nulls()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.transferation_destination IS NOT NULL AND trim(lower(NEW.transferation_destination)) = 'null' THEN
    NEW.transferation_destination := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS trg_sanitize_transactions_nulls_ins ON public.transactions;
DROP TRIGGER IF EXISTS trg_sanitize_transactions_nulls_upd ON public.transactions;

-- Create triggers for insert and update
CREATE TRIGGER trg_sanitize_transactions_nulls_ins
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_transactions_nulls();

CREATE TRIGGER trg_sanitize_transactions_nulls_upd
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_transactions_nulls();

COMMIT;
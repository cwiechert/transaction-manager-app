-- Remove description column from categorization_rules and update auto_categorize_transaction function
BEGIN;

-- Drop description column if it exists
ALTER TABLE public.categorization_rules
DROP COLUMN IF EXISTS description;

-- Update function to no longer reference description from rules
CREATE OR REPLACE FUNCTION public.auto_categorize_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Priority 1: transferation_type implies credit card payment
  IF NEW.transferation_type IN (
    'Pago con Tarjeta de Crédito Nacional',
    'Pago con Tarjeta de Crédito Internacional'
  ) THEN
    NEW.category := 'Pago de Tarjeta de Crédito';

  -- Priority 2: apply rule by payment_reason if present and no category set yet
  ELSIF NEW.category IS NULL AND NEW.payment_reason IS NOT NULL THEN
    SELECT cr.category
    INTO NEW.category
    FROM public.categorization_rules cr
    WHERE cr.payment_reason = NEW.payment_reason
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
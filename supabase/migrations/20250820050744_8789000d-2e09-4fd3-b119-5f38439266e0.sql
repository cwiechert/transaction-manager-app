-- Fix auto categorization for credit card payments and backfill existing rows
BEGIN;

-- Update the function to handle both "de" and "con" variants
CREATE OR REPLACE FUNCTION public.auto_categorize_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Priority 1: transferation_type implies credit card payment
  IF NEW.transferation_type IN (
    'Pago de Tarjeta de Crédito Nacional',
    'Pago de Tarjeta de Crédito Internacional',
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

-- Backfill: set category for existing rows that match these transferation types and are uncategorized
UPDATE public.transactions
SET category = 'Pago de Tarjeta de Crédito'
WHERE category IS NULL
  AND transferation_type IN (
    'Pago de Tarjeta de Crédito Nacional',
    'Pago de Tarjeta de Crédito Internacional',
    'Pago con Tarjeta de Crédito Nacional',
    'Pago con Tarjeta de Crédito Internacional'
  );

COMMIT;
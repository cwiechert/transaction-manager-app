-- Enable Row Level Security on public tables
BEGIN;

-- Enable RLS on transactions table if not already enabled
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on categorization_rules table if not already enabled  
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for now (user should implement authentication later)
-- Allow all operations on transactions for authenticated users
CREATE POLICY IF NOT EXISTS "Allow all operations on transactions for authenticated users"
ON public.transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow all operations on categorization_rules for authenticated users
CREATE POLICY IF NOT EXISTS "Allow all operations on categorization_rules for authenticated users"
ON public.categorization_rules
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow read access for anonymous users (for now)
CREATE POLICY IF NOT EXISTS "Allow read access on transactions for anonymous users"
ON public.transactions
FOR SELECT
TO anon
USING (true);

CREATE POLICY IF NOT EXISTS "Allow read access on categorization_rules for anonymous users"
ON public.categorization_rules
FOR SELECT
TO anon
USING (true);

-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_categorize_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
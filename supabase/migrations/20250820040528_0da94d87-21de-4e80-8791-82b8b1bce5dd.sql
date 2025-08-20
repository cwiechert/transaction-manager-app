-- Create rules table if missing
CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_reason TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Timestamp trigger fn (idempotent re-create)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger on rules table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_categorization_rules_updated_at'
  ) THEN
    CREATE TRIGGER update_categorization_rules_updated_at
      BEFORE UPDATE ON public.categorization_rules
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- BEFORE INSERT trigger: auto-categorize
CREATE OR REPLACE FUNCTION public.auto_categorize_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Priority 1: transferation_type implies credit card payment
  IF NEW.transferation_type IN (
    'Pago con Tarjeta de Crédito Nacional',
    'Pago con Tarjeta de Crédito Internacional'
  ) THEN
    NEW.category := 'Pago de Tarjeta de Crédito';

  -- Priority 2: apply rule by payment_reason if present and no category set yet
  ELSIF NEW.category IS NULL AND NEW.payment_reason IS NOT NULL THEN
    PERFORM 1 FROM public.categorization_rules cr WHERE cr.payment_reason = NEW.payment_reason;
    IF FOUND THEN
      SELECT cr.category, COALESCE(NEW.description, cr.description)
      INTO NEW.category, NEW.description
      FROM public.categorization_rules cr
      WHERE cr.payment_reason = NEW.payment_reason;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists and is BEFORE INSERT
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_categorize_transactions') THEN
    DROP TRIGGER auto_categorize_transactions ON public.transactions;
  END IF;
  CREATE TRIGGER auto_categorize_transactions
    BEFORE INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_categorize_transaction();
END $$;

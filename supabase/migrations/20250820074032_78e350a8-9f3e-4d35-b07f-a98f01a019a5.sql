-- Rerun secure RLS migration with corrected unique constraint drop and idempotency

-- 1) Ensure user_id columns exist
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.categorization_rules ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Helper trigger to stamp user_id
CREATE OR REPLACE FUNCTION public.set_record_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Attach/ensure triggers
DROP TRIGGER IF EXISTS set_transactions_user_id ON public.transactions;
CREATE TRIGGER set_transactions_user_id
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_record_user_id();

DROP TRIGGER IF EXISTS set_rules_user_id ON public.categorization_rules;
CREATE TRIGGER set_rules_user_id
BEFORE INSERT ON public.categorization_rules
FOR EACH ROW EXECUTE FUNCTION public.set_record_user_id();

-- 3) Indexes and constraints
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rules_user_id ON public.categorization_rules(user_id);

-- Replace any existing unique on payment_reason with per-user uniqueness
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'categorization_rules'
      AND constraint_name = 'categorization_rules_payment_reason_key'
  ) THEN
    EXECUTE 'ALTER TABLE public.categorization_rules DROP CONSTRAINT categorization_rules_payment_reason_key';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'categorization_rules'
      AND constraint_name = 'categorization_rules_user_payment_reason_unique'
  ) THEN
    EXECUTE 'ALTER TABLE public.categorization_rules ADD CONSTRAINT categorization_rules_user_payment_reason_unique UNIQUE (user_id, payment_reason)';
  END IF;
END $$;

-- 4) Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

-- Drop overly-permissive policies if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'Allow all operations on transactions for all users'
  ) THEN
    EXECUTE 'DROP POLICY "Allow all operations on transactions for all users" ON public.transactions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'categorization_rules' AND policyname = 'Allow all operations on categorization_rules for all users'
  ) THEN
    EXECUTE 'DROP POLICY "Allow all operations on categorization_rules for all users" ON public.categorization_rules';
  END IF;
END $$;

-- 5) Recreate per-user policies idempotently
-- Transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
CREATE POLICY "Users can insert their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
CREATE POLICY "Users can delete their own transactions"
ON public.transactions
FOR DELETE
USING (user_id = auth.uid());

-- Categorization rules
DROP POLICY IF EXISTS "Users can view their own rules" ON public.categorization_rules;
CREATE POLICY "Users can view their own rules"
ON public.categorization_rules
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own rules" ON public.categorization_rules;
CREATE POLICY "Users can insert their own rules"
ON public.categorization_rules
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own rules" ON public.categorization_rules;
CREATE POLICY "Users can update their own rules"
ON public.categorization_rules
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own rules" ON public.categorization_rules;
CREATE POLICY "Users can delete their own rules"
ON public.categorization_rules
FOR DELETE
USING (user_id = auth.uid());
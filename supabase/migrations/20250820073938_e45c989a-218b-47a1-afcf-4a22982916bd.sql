-- 1) Add user_id columns to support ownership
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.categorization_rules
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Create helper trigger to stamp user_id on insert
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

-- Attach triggers
DROP TRIGGER IF EXISTS set_transactions_user_id ON public.transactions;
CREATE TRIGGER set_transactions_user_id
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_record_user_id();

DROP TRIGGER IF EXISTS set_rules_user_id ON public.categorization_rules;
CREATE TRIGGER set_rules_user_id
BEFORE INSERT ON public.categorization_rules
FOR EACH ROW EXECUTE FUNCTION public.set_record_user_id();

-- 3) Indexes for performance and constraints
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_rules_user_id ON public.categorization_rules(user_id);

-- Ensure a per-user unique rule by (user_id, payment_reason)
DROP INDEX IF EXISTS categorization_rules_payment_reason_key;
CREATE UNIQUE INDEX IF NOT EXISTS categorization_rules_user_payment_reason_unique
ON public.categorization_rules (user_id, payment_reason);

-- 4) Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;

-- Drop overly-permissive policies if they exist
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

-- 5) Strict per-user policies
-- Transactions
CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own transactions"
ON public.transactions
FOR DELETE
USING (user_id = auth.uid());

-- Categorization rules (per user)
CREATE POLICY "Users can view their own rules"
ON public.categorization_rules
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own rules"
ON public.categorization_rules
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own rules"
ON public.categorization_rules
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own rules"
ON public.categorization_rules
FOR DELETE
USING (user_id = auth.uid());
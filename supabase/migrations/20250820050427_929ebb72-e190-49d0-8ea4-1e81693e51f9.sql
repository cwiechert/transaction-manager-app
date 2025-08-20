-- Fix RLS policies to allow anonymous users to update transactions
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on transactions for authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Allow all operations on categorization_rules for authenticated users" ON public.categorization_rules;
DROP POLICY IF EXISTS "Allow read access on transactions for anonymous users" ON public.transactions;
DROP POLICY IF EXISTS "Allow read access on categorization_rules for anonymous users" ON public.categorization_rules;

-- Create more permissive policies for development (allow anonymous users to perform all operations)
CREATE POLICY "Allow all operations on transactions for all users"
ON public.transactions
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on categorization_rules for all users"
ON public.categorization_rules
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT;
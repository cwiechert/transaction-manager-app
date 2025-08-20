-- Create trigger to auto-categorize transactions
BEGIN;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_auto_categorize_transaction ON public.transactions;

-- Create trigger that calls the auto_categorize_transaction function
CREATE TRIGGER trg_auto_categorize_transaction
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_categorize_transaction();

COMMIT;
-- Fix "null" string values in transferation_destination column
UPDATE public.transactions 
SET transferation_destination = NULL 
WHERE transferation_destination = 'null';
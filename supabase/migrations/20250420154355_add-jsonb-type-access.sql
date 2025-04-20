-- 1. Drop the old column
ALTER TABLE public.users DROP COLUMN access;

-- 2. Add a new column of type jsonb
ALTER TABLE public.users ADD COLUMN access jsonb;

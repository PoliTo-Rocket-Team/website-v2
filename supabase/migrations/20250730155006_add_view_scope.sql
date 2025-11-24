-- Drop existing table and types if they exist
DROP TABLE IF EXISTS scopes CASCADE;
DROP TYPE IF EXISTS public.scope_type CASCADE;
DROP TYPE IF EXISTS public.target_type CASCADE;
DROP TYPE IF EXISTS public.access_level_type CASCADE;

CREATE TYPE public.scope_type AS ENUM (
  'admin',
  'org',
  'department',
  'division',
  'website'
);

CREATE TYPE public.target_type AS ENUM (
  'all',
  'positions',
  'applications',
  'members',
  'orders',
  'faq',
  'blog',
  'logs'
);

CREATE TYPE public.access_level_type AS ENUM ('view', 'edit');

CREATE TABLE scopes (
  id SERIAL PRIMARY KEY,
  member_id INTEGER REFERENCES members(member_id) ON DELETE CASCADE,
  given_by INTEGER REFERENCES members(member_id) ON DELETE SET NULL,

  scope scope_type NOT NULL,
  target target_type NOT NULL,
  access_level access_level_type NOT NULL DEFAULT 'view',

  dept_id INTEGER REFERENCES departments(id),
  division_id INTEGER REFERENCES divisions(id),

  CONSTRAINT unique_scope_combination
    UNIQUE (member_id, scope, target, dept_id, division_id),

  ----------------------------------------------------------------
  -- SCOPE STRUCTURAL RULES ONLY
  ----------------------------------------------------------------
  CONSTRAINT scope_structure_constraints CHECK (
    -- admin: must not have dept/div
    (scope = 'admin' AND dept_id IS NULL AND division_id IS NULL) OR

    -- org: must not have dept/div
    (scope = 'org' AND dept_id IS NULL AND division_id IS NULL) OR

    -- department: must have dept, must NOT have division
    (scope = 'department' AND dept_id IS NOT NULL AND division_id IS NULL) OR

    -- division: must have division, must NOT have dept
    (scope = 'division' AND division_id IS NOT NULL AND dept_id IS NULL) OR

    -- website: must not have dept/div
    (scope = 'website' AND dept_id IS NULL AND division_id IS NULL)
  )
);

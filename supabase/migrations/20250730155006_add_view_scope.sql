-- Drop existing table and types if they exist
DROP TABLE IF EXISTS scopes CASCADE;
DROP TYPE IF EXISTS public.scope_type CASCADE;
DROP TYPE IF EXISTS public.target_type CASCADE;
DROP TYPE IF EXISTS public.access_level_type CASCADE;

-- 1. SCOPE TYPE (The "Role" or "Power Level")
CREATE TYPE public.scope_type AS ENUM (
  'admin',       
  'org',         
  'department',  
  'division',    
  'core_member'  
);

-- 2. TARGET TYPE (The "Resource")
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
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  given_by UUID REFERENCES users(id) ON DELETE SET NULL,

  scope scope_type NOT NULL,
  target target_type NOT NULL DEFAULT 'all',
  access_level access_level_type NOT NULL DEFAULT 'view',

  dept_id INTEGER REFERENCES departments(id),
  division_id INTEGER REFERENCES divisions(id),

  CONSTRAINT unique_scope_combination
    UNIQUE (user_id, scope, target, dept_id, division_id),

  ----------------------------------------------------------------
  -- STRUCTURAL VALIDITY RULES
  ----------------------------------------------------------------
  CONSTRAINT scope_structure_constraints CHECK (
    -- admin: Must be global
    (scope = 'admin' AND dept_id IS NULL AND division_id IS NULL) OR

    -- org: Must be global
    (scope = 'org' AND dept_id IS NULL AND division_id IS NULL) OR

    -- department: Must have dept, Must NOT have division
    (scope = 'department' AND dept_id IS NOT NULL AND division_id IS NULL) OR

    -- division: Must have division, Must NOT have dept
    (scope = 'division' AND division_id IS NOT NULL AND dept_id IS NULL) OR

    -- core_member: Must be global (Basic member of the Org)
    (scope = 'core_member' AND dept_id IS NULL AND division_id IS NULL)
  )
);
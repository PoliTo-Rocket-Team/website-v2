CREATE TYPE public.scope_type AS ENUM ('all', 'department', 'division');
CREATE TYPE public.access_level_type AS ENUM ('view', 'edit');



CREATE TABLE scopes (
  id SERIAL PRIMARY KEY,
  member_id INTEGER REFERENCES members(member_id),
  scope scope_type NOT NULL,
  access_level access_level_type NOT NULL DEFAULT 'view',
  dept_id INTEGER REFERENCES departments(id),
  division_id INTEGER REFERENCES divisions(id),
  CONSTRAINT unique_scope_combination UNIQUE (member_id, scope, dept_id, division_id)
);

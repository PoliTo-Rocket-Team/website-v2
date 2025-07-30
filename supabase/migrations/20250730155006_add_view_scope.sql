CREATE TYPE public.view_scope_type AS ENUM ('all', 'department', 'division');
CREATE TYPE public.access_level_type AS ENUM ('see', 'edit');



CREATE TABLE view_scopes (
  id SERIAL PRIMARY KEY,
  viewer_member_id INTEGER REFERENCES members(member_id),
  scope view_scope_type NOT NULL,
  access_level access_level_type NOT NULL DEFAULT 'see',
  dept_id INTEGER REFERENCES departments(id),
  division_id INTEGER REFERENCES divisions(id),
  CONSTRAINT unique_scope_combination UNIQUE (viewer_member_id, scope, dept_id, division_id)
);

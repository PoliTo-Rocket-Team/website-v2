
-- MEMBERS
CREATE TABLE members (
  member_id SERIAL PRIMARY KEY,
  prt_email TEXT,
  mobile_number TEXT,
  discord TEXT,
  nda_signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nda_name TEXT,
  nda_confirmed_by INTEGER REFERENCES members(member_id),
  picture TEXT
);

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  origin TEXT,
  level_of_study TEXT,
  linkedin TEXT,
  polito_id TEXT,
  program TEXT,
  member INTEGER REFERENCES members(member_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  access TEXT[] DEFAULT '{}'
);


-- DEPARTMENTS (Subteams)
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  started_at DATE,
  closed_at DATE,
  code TEXT
);

-- DIVISIONS
CREATE TABLE divisions (
  id SERIAL PRIMARY KEY,
  dept_id INTEGER REFERENCES departments(id),
  name TEXT NOT NULL,
  started_at DATE,
  closed_at DATE,
  code TEXT
);
-- First create the enum
CREATE TYPE public.position_type AS ENUM ('president', 'head', 'lead', 'core');

-- Then the table
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  member_id INTEGER REFERENCES members(member_id),
  dept_id INTEGER REFERENCES departments(id),
  division_id INTEGER REFERENCES divisions(id),
  title TEXT NOT NULL,
  started_at DATE,
  leaved_at DATE,
  type position_type 
);


CREATE TYPE public.status AS ENUM (
    'pending',
    'accepted',
    'rejected'
);

-- ORDERS
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  status public.status DEFAULT 'pending'::public.status NOT NULL,
  requester INTEGER REFERENCES members(member_id),
  description TEXT,
  reason TEXT,
  quantity INTEGER,
  price NUMERIC,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quote_name TEXT
);

-- APPLY POSITIONS
CREATE TABLE apply_positions (
  id SERIAL PRIMARY KEY,
  status BOOLEAN NOT NULL,
  division_id INTEGER REFERENCES divisions(id),
  title TEXT,
  description TEXT,
  required_skills TEXT[],
  desirable_skills TEXT[],
  custom_questions TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE public.application_status AS ENUM (
    'pending',
    'rejected',
    'accepted',
    'received',
    'accepted_by_another_team'
);

-- APPLICATIONS
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  open_position_id INTEGER REFERENCES apply_positions(id),
  user_id UUID REFERENCES users(id),
  ml_name TEXT,
  cv_name TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.application_status DEFAULT 'received'::public.application_status NOT NULL,
  custom_answers JSONB[]
);

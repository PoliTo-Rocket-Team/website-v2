
-- MEMBERS
CREATE TABLE members (
  member_id SERIAL PRIMARY KEY,
  prt_email TEXT,
  discord TEXT,
  nda_signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nda_name TEXT,
  nda_confirmed_by INTEGER REFERENCES members(member_id),
  picture TEXT
);

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY,
  member INTEGER REFERENCES members(member_id),
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  origin TEXT,
  mobile_number TEXT,
  linkedin TEXT,
  polito_id TEXT,
  polito_email TEXT,
  date_of_birth DATE,
  gender TEXT,
  level_of_study TEXT,
  how_found_us TEXT,
  program TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);


-- DEPARTMENTS (Subteams)
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  started_at DATE NOT NULL DEFAULT now(),
  closed_at DATE,
  code TEXT
);

-- DIVISIONS
CREATE TABLE divisions (
  id SERIAL PRIMARY KEY,
  dept_id INTEGER REFERENCES departments(id),
  name TEXT NOT NULL,
  started_at DATE NOT NULL DEFAULT now(),
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
  started_at DATE NOT NULL DEFAULT now(),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requires_motivation_letter BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE TYPE public.application_status AS ENUM (
    'received',
    'not_selected',
    'interview',
    'rejected_email_to_be_sent',
    'rejected',
    'accepted_email_to_be_sent',
    'accepted',
    'accepted_joined',
    'resigned',
    'accepted_by_another_team'
);

-- APPLICATIONS
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  apply_position_id INTEGER REFERENCES apply_positions(id),
  user_id UUID REFERENCES users(id),
  ml_name TEXT,
  cv_name TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.application_status DEFAULT 'received'::public.application_status NOT NULL,
  custom_answers JSONB[]
);


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

-- APPLICATION FILES
CREATE TABLE application_files (
  id SERIAL PRIMARY KEY,
  r2_key TEXT UNIQUE NOT NULL,           -- R2 storage key
  original_filename TEXT NOT NULL,       -- original filename as uploaded by user
  mime_type TEXT,                        -- MIME type (e.g., 'application/pdf')
  file_size BIGINT,                      -- file size in bytes
  file_hash TEXT,                       -- hash of the file content for integrity verification
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES users(id)
);

-- APPLICATIONS
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  apply_position_id INTEGER REFERENCES apply_positions(id),
  user_id UUID REFERENCES users(id),
  cv_file_id INTEGER REFERENCES application_files(id) ON DELETE SET NULL,
  cover_letter_file_id INTEGER REFERENCES application_files(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.application_status DEFAULT 'received'::public.application_status NOT NULL,
  custom_answers JSONB[]
);

-- Create indexes for application_files
CREATE INDEX idx_application_files_r2_key ON application_files(r2_key);

-- Create indexes for applications table
CREATE INDEX idx_applications_cv_file_id ON applications(cv_file_id);
CREATE INDEX idx_applications_cover_letter_file_id ON applications(cover_letter_file_id);

-- Add comments for documentation
COMMENT ON TABLE application_files IS 'Stores CV and cover letter files for job applications';
COMMENT ON COLUMN application_files.r2_key IS 'Unique key for the file in R2 storage';
COMMENT ON COLUMN application_files.original_filename IS 'Original filename as uploaded by the user';
COMMENT ON COLUMN applications.cv_file_id IS 'Reference to CV file in application_files table';
COMMENT ON COLUMN applications.cover_letter_file_id IS 'Reference to cover letter file in application_files table';
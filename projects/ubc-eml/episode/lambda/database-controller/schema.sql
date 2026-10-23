CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS instructor (
  id uuid PRIMARY KEY,
  first_name varchar(100) NOT NULL DEFAULT '',
  last_name varchar(100) NOT NULL DEFAULT '',
  email varchar(256) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code varchar(256) NOT NULL UNIQUE,
  name varchar(256) NOT NULL,
  date_of_birth date NOT NULL,
  gender varchar(100),
  allergies text
);

CREATE TABLE IF NOT EXISTS scenario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES instructor(id),
  title varchar(256) NOT NULL,
  summary text,
  private boolean NOT NULL DEFAULT false,
  current_issue_name varchar(256),
  current_issue text,
  patient_knowledge text,
  teaching_prompts text,
  appended_patient_info jsonb,
  emotive_state text,
  patient_id uuid NOT NULL REFERENCES patient(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scenario_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES scenario(id),
  instructor_id uuid NOT NULL REFERENCES instructor(id),
  audience_name varchar(256) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  completion_count integer NOT NULL DEFAULT 0 CHECK (completion_count >= 0)
);

CREATE TABLE IF NOT EXISTS medication_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  name varchar(256) NOT NULL,
  qr_code varchar(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS medication_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  medication_type_id uuid NOT NULL REFERENCES medication_type(id),
  dose varchar(256) NOT NULL,
  route varchar(100) NOT NULL,
  form varchar(100) NOT NULL,
  frequency varchar(100) NOT NULL,
  indication text NOT NULL,
  ordered_at_days_offset integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
  is_expected boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS mar_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  medication_name varchar(256) NOT NULL,
  dose varchar(256) NOT NULL,
  route varchar(100) NOT NULL,
  time_offset_minutes integer NOT NULL,
  site varchar(256) NOT NULL,
  initials varchar(20) NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS attempt (
  id uuid PRIMARY KEY,
  scenario_link_id uuid NOT NULL REFERENCES scenario_link(id),
  score numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  time_spent_seconds integer NOT NULL CHECK (time_spent_seconds >= 0),
  submitted_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS scenario_created_by_idx ON scenario(created_by);
CREATE INDEX IF NOT EXISTS scenario_link_scenario_idx ON scenario_link(scenario_id);
CREATE INDEX IF NOT EXISTS attempt_link_idx ON attempt(scenario_link_id);

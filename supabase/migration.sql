-- Lead Intelligence System — Supabase Migration
-- Run this in the same Supabase project as adamsverse

-- Opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_name     TEXT NOT NULL,
  source_url      TEXT,
  vertical        TEXT NOT NULL,
  metro           TEXT NOT NULL,

  -- Business identity
  business_name   TEXT NOT NULL,
  owner_name      TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  address         TEXT,
  license_number  TEXT,
  license_status  TEXT,
  specialties     JSONB DEFAULT '[]',

  -- Qualification signals
  signals         JSONB NOT NULL DEFAULT '{}',

  -- Qualification
  opportunity_score   INTEGER,
  opportunity_type    TEXT,
  score_reasons       JSONB DEFAULT '[]',
  qualified           BOOLEAN DEFAULT false,

  -- Demo
  demo_package_slug   TEXT,
  demo_config         JSONB,
  demo_generated_at   TIMESTAMPTZ,

  -- Outreach
  outreach_status     TEXT DEFAULT 'pending',
  outreach_content    JSONB,
  last_contacted_at   TIMESTAMPTZ,

  -- Pipeline state
  status              TEXT DEFAULT 'discovered',
  disqualify_reason   TEXT,

  -- Meta
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_vertical_metro ON opportunities(vertical, metro);
CREATE INDEX IF NOT EXISTS idx_opp_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opp_score ON opportunities(opportunity_score DESC) WHERE qualified = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_dedup ON opportunities(business_name, metro, vertical);

-- Lead sources registry
CREATE TABLE IF NOT EXISTS lead_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  vertical      TEXT NOT NULL,
  metro         TEXT,
  base_url      TEXT NOT NULL,
  scraper_key   TEXT NOT NULL,
  last_run_at   TIMESTAMPTZ,
  record_count  INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'active',
  tos_reviewed  BOOLEAN DEFAULT false,
  config        JSONB DEFAULT '{}'
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Agent roles (orchestrator agent registry)
CREATE TABLE IF NOT EXISTS agent_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  role_type       TEXT NOT NULL,
  description     TEXT,
  system_prompt   TEXT,
  input_schema    JSONB DEFAULT '{}',
  output_schema   JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'active',
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Pipeline runs
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status          TEXT DEFAULT 'pending',
  request_summary TEXT,
  tasks           JSONB DEFAULT '[]',
  result          JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Tasks (individual pipeline steps)
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id     UUID REFERENCES pipeline_runs(id),
  name            TEXT NOT NULL,
  agent_role_id   UUID REFERENCES agent_roles(id),
  agent_role_name TEXT,
  status          TEXT DEFAULT 'pending',
  input           JSONB DEFAULT '{}',
  output          JSONB,
  depends_on      JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Artifacts (generated content)
CREATE TABLE IF NOT EXISTS artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id),
  pipeline_id     UUID REFERENCES pipeline_runs(id),
  artifact_type   TEXT NOT NULL,
  content         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

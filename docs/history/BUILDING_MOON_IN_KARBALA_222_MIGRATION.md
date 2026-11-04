# Building MOON in Karbala 222 - PostgreSQL Triple Store Migration

## PASTE THIS SQL INTO YOUR SUPABASE SQL EDITOR

**Go to:** https://supabase.com/dashboard > Your Project > SQL Editor > New query

**Paste the entire block below and click "Run".**

```sql
-- ============================================================
-- MOON SAND V2 - PostgreSQL Schema with RDF Triple Store
-- ============================================================
-- This replaces the single kv_store_49c0e13c with 14 proper tables
-- Run this ONCE in your Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ============================================================
-- 1. INSTITUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS institutions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  namespace     TEXT NOT NULL UNIQUE,
  base_uri      TEXT NOT NULL,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_email TEXT,
  org_type      TEXT CHECK (org_type IN ('library','archive','museum','university','research')),
  country       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institutions_namespace ON institutions(namespace);


-- ============================================================
-- 2. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS moon_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  roles           TEXT[] NOT NULL DEFAULT '{"viewer"}',
  permissions     TEXT[] NOT NULL DEFAULT '{}',
  password_hash   TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moon_users_institution ON moon_users(institution_id);
CREATE INDEX IF NOT EXISTS idx_moon_users_email ON moon_users(email);


-- ============================================================
-- 3. BIBFRAME RECORDS (Core)
-- ============================================================
CREATE TABLE IF NOT EXISTS records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uri             TEXT NOT NULL UNIQUE,
  work_uri        TEXT,
  instance_uri    TEXT,
  item_uri        TEXT,
  title           TEXT NOT NULL,
  resource_type   TEXT NOT NULL DEFAULT 'Work',
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','validated','published','archived')),
  graph_jsonld    JSONB NOT NULL,
  checksum        TEXT NOT NULL DEFAULT '',
  locked          BOOLEAN NOT NULL DEFAULT FALSE,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_by      TEXT,
  last_modified_by TEXT,
  published_by    TEXT,
  version_number  INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  deleted_by      TEXT,
  deleted_reason  TEXT,
  cataloger       TEXT,
  resource_type_label TEXT,
  cover_image     TEXT,
  jcricket        JSONB
);

CREATE INDEX IF NOT EXISTS idx_records_status ON records(status) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_records_resource_type ON records(resource_type) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_records_institution ON records(institution_id) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_records_created_by ON records(created_by);
CREATE INDEX IF NOT EXISTS idx_records_work_uri ON records(work_uri) WHERE work_uri IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_instance_uri ON records(instance_uri) WHERE instance_uri IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_title_trgm ON records USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_records_updated ON records(updated_at DESC) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_records_checksum ON records(checksum);
CREATE INDEX IF NOT EXISTS idx_records_graph_gin ON records USING gin(graph_jsonld jsonb_path_ops);


-- ============================================================
-- 4. RECORD VERSIONS (Immutable History)
-- ============================================================
CREATE TABLE IF NOT EXISTS record_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id       UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  graph_snapshot  JSONB NOT NULL,
  checksum        TEXT NOT NULL,
  validation_result JSONB,
  named_graph_uri TEXT,
  comment         TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (record_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_versions_record ON record_versions(record_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_versions_checksum ON record_versions(checksum);


-- ============================================================
-- 5. RDF TRIPLE STORE
-- ============================================================
CREATE TABLE IF NOT EXISTS triples (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject         TEXT NOT NULL,
  predicate       TEXT NOT NULL,
  object_value    TEXT NOT NULL,
  object_type     TEXT NOT NULL DEFAULT 'uri'
                  CHECK (object_type IN ('uri', 'literal', 'blank')),
  object_lang     TEXT,
  object_datatype TEXT,
  graph_uri       TEXT NOT NULL,
  record_id       UUID REFERENCES records(id) ON DELETE CASCADE,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triples_subject    ON triples(subject);
CREATE INDEX IF NOT EXISTS idx_triples_predicate  ON triples(predicate);
CREATE INDEX IF NOT EXISTS idx_triples_object     ON triples(object_value) WHERE object_type = 'uri';
CREATE INDEX IF NOT EXISTS idx_triples_graph      ON triples(graph_uri);
CREATE INDEX IF NOT EXISTS idx_triples_sp   ON triples(subject, predicate);
CREATE INDEX IF NOT EXISTS idx_triples_po   ON triples(predicate, object_value);
CREATE INDEX IF NOT EXISTS idx_triples_spo  ON triples(subject, predicate, object_value);
CREATE INDEX IF NOT EXISTS idx_triples_gsp  ON triples(graph_uri, subject, predicate);
CREATE INDEX IF NOT EXISTS idx_triples_gpo  ON triples(graph_uri, predicate, object_value);
CREATE INDEX IF NOT EXISTS idx_triples_record ON triples(record_id);
CREATE INDEX IF NOT EXISTS idx_triples_institution ON triples(institution_id);
CREATE INDEX IF NOT EXISTS idx_triples_literal_trgm ON triples USING gin(object_value gin_trgm_ops) WHERE object_type = 'literal';
CREATE INDEX IF NOT EXISTS idx_triples_rdf_type ON triples(object_value) WHERE predicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';


-- ============================================================
-- 6. NAMED GRAPHS
-- ============================================================
CREATE TABLE IF NOT EXISTS named_graphs (
  uri             TEXT PRIMARY KEY,
  record_id       UUID REFERENCES records(id) ON DELETE CASCADE,
  version_number  INTEGER,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  triple_count    INTEGER NOT NULL DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_named_graphs_record ON named_graphs(record_id);


-- ============================================================
-- 7. NAMESPACES / PREFIXES
-- ============================================================
CREATE TABLE IF NOT EXISTS namespaces (
  prefix          TEXT PRIMARY KEY,
  uri             TEXT NOT NULL UNIQUE,
  description     TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO namespaces (prefix, uri, description, is_default) VALUES
  ('bf',      'http://id.loc.gov/ontologies/bibframe/',        'BIBFRAME 2.0', TRUE),
  ('bflc',    'http://id.loc.gov/ontologies/bflc/',            'BIBFRAME LC Extensions', TRUE),
  ('rdf',     'http://www.w3.org/1999/02/22-rdf-syntax-ns#',   'RDF', TRUE),
  ('rdfs',    'http://www.w3.org/2000/01/rdf-schema#',          'RDF Schema', TRUE),
  ('owl',     'http://www.w3.org/2002/07/owl#',                 'OWL', TRUE),
  ('xsd',     'http://www.w3.org/2001/XMLSchema#',              'XML Schema', TRUE),
  ('skos',    'http://www.w3.org/2004/02/skos/core#',           'SKOS', TRUE),
  ('dcterms', 'http://purl.org/dc/terms/',                      'Dublin Core', TRUE),
  ('madsrdf', 'http://www.loc.gov/mads/rdf/v1#',               'MADS/RDF', TRUE),
  ('schema',  'http://schema.org/',                             'Schema.org', TRUE),
  ('foaf',    'http://xmlns.com/foaf/0.1/',                     'FOAF', FALSE)
ON CONFLICT (prefix) DO NOTHING;


-- ============================================================
-- 8. AUTHORITY RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS authorities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uri             TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL CHECK (type IN ('Person','Organization','Topic','Place','Work','GenreForm')),
  label           TEXT NOT NULL,
  alternate_labels TEXT[],
  viaf_uri        TEXT,
  lc_uri          TEXT,
  wikidata_uri    TEXT,
  isni            TEXT,
  orcid           TEXT,
  raw_data        JSONB,
  source          TEXT DEFAULT 'local' CHECK (source IN ('local','imported','external')),
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_authorities_type ON authorities(type);
CREATE INDEX IF NOT EXISTS idx_authorities_label_trgm ON authorities USING gin(label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_authorities_viaf ON authorities(viaf_uri) WHERE viaf_uri IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_authorities_lc ON authorities(lc_uri) WHERE lc_uri IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_authorities_wikidata ON authorities(wikidata_uri) WHERE wikidata_uri IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_authorities_institution ON authorities(institution_id);


-- ============================================================
-- 9. AUDIT LOG (Immutable, Append-Only)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL DEFAULT 'record',
  entity_id       TEXT NOT NULL,
  version_number  INTEGER,
  user_id         TEXT,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  user_agent      TEXT,
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_institution ON audit_log(institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_not_archived ON audit_log(entity_id, timestamp DESC) WHERE NOT archived;


-- ============================================================
-- 10. FIELD TEMPLATES (BlueMoon)
-- ============================================================
CREATE TABLE IF NOT EXISTS field_templates (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  base_template   TEXT,
  hidden_fields   TEXT[] NOT NULL DEFAULT '{}',
  all_fields      TEXT[] NOT NULL DEFAULT '{}',
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 11. AI SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         TEXT,
  record_id       UUID REFERENCES records(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL,
  model           TEXT,
  task_type       TEXT,
  prompt          TEXT,
  response        TEXT,
  tokens_used     INTEGER,
  latency_ms      INTEGER,
  status          TEXT DEFAULT 'success' CHECK (status IN ('success','error','timeout','fallback')),
  error_message   TEXT,
  routing_decision JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_provider ON ai_sessions(provider);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_record ON ai_sessions(record_id);


-- ============================================================
-- 12. DISCOVERY CACHE
-- ============================================================
CREATE TABLE IF NOT EXISTS discovery_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query           TEXT NOT NULL,
  provider        TEXT NOT NULL,
  results         JSONB NOT NULL,
  result_count    INTEGER NOT NULL DEFAULT 0,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (query, provider)
);

CREATE INDEX IF NOT EXISTS idx_discovery_cache_query ON discovery_cache(query, provider);
CREATE INDEX IF NOT EXISTS idx_discovery_cache_expires ON discovery_cache(expires_at);


-- ============================================================
-- 13. AI ROUTER HEALTH
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_provider_health (
  provider        TEXT PRIMARY KEY,
  available       BOOLEAN NOT NULL DEFAULT FALSE,
  model           TEXT,
  circuit_breaker_open BOOLEAN NOT NULL DEFAULT FALSE,
  circuit_breaker_reset_at TIMESTAMPTZ,
  last_call_at    TIMESTAMPTZ,
  last_call_success BOOLEAN DEFAULT TRUE,
  avg_latency_ms  REAL NOT NULL DEFAULT 0,
  total_calls     INTEGER NOT NULL DEFAULT 0,
  success_count   INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  consecutive_errors INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ai_provider_health (provider, model) VALUES
  ('openai', 'gpt-4o-mini'),
  ('gemini', 'gemini-1.5-flash'),
  ('llama', 'llama-3.3-70b-versatile')
ON CONFLICT (provider) DO NOTHING;


-- ============================================================
-- 14. GENERIC KV (backward-compat for misc data)
-- ============================================================
CREATE TABLE IF NOT EXISTS moon_kv (
  key   TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_records_updated BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION update_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_authorities_updated BEFORE UPDATE ON authorities FOR EACH ROW EXECUTE FUNCTION update_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_institutions_updated BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_moon_users_updated BEFORE UPDATE ON moon_users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON field_templates FOR EACH ROW EXECUTE FUNCTION update_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- ROW LEVEL SECURITY (allow service_role full access)
-- ============================================================

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE triples ENABLE ROW LEVEL SECURITY;
ALTER TABLE named_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moon_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_provider_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE moon_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE namespaces ENABLE ROW LEVEL SECURITY;

-- Allow service_role key full access to all tables
CREATE POLICY "Service role full access" ON records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON record_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON triples FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON named_graphs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON authorities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON institutions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON moon_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON field_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON discovery_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON ai_provider_health FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON moon_kv FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON namespaces FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- DONE! Verify by checking the Table Editor in Supabase.
-- You should see 14 new tables.
-- ============================================================
```

## After Running the SQL

1. Go to **Table Editor** in Supabase
2. Verify you see these 14 tables:
   - `institutions`
   - `moon_users`
   - `records`
   - `record_versions`
   - `triples`
   - `named_graphs`
   - `namespaces`
   - `authorities`
   - `audit_log`
   - `field_templates`
   - `ai_sessions`
   - `discovery_cache`
   - `ai_provider_health`
   - `moon_kv`
3. The old `kv_store_49c0e13c` table is **kept** for backward compatibility
4. Now redeploy the backend: `supabase functions deploy server --no-verify-jwt`

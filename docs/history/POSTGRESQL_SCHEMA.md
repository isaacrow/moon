# MOON SAND V2 - PostgreSQL Schema with RDF Triple Storing

> Replaces the `kv_store_49c0e13c` single-table design with a production relational schema.
> Designed from the actual data models in: `recordService.tsx`, `moonRecords.tsx`, `authorities.tsx`,
> `versioning.tsx`, `auditLog.tsx`, `multiTenant.tsx`, `dataIsolation.tsx`, `tripleStore.tsx`,
> `canonicalJsonLd.tsx`, `shaclValidator.tsx`, and `BlueMoon.tsx` field templates.

---

## Table of Contents

1. [Current KV Key Patterns (What We Are Replacing)](#1-current-kv-key-patterns)
2. [Complete PostgreSQL Schema](#2-complete-postgresql-schema)
3. [Triple Store Tables & Indexes](#3-triple-store-tables--indexes)
4. [Migration Script (KV to Relational)](#4-migration-script)
5. [Query Examples (Replacing SPARQL-Like Patterns)](#5-query-examples)
6. [Server Code Changes (KV to SQL)](#6-server-code-changes)

---

## 1. Current KV Key Patterns

These are all the key patterns currently stored in `kv_store_49c0e13c`:

| Key Pattern | Source File | Data Shape |
|---|---|---|
| `record:bibframe:record:{uuid}` | `recordService.tsx` | `RecordMetadata` (JSON string) |
| `record:index:{id}:title` | `recordService.tsx` | Title string |
| `record:index:{id}:type` | `recordService.tsx` | Resource type string |
| `record:index:{id}:status` | `recordService.tsx` | Status string |
| `version:{recordId}:v{n}` | `recordService.tsx` | `RecordVersion` (JSON string) |
| `moon:record:{uuid}` | `moonRecords.tsx` | `MoonRecord` (JSON string) |
| `moon:authority:{uuid}` | `authorities.tsx` | `Authority` (JSON string) |
| `moon:authority:search:{type}:{query}` | `authorities.tsx` | Search cache |
| `moon:version:{type}:{id}-v{n}` | `versioning.tsx` | `Version<T>` (JSON string) |
| `moon:version:index:{type}:{id}:latest` | `versioning.tsx` | Version number string |
| `moon:audit:{uuid}` | `versioning.tsx` | `AuditLog` (JSON string) |
| `moon:audit:index:{timestamp}` | `versioning.tsx` | Audit ID reference |
| `audit:{recordId}:{timestamp}:{uuid}` | `auditLog.tsx` | `AuditLogEntry` (JSON string) |
| `audit:index:{recordId}:{timestamp}` | `auditLog.tsx` | Audit ID reference |
| `audit:archive:{...}` | `auditLog.tsx` | Archived audit entries |
| `moon:{institutionId}:record:{id}` | `dataIsolation.tsx` | `IsolatedRecord` (JSON string) |
| `moon:institution:{id}` | `multiTenant.tsx` | `Institution` (JSON string) |
| `moon:user:{id}` | `multiTenant.tsx` | `User` (JSON string) |
| `field-templates-all` | `BlueMoon.tsx` | Field templates array |

---

## 2. Complete PostgreSQL Schema

```sql
-- ============================================================
-- MOON SAND V2 - Production PostgreSQL Schema
-- ============================================================
-- Run this in your PostgreSQL database (Supabase SQL Editor,
-- psql, pgAdmin, or any migration tool)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- For fuzzy text search


-- ============================================================
-- 1. INSTITUTIONS (Multi-Tenant)
-- Source: multiTenant.tsx → Institution interface
-- ============================================================
CREATE TABLE institutions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  namespace     TEXT NOT NULL UNIQUE,           -- e.g. 'https://institution.org'
  base_uri      TEXT NOT NULL,                  -- Resource URI base
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- settings contains:
  --   cataloging_rules: 'RDA' | 'AACR2' | 'custom'
  --   default_language: string
  --   bibframe_version: '2.0' | '3.0'
  --   enable_authorities: boolean
  --   enable_versioning: boolean
  --   triple_store_config: { type, endpoint, auth, ... }
  contact_email TEXT,
  org_type      TEXT CHECK (org_type IN ('library','archive','museum','university','research')),
  country       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_institutions_namespace ON institutions(namespace);


-- ============================================================
-- 2. USERS
-- Source: multiTenant.tsx → User interface
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  roles           TEXT[] NOT NULL DEFAULT '{"viewer"}',
  -- roles: 'admin','cataloger','authority_manager','graph_admin','sparql_admin','viewer'
  permissions     TEXT[] NOT NULL DEFAULT '{}',
  -- permissions: 'records.create','records.edit','records.delete','records.publish',
  --              'authorities.create','authorities.edit','authorities.merge',
  --              'authorities.delete','sparql.query','sparql.update',
  --              'triplestore.sync','triplestore.config','admin.users',
  --              'admin.settings','admin.audit'
  password_hash   TEXT,                         -- bcrypt hash
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_institution ON users(institution_id);
CREATE INDEX idx_users_email ON users(email);


-- ============================================================
-- 3. BIBFRAME RECORDS (Core)
-- Source: recordService.tsx → RecordMetadata
--       + moonRecords.tsx → MoonRecord
-- ============================================================
CREATE TABLE records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- External-facing URIs
  uri             TEXT NOT NULL UNIQUE,           -- e.g. 'https://moon.org/record/{id}'
  work_uri        TEXT,                           -- Extracted bf:Work @id
  instance_uri    TEXT,                           -- Extracted bf:Instance @id
  item_uri        TEXT,                           -- Extracted bf:Item @id

  -- Core fields
  title           TEXT NOT NULL,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('Work','Instance','Item')),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','validated','published','archived')),

  -- The full JSON-LD document (canonical form from canonicalJsonLd.tsx)
  graph_jsonld    JSONB NOT NULL,                 -- Complete @context + @graph

  -- Integrity
  checksum        TEXT NOT NULL,                  -- SHA-256 of canonical JSON-LD
  locked          BOOLEAN NOT NULL DEFAULT FALSE, -- Locked when published

  -- Ownership / multi-tenant
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  last_modified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_by    UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Versioning
  version_number  INTEGER NOT NULL DEFAULT 1,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,

  -- Soft delete
  deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_reason  TEXT
);

-- Performance indexes
CREATE INDEX idx_records_status ON records(status) WHERE NOT deleted;
CREATE INDEX idx_records_resource_type ON records(resource_type) WHERE NOT deleted;
CREATE INDEX idx_records_institution ON records(institution_id) WHERE NOT deleted;
CREATE INDEX idx_records_created_by ON records(created_by);
CREATE INDEX idx_records_work_uri ON records(work_uri) WHERE work_uri IS NOT NULL;
CREATE INDEX idx_records_instance_uri ON records(instance_uri) WHERE instance_uri IS NOT NULL;
CREATE INDEX idx_records_title_trgm ON records USING gin(title gin_trgm_ops);
CREATE INDEX idx_records_updated ON records(updated_at DESC) WHERE NOT deleted;
CREATE INDEX idx_records_checksum ON records(checksum);

-- Full-text search on JSON-LD content
CREATE INDEX idx_records_graph_gin ON records USING gin(graph_jsonld jsonb_path_ops);


-- ============================================================
-- 4. RECORD VERSIONS (Immutable History)
-- Source: recordService.tsx → RecordVersion
--       + versioning.tsx → Version<T>
-- ============================================================
CREATE TABLE record_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id       UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  
  -- Snapshot of the canonical JSON-LD at this version
  graph_snapshot  JSONB NOT NULL,
  checksum        TEXT NOT NULL,                  -- SHA-256 of this snapshot

  -- Validation result tied to this version
  validation_result JSONB,
  -- {
  --   valid: boolean,
  --   errors: string[],
  --   timestamp: string,
  --   checksum_validated: string  -- ties validation to specific checksum
  -- }

  -- Named graph URI for triple store integration
  named_graph_uri TEXT,                           -- e.g. 'https://moon.org/graph/{id}/v{n}'

  -- Metadata
  comment         TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique version per record
  UNIQUE (record_id, version_number)
);

CREATE INDEX idx_versions_record ON record_versions(record_id, version_number DESC);
CREATE INDEX idx_versions_checksum ON record_versions(checksum);


-- ============================================================
-- 5. RDF TRIPLE STORE (The Heart of Linked Data)
-- Source: tripleStore.tsx, graphBuilder.tsx, moonRecords.tsx
--
-- This table stores individual RDF triples extracted from
-- JSON-LD documents. It enables SPARQL-like querying directly
-- in PostgreSQL without needing Fuseki/Blazegraph.
-- ============================================================
CREATE TABLE triples (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- The RDF triple (SPO)
  subject         TEXT NOT NULL,                  -- URI or blank node  e.g. 'http://example.org/work/123'
  predicate       TEXT NOT NULL,                  -- URI               e.g. 'http://id.loc.gov/ontologies/bibframe/title'
  object_value    TEXT NOT NULL,                  -- URI or literal value
  object_type     TEXT NOT NULL DEFAULT 'uri'
                  CHECK (object_type IN ('uri', 'literal', 'blank')),

  -- Literal metadata (when object_type = 'literal')
  object_lang     TEXT,                           -- Language tag       e.g. 'ar', 'en'
  object_datatype TEXT,                           -- XSD datatype URI   e.g. 'xsd:string', 'xsd:date'

  -- Named Graph (QUAD) - which document/version owns this triple
  graph_uri       TEXT NOT NULL,                  -- e.g. 'https://moon.org/record/{id}'
  
  -- Source tracking
  record_id       UUID REFERENCES records(id) ON DELETE CASCADE,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === CRITICAL INDEXES FOR TRIPLE PATTERN MATCHING ===
-- These mirror how a native triple store indexes SPO patterns

-- Single-field lookups
CREATE INDEX idx_triples_subject    ON triples(subject);
CREATE INDEX idx_triples_predicate  ON triples(predicate);
CREATE INDEX idx_triples_object     ON triples(object_value) WHERE object_type = 'uri';
CREATE INDEX idx_triples_graph      ON triples(graph_uri);

-- Composite indexes for common SPARQL patterns
CREATE INDEX idx_triples_sp   ON triples(subject, predicate);          -- ?s ?p ?o  with known S,P
CREATE INDEX idx_triples_po   ON triples(predicate, object_value);     -- ?s ?p ?o  with known P,O
CREATE INDEX idx_triples_spo  ON triples(subject, predicate, object_value);  -- Full triple lookup
CREATE INDEX idx_triples_gsp  ON triples(graph_uri, subject, predicate);     -- Named graph queries
CREATE INDEX idx_triples_gpo  ON triples(graph_uri, predicate, object_value);

-- Record association
CREATE INDEX idx_triples_record ON triples(record_id);
CREATE INDEX idx_triples_institution ON triples(institution_id);

-- Literal text search (for FILTER(CONTAINS(...)))
CREATE INDEX idx_triples_literal_trgm ON triples USING gin(object_value gin_trgm_ops)
  WHERE object_type = 'literal';

-- Partial index for type triples (most common query pattern)
CREATE INDEX idx_triples_rdf_type ON triples(object_value)
  WHERE predicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';


-- ============================================================
-- 6. NAMED GRAPHS (Graph Management)
-- Tracks which named graphs exist and their metadata
-- ============================================================
CREATE TABLE named_graphs (
  uri             TEXT PRIMARY KEY,               -- Graph URI
  record_id       UUID REFERENCES records(id) ON DELETE CASCADE,
  version_number  INTEGER,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  triple_count    INTEGER NOT NULL DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_named_graphs_record ON named_graphs(record_id);


-- ============================================================
-- 7. NAMESPACES / PREFIXES
-- Stores prefix mappings for URI compression (used in Turtle export)
-- ============================================================
CREATE TABLE namespaces (
  prefix          TEXT PRIMARY KEY,               -- e.g. 'bf'
  uri             TEXT NOT NULL UNIQUE,            -- e.g. 'http://id.loc.gov/ontologies/bibframe/'
  description     TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed with BIBFRAME defaults
INSERT INTO namespaces (prefix, uri, description, is_default) VALUES
  ('bf',      'http://id.loc.gov/ontologies/bibframe/',        'BIBFRAME 2.0', TRUE),
  ('bflc',    'http://id.loc.gov/ontologies/bflc/',            'BIBFRAME LC Extensions', TRUE),
  ('rdf',     'http://www.w3.org/1999/02/22-rdf-syntax-ns#',   'RDF', TRUE),
  ('rdfs',    'http://www.w3.org/2000/01/rdf-schema#',          'RDF Schema', TRUE),
  ('owl',     'http://www.w3.org/2002/07/owl#',                 'OWL', TRUE),
  ('xsd',     'http://www.w3.org/2001/XMLSchema#',              'XML Schema Datatypes', TRUE),
  ('skos',    'http://www.w3.org/2004/02/skos/core#',           'SKOS', TRUE),
  ('dcterms', 'http://purl.org/dc/terms/',                      'Dublin Core Terms', TRUE),
  ('madsrdf', 'http://www.loc.gov/mads/rdf/v1#',               'MADS/RDF', TRUE),
  ('schema',  'http://schema.org/',                             'Schema.org', TRUE),
  ('foaf',    'http://xmlns.com/foaf/0.1/',                     'FOAF', FALSE)
ON CONFLICT (prefix) DO NOTHING;


-- ============================================================
-- 8. AUTHORITY RECORDS
-- Source: authorities.tsx → Authority
-- ============================================================
CREATE TABLE authorities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uri             TEXT NOT NULL UNIQUE,           -- e.g. 'https://moon.org/authority/person/{id}'
  type            TEXT NOT NULL CHECK (type IN ('Person','Organization','Topic','Place','Work','GenreForm')),
  label           TEXT NOT NULL,
  alternate_labels TEXT[],

  -- External authority links
  viaf_uri        TEXT,                           -- VIAF URI
  lc_uri          TEXT,                           -- Library of Congress URI
  wikidata_uri    TEXT,                           -- Wikidata URI
  isni            TEXT,                           -- ISNI
  orcid           TEXT,                           -- ORCID

  -- Full authority record in JSON-LD
  raw_data        JSONB,

  -- Metadata
  source          TEXT DEFAULT 'local' CHECK (source IN ('local','imported','external')),
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count     INTEGER NOT NULL DEFAULT 0,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_authorities_type ON authorities(type);
CREATE INDEX idx_authorities_label_trgm ON authorities USING gin(label gin_trgm_ops);
CREATE INDEX idx_authorities_alt_labels ON authorities USING gin(alternate_labels);
CREATE INDEX idx_authorities_viaf ON authorities(viaf_uri) WHERE viaf_uri IS NOT NULL;
CREATE INDEX idx_authorities_lc ON authorities(lc_uri) WHERE lc_uri IS NOT NULL;
CREATE INDEX idx_authorities_wikidata ON authorities(wikidata_uri) WHERE wikidata_uri IS NOT NULL;
CREATE INDEX idx_authorities_institution ON authorities(institution_id);


-- ============================================================
-- 9. AUTHORITY VERSIONS
-- Immutable version history for authority records
-- ============================================================
CREATE TABLE authority_versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  authority_id    UUID NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  data_snapshot   JSONB NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('create','update','delete','merge')),
  change_description TEXT,
  named_graph_uri TEXT,
  parent_version  INTEGER,
  
  -- Merge tracking
  merge_target_id UUID REFERENCES authorities(id),
  merge_source_ids UUID[],

  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (authority_id, version_number)
);

CREATE INDEX idx_auth_versions_authority ON authority_versions(authority_id, version_number DESC);


-- ============================================================
-- 10. AUDIT LOG (Immutable, Append-Only)
-- Source: auditLog.tsx → AuditLogEntry
--       + versioning.tsx → AuditLog
-- ============================================================
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  action          TEXT NOT NULL,
  -- Actions: 'record.created','record.updated','record.deleted','record.archived',
  --          'record.published','record.unpublished','record.corrupted',
  --          'version.created','version.restored',
  --          'export.jsonld','export.turtle','export.rdfxml','export.marc',
  --          'validation.passed','validation.failed',
  --          'lock.acquired','lock.released',
  --          'authority.created','authority.updated','authority.deleted','authority.merge'

  -- What was affected
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('record','authority','user','institution')),
  entity_id       TEXT NOT NULL,                  -- UUID of the record/authority/etc
  version_number  INTEGER,

  -- Who did it
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,

  -- What changed
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- metadata contains: checksum, validation_errors, changes, export_format, etc.

  -- Request context
  ip_address      INET,
  user_agent      TEXT,

  -- Archive tracking
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at     TIMESTAMPTZ
);

-- IMPORTANT: This table is append-only. NEVER UPDATE or DELETE rows.
-- Use a trigger or policy to enforce this:
-- REVOKE UPDATE, DELETE ON audit_log FROM app_role;

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_institution ON audit_log(institution_id);
CREATE INDEX idx_audit_not_archived ON audit_log(entity_id, timestamp DESC) WHERE NOT archived;


-- ============================================================
-- 11. FIELD TEMPLATES (BlueMoon Customization)
-- Source: BlueMoon.tsx field templates
-- ============================================================
CREATE TABLE field_templates (
  id              TEXT PRIMARY KEY,               -- Template ID (user-defined slug)
  name            TEXT NOT NULL,
  base_template   TEXT,                           -- Base template this extends
  hidden_fields   TEXT[] NOT NULL DEFAULT '{}',   -- Fields hidden in this template
  all_fields      TEXT[] NOT NULL DEFAULT '{}',   -- All available fields

  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_field_templates_institution ON field_templates(institution_id);


-- ============================================================
-- 12. SHACL SHAPES (Validation Rules)
-- Source: shaclShapes.tsx, shaclValidator.tsx
-- ============================================================
CREATE TABLE shacl_shapes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  target_class    TEXT NOT NULL,                  -- e.g. 'bf:Work'
  shape_turtle    TEXT NOT NULL,                  -- SHACL shape in Turtle format
  shape_jsonld    JSONB,                          -- Same shape as JSON-LD
  
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shacl_target ON shacl_shapes(target_class) WHERE active;


-- ============================================================
-- 13. DISCOVERY CACHE (Federated Search Results)
-- Caches results from the 19 federated sources
-- ============================================================
CREATE TABLE discovery_cache (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query           TEXT NOT NULL,
  provider        TEXT NOT NULL,                  -- 'loc','viaf','wikidata','europeana', etc.
  results         JSONB NOT NULL,
  result_count    INTEGER NOT NULL DEFAULT 0,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),

  UNIQUE (query, provider)
);

CREATE INDEX idx_discovery_cache_query ON discovery_cache(query, provider);
CREATE INDEX idx_discovery_cache_expires ON discovery_cache(expires_at);


-- ============================================================
-- 14. AI ENGINE SESSIONS
-- Source: aiEngine.tsx (5-phase AI engine)
-- ============================================================
CREATE TABLE ai_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  record_id       UUID REFERENCES records(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL,                  -- 'openai','gemini','llama'
  model           TEXT,
  phase           TEXT,                           -- Current AI phase
  prompt          TEXT,
  response        TEXT,
  tokens_used     INTEGER,
  latency_ms      INTEGER,
  status          TEXT DEFAULT 'success' CHECK (status IN ('success','error','timeout','fallback')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_sessions_user ON ai_sessions(user_id);
CREATE INDEX idx_ai_sessions_record ON ai_sessions(record_id);
CREATE INDEX idx_ai_sessions_provider ON ai_sessions(provider);


-- ============================================================
-- 15. KV STORE (Backward Compatibility)
-- Keep the original KV table for any remaining ad-hoc data
-- ============================================================
CREATE TABLE IF NOT EXISTS kv_store (
  key   TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_records_updated     BEFORE UPDATE ON records     FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_authorities_updated BEFORE UPDATE ON authorities FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_institutions_updated BEFORE UPDATE ON institutions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_users_updated       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_templates_updated   BEFORE UPDATE ON field_templates FOR EACH ROW EXECUTE FUNCTION update_timestamp();


-- Prevent audit log modification (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow setting archived = true
  IF TG_OP = 'UPDATE' THEN
    IF OLD.archived = FALSE AND NEW.archived = TRUE THEN
      RETURN NEW;  -- Allow archiving
    END IF;
    RAISE EXCEPTION 'Audit log entries are immutable. Only archiving is allowed.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit log entries cannot be deleted.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();


-- Auto-extract triples when a record is inserted/updated
-- This keeps the triples table in sync with the JSON-LD documents
CREATE OR REPLACE FUNCTION sync_triples_from_jsonld()
RETURNS TRIGGER AS $$
DECLARE
  graph_node JSONB;
  node_id    TEXT;
  node_type  TEXT;
  prop_key   TEXT;
  prop_val   JSONB;
  graph_uri  TEXT;
BEGIN
  graph_uri := NEW.uri;

  -- Delete old triples for this record
  DELETE FROM triples WHERE record_id = NEW.id;

  -- Delete old named graph entry
  DELETE FROM named_graphs WHERE record_id = NEW.id AND version_number IS NULL;

  -- Parse @graph array from JSON-LD
  IF NEW.graph_jsonld ? '@graph' AND jsonb_typeof(NEW.graph_jsonld->'@graph') = 'array' THEN
    FOR graph_node IN SELECT * FROM jsonb_array_elements(NEW.graph_jsonld->'@graph')
    LOOP
      node_id := graph_node->>'@id';
      IF node_id IS NULL THEN CONTINUE; END IF;

      -- Extract @type as rdf:type triple
      IF graph_node ? '@type' THEN
        IF jsonb_typeof(graph_node->'@type') = 'array' THEN
          FOR prop_val IN SELECT * FROM jsonb_array_elements(graph_node->'@type')
          LOOP
            INSERT INTO triples (subject, predicate, object_value, object_type, graph_uri, record_id, institution_id)
            VALUES (node_id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', prop_val#>>'{}', 'uri', graph_uri, NEW.id, NEW.institution_id);
          END LOOP;
        ELSE
          INSERT INTO triples (subject, predicate, object_value, object_type, graph_uri, record_id, institution_id)
          VALUES (node_id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', graph_node->>'@type', 'uri', graph_uri, NEW.id, NEW.institution_id);
        END IF;
      END IF;

      -- Extract all other properties as triples
      FOR prop_key, prop_val IN SELECT * FROM jsonb_each(graph_node)
      LOOP
        -- Skip JSON-LD keywords
        IF prop_key IN ('@id', '@type', '@context') THEN CONTINUE; END IF;

        -- Handle arrays of values
        IF jsonb_typeof(prop_val) = 'array' THEN
          FOR prop_val IN SELECT * FROM jsonb_array_elements(prop_val)
          LOOP
            PERFORM insert_triple_from_jsonld_value(node_id, prop_key, prop_val, graph_uri, NEW.id, NEW.institution_id);
          END LOOP;
        ELSE
          PERFORM insert_triple_from_jsonld_value(node_id, prop_key, prop_val, graph_uri, NEW.id, NEW.institution_id);
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  -- Update named_graphs
  INSERT INTO named_graphs (uri, record_id, institution_id, triple_count)
  VALUES (graph_uri, NEW.id, NEW.institution_id, (SELECT count(*) FROM triples WHERE record_id = NEW.id))
  ON CONFLICT (uri) DO UPDATE SET
    triple_count = EXCLUDED.triple_count,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Helper: Insert a single triple from a JSON-LD property value
CREATE OR REPLACE FUNCTION insert_triple_from_jsonld_value(
  p_subject TEXT,
  p_predicate TEXT,
  p_value JSONB,
  p_graph TEXT,
  p_record_id UUID,
  p_institution_id UUID
) RETURNS VOID AS $$
DECLARE
  obj_val  TEXT;
  obj_type TEXT;
  obj_lang TEXT;
  obj_dt   TEXT;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    RETURN;
  END IF;

  -- URI reference: {"@id": "..."}
  IF p_value ? '@id' THEN
    INSERT INTO triples (subject, predicate, object_value, object_type, graph_uri, record_id, institution_id)
    VALUES (p_subject, p_predicate, p_value->>'@id', 'uri', p_graph, p_record_id, p_institution_id);
    RETURN;
  END IF;

  -- Literal: {"@value": "...", "@language": "ar", "@type": "xsd:date"}
  IF p_value ? '@value' THEN
    obj_val  := p_value->>'@value';
    obj_lang := p_value->>'@language';
    obj_dt   := p_value->>'@type';
    INSERT INTO triples (subject, predicate, object_value, object_type, object_lang, object_datatype, graph_uri, record_id, institution_id)
    VALUES (p_subject, p_predicate, obj_val, 'literal', obj_lang, obj_dt, p_graph, p_record_id, p_institution_id);
    RETURN;
  END IF;

  -- Plain string/number (shouldn't happen in canonical JSON-LD but handle gracefully)
  IF jsonb_typeof(p_value) IN ('string', 'number', 'boolean') THEN
    INSERT INTO triples (subject, predicate, object_value, object_type, graph_uri, record_id, institution_id)
    VALUES (p_subject, p_predicate, p_value#>>'{}', 'literal', p_graph, p_record_id, p_institution_id);
    RETURN;
  END IF;

  -- Nested object without @id or @value: generate blank node
  IF jsonb_typeof(p_value) = 'object' THEN
    INSERT INTO triples (subject, predicate, object_value, object_type, graph_uri, record_id, institution_id)
    VALUES (p_subject, p_predicate, '_:bnode_' || md5(p_value::text), 'blank', p_graph, p_record_id, p_institution_id);
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Attach trigger to records table
CREATE TRIGGER trg_records_sync_triples
  AFTER INSERT OR UPDATE OF graph_jsonld ON records
  FOR EACH ROW EXECUTE FUNCTION sync_triples_from_jsonld();


-- ============================================================
-- ROW-LEVEL SECURITY (Multi-Tenant Isolation)
-- Source: dataIsolation.tsx
-- ============================================================

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE triples ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_templates ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only see records from their institution
CREATE POLICY records_institution_isolation ON records
  USING (
    institution_id = current_setting('app.institution_id', true)::uuid
    OR current_setting('app.is_admin', true) = 'true'
  );

CREATE POLICY authorities_institution_isolation ON authorities
  USING (
    institution_id = current_setting('app.institution_id', true)::uuid
    OR current_setting('app.is_admin', true) = 'true'
    OR institution_id IS NULL  -- Shared authorities are visible to all
  );

CREATE POLICY triples_institution_isolation ON triples
  USING (
    institution_id = current_setting('app.institution_id', true)::uuid
    OR current_setting('app.is_admin', true) = 'true'
  );


-- ============================================================
-- VIEWS (Convenience)
-- ============================================================

-- All Works with their titles and authors
CREATE VIEW v_bibframe_works AS
SELECT
  r.id,
  r.uri,
  r.title,
  r.status,
  r.version_number,
  r.created_at,
  r.updated_at,
  i.name AS institution_name,
  u.name AS created_by_name,
  (SELECT count(*) FROM triples t WHERE t.record_id = r.id) AS triple_count
FROM records r
LEFT JOIN institutions i ON r.institution_id = i.id
LEFT JOIN users u ON r.created_by = u.id
WHERE r.resource_type = 'Work' AND NOT r.deleted;

-- Triple count per named graph
CREATE VIEW v_graph_stats AS
SELECT
  ng.uri AS graph_uri,
  ng.triple_count,
  r.title AS record_title,
  r.status,
  i.name AS institution_name
FROM named_graphs ng
LEFT JOIN records r ON ng.record_id = r.id
LEFT JOIN institutions i ON r.institution_id = i.id
WHERE ng.status = 'active';
```

---

## 3. Triple Store Tables & Indexes - Explained

### How It Works

When a BIBFRAME record is saved (INSERT or UPDATE on `records`), the `sync_triples_from_jsonld()` trigger automatically:

1. Deletes all old triples for that record
2. Walks the `@graph` array in the JSON-LD
3. Extracts every property as an `(S, P, O)` triple
4. Stores each triple with its graph URI, language tag, and datatype
5. Updates the `named_graphs` table with the triple count

### Example: What Gets Stored

Given this JSON-LD record:
```json
{
  "@context": { "bf": "http://id.loc.gov/ontologies/bibframe/" },
  "@graph": [
    {
      "@id": "https://moon.org/record/abc",
      "@type": "bf:Work",
      "bf:title": [{ "@id": "_:t1" }],
      "bf:contribution": [{ "@id": "_:c1" }]
    },
    {
      "@id": "_:t1",
      "@type": "bf:Title",
      "bf:mainTitle": [{ "@value": "كتاب القانون في الطب", "@language": "ar" }]
    }
  ]
}
```

The `triples` table will contain:

| subject | predicate | object_value | object_type | object_lang |
|---|---|---|---|---|
| `https://moon.org/record/abc` | `rdf:type` | `bf:Work` | uri | |
| `https://moon.org/record/abc` | `bf:title` | `_:t1` | uri | |
| `https://moon.org/record/abc` | `bf:contribution` | `_:c1` | uri | |
| `_:t1` | `rdf:type` | `bf:Title` | uri | |
| `_:t1` | `bf:mainTitle` | `كتاب القانون في الطب` | literal | `ar` |

---

## 5. Query Examples (Replacing SPARQL-Like Patterns)

### List all Works (replaces `EXAMPLE_QUERIES.listWorks`)
```sql
SELECT DISTINCT t_subj.subject AS work_uri, t_title.object_value AS title
FROM triples t_subj
JOIN triples t_title ON t_subj.subject = t_title.subject
WHERE t_subj.predicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
  AND t_subj.object_value = 'bf:Work'
  AND t_title.predicate = 'http://id.loc.gov/ontologies/bibframe/mainTitle'
LIMIT 100;
```

### Find Works by Author (replaces `EXAMPLE_QUERIES.findByAuthor`)
```sql
SELECT DISTINCT
  w.subject AS work_uri,
  t.object_value AS title,
  a.object_value AS author_name
FROM triples w
-- Work -> contribution -> agent -> label
JOIN triples c ON w.subject = c.subject
  AND c.predicate = 'http://id.loc.gov/ontologies/bibframe/contribution'
JOIN triples ag ON c.object_value = ag.subject
  AND ag.predicate = 'http://id.loc.gov/ontologies/bibframe/agent'
JOIN triples a ON ag.object_value = a.subject
  AND a.predicate = 'http://www.w3.org/2000/01/rdf-schema#label'
JOIN triples t ON w.subject = t.subject
  AND t.predicate = 'http://id.loc.gov/ontologies/bibframe/mainTitle'
WHERE w.predicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
  AND w.object_value = 'bf:Work'
  AND a.object_value ILIKE '%ابن سينا%';  -- Arabic search with ILIKE
```

### Count Records by Type (replaces `EXAMPLE_QUERIES.countByType`)
```sql
SELECT object_value AS type, COUNT(DISTINCT subject) AS count
FROM triples
WHERE predicate = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
  AND object_value LIKE 'bf:%'
GROUP BY object_value
ORDER BY count DESC;
```

### Get All Triples for a Record (replaces `EXAMPLE_QUERIES.getRecordAsJsonLd`)
```sql
SELECT subject, predicate, object_value, object_type, object_lang
FROM triples
WHERE graph_uri = 'https://moon.org/record/abc'
ORDER BY subject, predicate;
```

### Full-Text Search Across All Literals
```sql
SELECT DISTINCT r.id, r.title, t.object_value AS matched_text
FROM triples t
JOIN records r ON t.record_id = r.id
WHERE t.object_type = 'literal'
  AND t.object_value ILIKE '%semantic web%'
  AND NOT r.deleted;
```

### Find All Arabic-Language Titles
```sql
SELECT t.subject AS resource_uri, t.object_value AS arabic_title
FROM triples t
WHERE t.predicate LIKE '%mainTitle%'
  AND t.object_lang = 'ar';
```

### SPARQL-style CONSTRUCT (rebuild JSON-LD from triples)
```sql
SELECT jsonb_build_object(
  '@context', (SELECT jsonb_object_agg(prefix, uri) FROM namespaces WHERE is_default),
  '@graph', (
    SELECT jsonb_agg(
      jsonb_build_object(
        '@id', subject,
        'triples', jsonb_agg(
          jsonb_build_object(
            'predicate', predicate,
            'object', object_value,
            'type', object_type,
            'lang', object_lang
          )
        )
      )
    )
    FROM triples
    WHERE graph_uri = 'https://moon.org/record/abc'
    GROUP BY subject
  )
) AS reconstructed_jsonld;
```

---

## 6. Server Code Changes (KV to SQL)

### Before (KV-based recordService.tsx):
```ts
// Save
await kv.set(`record:${recordId}`, JSON.stringify(metadata));
await kv.set(`record:index:${recordId}:title`, title);

// Load
const data = await kv.get(`record:${recordId}`);
const record = JSON.parse(data);

// List
const allKeys = await kv.getByPrefix('record:bibframe:record:');
```

### After (SQL-based recordService.ts):
```ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Save
await pool.query(
  `INSERT INTO records (id, uri, title, resource_type, graph_jsonld, checksum, created_by)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   ON CONFLICT (id) DO UPDATE SET
     title = $3, graph_jsonld = $4, checksum = $5, updated_at = now()`,
  [recordId, uri, title, resourceType, graphJson, checksum, userId]
);
// Triples are auto-extracted by the trigger!

// Load
const { rows } = await pool.query(
  'SELECT * FROM records WHERE id = $1 AND NOT deleted',
  [recordId]
);
const record = rows[0];

// List with pagination + filtering
const { rows } = await pool.query(
  `SELECT * FROM records
   WHERE NOT deleted
     AND ($1::text IS NULL OR status = $1)
     AND ($2::text IS NULL OR resource_type = $2)
   ORDER BY updated_at DESC
   LIMIT $3 OFFSET $4`,
  [statusFilter, typeFilter, limit, offset]
);

// Search (uses trigram index)
const { rows } = await pool.query(
  `SELECT * FROM records
   WHERE NOT deleted AND title ILIKE $1
   ORDER BY similarity(title, $2) DESC
   LIMIT 50`,
  [`%${query}%`, query]
);
```

### Before (KV-based auditLog.tsx):
```ts
await kv.set(auditId, JSON.stringify(entry));
await kv.set(`audit:index:${recordId}:${timestamp}`, auditId);
```

### After (SQL-based):
```ts
await pool.query(
  `INSERT INTO audit_log (action, entity_type, entity_id, user_id, institution_id, metadata, ip_address, user_agent)
   VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
  [action, 'record', recordId, userId, institutionId, metadata, ipAddress, userAgent]
);

// Query audit history (instant, no prefix scanning)
const { rows } = await pool.query(
  `SELECT * FROM audit_log
   WHERE entity_id = $1 AND NOT archived
   ORDER BY timestamp DESC
   LIMIT 100`,
  [recordId]
);
```

---

## Performance Comparison

| Operation | KV Store (current) | PostgreSQL (new) |
|---|---|---|
| Get record by ID | O(1) - single key lookup | O(1) - primary key |
| List all records | O(n) - prefix scan, parse all | O(log n) - indexed query |
| Search by title | O(n) - load all, filter in JS | O(log n) - trigram index |
| Filter by status | O(n) - load all, filter in JS | O(log n) - partial index |
| Count by type | O(n) - load all, count in JS | O(log n) - index-only scan |
| Triple pattern query | N/A (no triples) | O(log n) - composite indexes |
| Audit history | O(n) - prefix scan, sort in JS | O(log n) - indexed, pre-sorted |
| Multi-tenant isolation | Manual key prefixing | Row-level security (automatic) |

---

## ER Diagram (Text)

```
institutions ──1:N──> users
     │                   │
     │                   │
     ├──1:N──> records ──1:N──> record_versions
     │            │
     │            ├──1:N──> triples ──> named_graphs
     │            │
     │            └──1:N──> audit_log
     │
     ├──1:N──> authorities ──1:N──> authority_versions
     │
     ├──1:N──> field_templates
     │
     └──1:N──> shacl_shapes
     
     namespaces (standalone reference)
     discovery_cache (standalone cache)
     ai_sessions (standalone log)
     kv_store (backward compat)
```

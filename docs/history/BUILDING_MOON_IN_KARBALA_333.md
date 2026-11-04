# Building MOON in Karbala 333
## Complete Project Report & Code Architecture

**Project:** MOON SAND V2 - Enterprise BIBFRAME Semantic Cataloging Engine  
**Author:** Isaac Faleh  
**Date:** Saturday, March 7, 2026  
**Report Version:** 333 (Triple-Comprehensive Edition)

---

## 📑 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Architecture Deep Dive](#architecture-deep-dive)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Architecture & Migration](#database-architecture--migration)
7. [Major Components](#major-components)
8. [Technology Stack](#technology-stack)
9. [AI Integration & Routing](#ai-integration--routing)
10. [Federated Discovery Engine](#federated-discovery-engine)
11. [Known Issues & Status](#known-issues--status)
12. [Migration Progress](#migration-progress)
13. [API Routes Overview](#api-routes-overview)
14. [File Structure](#file-structure)
15. [Developer Guide](#developer-guide)
16. [Future Roadmap](#future-roadmap)

---

## Executive Summary

**MOON SAND V2** is an enterprise-grade, ontology-driven BIBFRAME semantic cataloging engine built with React/TypeScript and Supabase. It represents a complete reimagining of library cataloging as a linked data platform with multi-AI orchestration, iOS-inspired glassmorphism UI, full Arabic/RTL support, and 19 federated discovery sources.

### Key Metrics
- **166+ Backend API Routes**
- **100+ Frontend Components**
- **19 Federated Discovery Sources**
- **5-Phase AI Engine Architecture**
- **3 AI Providers** (OpenAI, Gemini, LLaMA) with circuit breaker
- **15 PostgreSQL Tables** (migration in progress)
- **36+ Backend Service Modules**
- **Full i18n Support** (English/Arabic with RTL)
- **4 Major Standalone Platforms** registered in App.tsx

### Current Development Phase
The project is in **Phase 3: Database Migration & Consolidation**. The migration from a single KV store to a 15-table PostgreSQL schema is 93% complete (14/15 backend modules rewired), with the main `index.tsx` server file pending conversion.

---

## Project Overview

### What is MOON SAND V2?

MOON SAND V2 is a **semantic web cataloging platform** that transforms traditional library cataloging into a modern linked data ecosystem. It combines:

1. **BIBFRAME 2.0+ Ontology** - Full implementation of the Library of Congress BIBFRAME ontology
2. **Multi-AI Orchestration** - Intelligent routing between OpenAI, Gemini, and LLaMA with health monitoring
3. **Federated Discovery** - Simultaneous search across 19 international linked data sources
4. **RDF Triple Store** - Native RDF/JSON-LD/Turtle support with SPARQL queries
5. **iOS-Inspired UI** - Frosted glassmorphism design system with dark mode
6. **Enterprise Security** - Multi-tenant architecture with audit logging and versioning

### Core Philosophy

The MOON project follows these principles:

- **Ontology-Driven**: Every field, every relationship, every validation rule derives from the BIBFRAME ontology
- **Linked Data First**: URIs, not strings. Relationships, not fields. Graphs, not records.
- **Multi-Language**: Equal treatment of Arabic and English at the architectural level
- **AI-Augmented**: Human catalogers enhanced by multi-provider AI fallback
- **Standards-Compliant**: W3C JSON-LD, RDF, SPARQL, SHACL validation

---

## Architecture Deep Dive

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Dashboard   │  │  MoonNexus   │  │  BlueMoon    │         │
│  │  (Control)   │  │  (5 Tabs)    │  │  (Editor)    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   MoonAI     │  │ MoonDijla    │  │ LD4Platform  │         │
│  │ Orchestrator │  │    Core      │  │ (Sinopia)    │         │
│  │  (10 Tabs)   │  │  (8 Tabs)    │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  React 18.3.1 • TypeScript • Tailwind v4 • Motion              │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND LAYER                               │
│  Supabase Edge Function (Hono Web Server)                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  AI Engine   │  │  Discovery   │  │  Record      │         │
│  │  (5 Phases)  │  │  (19 Sources)│  │  Service     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ MOON DIJLA   │  │  LD4         │  │  Triple      │         │
│  │ AI Router    │  │  Integration │  │  Store       │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  166+ API Routes • Circuit Breaker • Multi-tenant              │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                              │
│  PostgreSQL (Supabase) - 15 Tables                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  records • record_versions • triples • named_graphs      │  │
│  │  authorities • audit_log • institutions • moon_users     │  │
│  │  field_templates • ai_sessions • discovery_cache        │  │
│  │  ai_provider_health • namespaces • moon_kv              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  RDF Triple Store • Full-text Search • Versioning              │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                          │
│                                                                  │
│  OpenAI GPT-4      Gemini 1.5      LLaMA 3.3-70B              │
│  LOC APIs          VIAF            Wikidata                     │
│  WorldCat          Europeana       DPLA                         │
│  BnF               GND             Getty                        │
│  + 8 more discovery sources                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Three-Tier Architecture

MOON follows a strict **three-tier architecture**:

1. **Frontend (Client)** → Makes HTTP requests to server
2. **Server (Edge Function)** → Business logic, AI routing, external API orchestration
3. **Database (Supabase PostgreSQL)** → Data persistence, queries, RLS policies

This separation ensures:
- API keys never leak to frontend
- Multi-tenant data isolation via RLS
- Centralized audit logging
- Circuit breaker pattern for external services

---

## Frontend Architecture

### Core Structure

```
/src/app/
├── App.tsx                    # Main application entry point
├── components/                # 100+ React components
│   ├── Dashboard.tsx          # Main control center
│   ├── MoonNexus.tsx         # 5-tab discovery & health platform
│   ├── MoonAIOrchestrator.tsx # 10-tab AI orchestration UI
│   ├── MoonDijlaCore.tsx     # 8-tab cataloging platform
│   ├── BlueMoon.tsx          # Main BIBFRAME editor (⚠️ HAS ISSUE)
│   ├── DijlaPlatform.tsx     # Multi-platform orchestrator
│   ├── LD4Platform.tsx       # Sinopia/LD4 integration
│   ├── LinkedDataDiscovery.tsx # Federated search UI
│   ├── cataloging/           # Cataloging wizards & forms
│   ├── fields/               # Smart field components
│   ├── ontology/             # Ontology-driven form fields
│   ├── sonic/                # SONIC import engine
│   ├── RecordView/           # Multi-format record viewers
│   └── ui/                   # shadcn/ui component library
├── contexts/                  # React contexts
│   ├── AuthContext.tsx       # Authentication state
│   ├── ThemeContext.tsx      # Theme & dark mode
│   └── JCricketContext.tsx   # J-Cricket metadata context
├── services/                  # Frontend services
│   ├── bibframe/             # BIBFRAME export/import engines
│   ├── authorityHub/         # Multi-authority search
│   ├── kami/                 # KAMI ontology engine
│   └── loc/                  # Library of Congress API clients
├── types/                     # TypeScript type definitions
├── utils/                     # Utility functions
├── i18n/                      # Internationalization config
└── styles/                    # CSS/Tailwind themes
```

### Component Categories

#### 1. **Platform Components** (Standalone Apps)
- **MoonNexus** - Discovery, health monitoring, SPARQL interface (5 tabs)
- **MoonAIOrchestrator** - AI task routing, provider health, session history (10 tabs)
- **MoonDijlaCore** - Full cataloging workflow (8 tabs)
- **LD4Platform** - Sinopia resource template integration
- **DijlaPlatform** - Multi-platform orchestration dashboard

#### 2. **Editor Components**
- **BlueMoon** - Main BIBFRAME cataloging editor (⚠️ Dynamic import error)
- **OntologyDrivenCatalogForm** - Schema-driven cataloging
- **MoonEngine** series - Multiple theme variants (Glass, Neon, Classic, etc.)
- **MoonSand** series - Persistence-focused editors

#### 3. **Discovery Components**
- **LinkedDataDiscovery** - Federated search across 19 sources
- **BibframeSearchPage** - Advanced BIBFRAME search
- **AdvancedSearch** - Query builder interface
- **SearchPage** - Simple search interface

#### 4. **Utility Components**
- **Dashboard** - Main control center with stats & quick actions
- **RecordManager** - Record CRUD operations
- **AuthorityManager** - Authority file management
- **VersionHistory** - Record versioning UI
- **ActivityLog** - User activity tracking

#### 5. **Smart Field Components** (`/components/fields/`)
- **LocApiSearchField** - LOC authority search
- **BibframeLinkedField** - Linked entity field
- **CountrySearchField** - Country vocabulary
- **SubjectSearchField** - LCSH subject search

#### 6. **Ontology-Driven Fields** (`/components/ontology/`)
- **OntologyField** - Dynamic field renderer based on property type
- **LiteralField** - Simple text fields
- **EntityField** - Complex entity relationships
- **ClassificationField** - LCC/DDC classification
- **LocNameSearch** - Name authority lookup
- **LocSubjectSearch** - Subject authority lookup
- **LocPlaceSearch** - Place/geography authority

### Lazy Loading Strategy

To prevent the "Failed to fetch dynamically imported module" error (which affects BlueMoon.tsx), most heavy components are **lazy-loaded**:

```typescript
const MoonNexus = React.lazy(() => import('./components/MoonNexus'));
const MoonAIOrchestrator = React.lazy(() => import('./components/MoonAIOrchestrator'));
const MoonDijlaCore = React.lazy(() => import('./components/MoonDijlaCore'));
// ... etc
```

This reduces initial bundle size and prevents module graph errors.

### Theme System

MOON supports **5 visual themes**:

1. **Glass** (Default) - iOS-inspired frosted glassmorphism
2. **Neon** - Cyberpunk neon gradients
3. **Classic** - Traditional library system aesthetic
4. **Blur** - Extreme blur effects
5. **Clean** - Minimalist clean design

Theme CSS files:
- `/src/styles/glassmorphism.css`
- `/src/styles/neon-theme.css`
- `/src/styles/classic-theme.css`
- `/src/styles/blur-theme.css`
- `/src/styles/classic-clean.css`

### Internationalization (i18n)

Full bilingual support using `react-i18next`:

- **English** - Left-to-right (LTR)
- **Arabic** - Right-to-left (RTL) with full Unicode support
- Configuration: `/src/app/i18n/config.ts`
- 1000+ translation keys
- Dynamic RTL layout switching

---

## Backend Architecture

### Server Structure

```
/supabase/functions/server/
├── index.tsx                     # Main Hono server (166+ routes)
├── db.tsx                        # New database abstraction layer ✨
├── kv_store.tsx                  # Legacy KV layer (being phased out)
│
├── AI LAYER
│   ├── aiEngine.tsx              # 5-phase AI engine
│   ├── aiProviders.tsx           # OpenAI/Gemini/LLaMA clients
│   └── aiRouter.tsx              # MOON DIJLA multi-AI router
│
├── DISCOVERY LAYER
│   ├── discovery.tsx             # Main discovery orchestrator
│   └── discoveryProviders.tsx    # 19 federated source providers
│
├── RECORD LAYER
│   ├── recordService.tsx         # Record CRUD (✅ Rewired to db.tsx)
│   ├── moonRecords.tsx           # MOON-specific record logic (✅ Rewired)
│   ├── versioning.tsx            # Record versioning (✅ Rewired)
│   └── recordRoutes.tsx          # Record HTTP routes
│
├── AUTHORITY LAYER
│   ├── authorities.tsx           # Authority management (✅ Rewired)
│   ├── authorityMergeIntegrity.tsx # Merge validation (✅ Rewired)
│   ├── locAuthorityService.tsx   # LOC authority client
│   └── locSparqlService.tsx      # LOC SPARQL queries
│
├── RDF / TRIPLE STORE
│   ├── tripleStore.tsx           # RDF triple CRUD
│   ├── rdfParser.tsx             # JSON-LD/Turtle parser
│   ├── rdfExporter.tsx           # Multi-format RDF export
│   └── graphBuilder.tsx          # Graph construction
│
├── ENTERPRISE LAYER
│   ├── auditLog.tsx              # Immutable audit trail (✅ Rewired)
│   ├── observability.tsx         # Metrics & monitoring (✅ Rewired)
│   ├── multiTenant.tsx           # Multi-tenant isolation (✅ Rewired)
│   └── dataIsolation.tsx         # RLS & tenant boundaries (✅ Rewired)
│
├── INTEGRATION LAYER
│   └── ld4Integration.tsx        # LD4/Sinopia integration (✅ Rewired)
│
├── ONTOLOGY LAYER
│   ├── ontology.tsx              # BIBFRAME schema loader
│   ├── bibframeOntologyEngine.tsx # Property resolver
│   └── engine.tsx                # Core ontology engine
│
├── VALIDATION LAYER
│   ├── shaclValidator.tsx        # SHACL graph validation
│   └── shaclShapes.tsx           # BIBFRAME SHACL shapes
│
├── MARC LAYER
│   ├── marcConverter.tsx         # MARC ↔ BIBFRAME conversion
│   ├── marcMappingRegistry.tsx   # Field mapping registry
│   └── canonicalJsonLd.tsx       # JSON-LD canonicalization
│
├── AUTH LAYER
│   ├── authMiddleware.tsx        # JWT middleware
│   └── jwtAuth.tsx               # JWT generation/validation
│
├── UTILITIES
│   ├── examples.tsx              # Example data loader
│   ├── loadTesting.tsx           # Load testing utilities
│   └── mindMapGenerator.tsx      # Mind map generation
```

### Boot Sequence

The server follows a **strict initialization order** defined in `index.tsx`:

```
1. Create demo user (demo@moon.local / demo123)
2. Load BIBFRAME Ontology Schema
3. Initialize AI Router (OpenAI/Gemini/LLaMA health check)
4. Initialize Discovery Providers (19 sources)
5. Load example data (optional)
6. Start HTTP server on port 8000
```

### API Route Categories

The server exposes **166+ routes** organized by functionality:

#### Core Routes
- `GET /make-server-49c0e13c/` - Health check
- `GET /make-server-49c0e13c/test-kv` - KV store test
- `POST /make-server-49c0e13c/parse-jsonld` - JSON-LD parser

#### Record Routes
- `GET /make-server-49c0e13c/records` - List all records
- `GET /make-server-49c0e13c/records/:id` - Get record by ID
- `POST /make-server-49c0e13c/records` - Create record
- `PUT /make-server-49c0e13c/records/:id` - Update record
- `DELETE /make-server-49c0e13c/records/:id` - Delete record
- `GET /make-server-49c0e13c/records/:id/versions` - Get version history
- `POST /make-server-49c0e13c/records/:id/publish` - Publish record

#### Authority Routes
- `GET /make-server-49c0e13c/authorities` - List authorities
- `POST /make-server-49c0e13c/authorities` - Create authority
- `POST /make-server-49c0e13c/authorities/merge` - Merge authorities

#### Discovery Routes
- `POST /make-server-49c0e13c/discovery/search` - Federated search
- `GET /make-server-49c0e13c/discovery/sources` - List sources
- `POST /make-server-49c0e13c/discovery/clear-cache` - Clear cache

#### AI Routes
- `POST /make-server-49c0e13c/ai/generate` - AI generation task
- `GET /make-server-49c0e13c/ai/health` - AI provider health
- `GET /make-server-49c0e13c/ai/sessions` - List AI sessions
- `POST /make-server-49c0e13c/ai/router/task` - MOON DIJLA routing

#### LD4 Routes
- `GET /make-server-49c0e13c/ld4/templates` - Get templates
- `POST /make-server-49c0e13c/ld4/import` - Import LD4 record

#### SPARQL Routes
- `POST /make-server-49c0e13c/sparql` - Execute SPARQL query
- `POST /make-server-49c0e13c/sparql/triples/insert` - Insert triples
- `GET /make-server-49c0e13c/sparql/triples/query` - Query triples

#### Audit Routes
- `GET /make-server-49c0e13c/audit` - Get audit log
- `GET /make-server-49c0e13c/audit/:entityId` - Entity audit trail

#### LOC API Proxy Routes
- `GET /make-server-49c0e13c/loc/names/search` - LOC names search
- `GET /make-server-49c0e13c/loc/subjects/search` - LOC subjects search
- `GET /make-server-49c0e13c/loc/places/search` - LOC places search

#### Ontology Routes
- `GET /make-server-49c0e13c/ontology/schema` - Get BIBFRAME schema
- `GET /make-server-49c0e13c/ontology/property/:uri` - Get property definition

#### Multi-Tenant Routes
- `GET /make-server-49c0e13c/institutions` - List institutions
- `POST /make-server-49c0e13c/institutions` - Create institution

---

## Database Architecture & Migration

### Current State: Dual-Schema Transition

The project is **migrating** from:
- **Old:** Single `kv_store_49c0e13c` table (key-value pairs)
- **New:** 15-table relational PostgreSQL schema with RDF triple store

### New Schema (15 Tables)

#### 1. **institutions**
Multi-tenant organization table.
```sql
- id (UUID, PK)
- name (TEXT)
- namespace (TEXT, UNIQUE) -- e.g., "library-karbala"
- base_uri (TEXT) -- URI prefix for records
- settings (JSONB)
- contact_email, org_type, country
- created_at, updated_at
```

#### 2. **moon_users**
User accounts with role-based permissions.
```sql
- id (UUID, PK)
- email (TEXT, UNIQUE)
- name (TEXT)
- institution_id (UUID, FK -> institutions)
- roles (TEXT[]) -- e.g., ['cataloger', 'admin']
- permissions (TEXT[])
- password_hash, last_login_at
- created_at, updated_at
```

#### 3. **records**
Core BIBFRAME records (Work, Instance, Item).
```sql
- id (UUID, PK)
- uri (TEXT, UNIQUE) -- Persistent URI
- work_uri, instance_uri, item_uri (TEXT)
- title (TEXT)
- resource_type (TEXT) -- 'Work', 'Instance', 'Item'
- status (TEXT) -- 'draft', 'validated', 'published', 'archived'
- graph_jsonld (JSONB) -- Full JSON-LD graph
- checksum (TEXT) -- SHA-256 of canonical JSON-LD
- locked (BOOLEAN)
- institution_id (UUID, FK)
- created_by, last_modified_by, published_by (TEXT)
- version_number (INTEGER)
- created_at, updated_at, published_at
- deleted, deleted_at, deleted_by, deleted_reason
- cataloger, resource_type_label, cover_image
- jcricket (JSONB) -- J-Cricket metadata
```
**Indexes:** status, resource_type, institution, title (trigram), updated_at, checksum, graph (GIN)

#### 4. **record_versions**
Immutable version history (copy-on-write).
```sql
- id (UUID, PK)
- record_id (UUID, FK -> records, CASCADE)
- version_number (INTEGER)
- graph_snapshot (JSONB) -- Immutable copy
- checksum (TEXT)
- validation_result (JSONB)
- named_graph_uri (TEXT)
- comment (TEXT)
- created_by, created_at
- UNIQUE (record_id, version_number)
```

#### 5. **triples**
RDF triple store for SPARQL queries.
```sql
- id (BIGINT, IDENTITY, PK)
- subject (TEXT)
- predicate (TEXT)
- object_value (TEXT)
- object_type (TEXT) -- 'uri', 'literal', 'blank'
- object_lang (TEXT) -- e.g., 'en', 'ar'
- object_datatype (TEXT) -- e.g., 'xsd:date'
- graph_uri (TEXT)
- record_id (UUID, FK -> records, CASCADE)
- institution_id (UUID, FK)
- created_at
```
**Indexes:** subject, predicate, object_value, graph_uri, SPO, GP, GPO (for SPARQL performance), literal trigram, rdf:type

#### 6. **named_graphs**
Named graph metadata for versioned RDF graphs.
```sql
- uri (TEXT, PK)
- record_id (UUID, FK -> records, CASCADE)
- version_number (INTEGER)
- institution_id (UUID, FK)
- triple_count (INTEGER)
- status (TEXT) -- 'active', 'archived', 'deleted'
- created_at, updated_at
```

#### 7. **namespaces**
RDF namespace prefixes (bf, bflc, rdf, rdfs, etc.).
```sql
- prefix (TEXT, PK)
- uri (TEXT, UNIQUE)
- description (TEXT)
- is_default (BOOLEAN)
```
Pre-populated with 11 standard namespaces (bf, bflc, rdf, rdfs, owl, xsd, skos, dcterms, madsrdf, schema, foaf).

#### 8. **authorities**
Authority records (Person, Organization, Topic, Place, etc.).
```sql
- id (UUID, PK)
- uri (TEXT, UNIQUE)
- type (TEXT) -- 'Person', 'Organization', 'Topic', 'Place', 'Work', 'GenreForm'
- label (TEXT)
- alternate_labels (TEXT[])
- viaf_uri, lc_uri, wikidata_uri, isni, orcid (TEXT)
- raw_data (JSONB)
- source (TEXT) -- 'local', 'imported', 'external'
- verified (BOOLEAN)
- usage_count (INTEGER)
- institution_id (UUID, FK)
- created_at, updated_at
```
**Indexes:** type, label (trigram), viaf, lc, wikidata, institution

#### 9. **audit_log**
Immutable append-only audit trail.
```sql
- id (UUID, PK)
- timestamp (TIMESTAMPTZ)
- action (TEXT) -- 'create', 'update', 'delete', 'publish', etc.
- entity_type (TEXT) -- 'record', 'authority', 'user', etc.
- entity_id (TEXT)
- version_number (INTEGER)
- user_id (TEXT)
- institution_id (UUID, FK)
- metadata (JSONB) -- Free-form context
- ip_address, user_agent (TEXT)
- archived (BOOLEAN)
- archived_at (TIMESTAMPTZ)
```
**Indexes:** entity_type+entity_id, action, user_id, timestamp, institution, not archived

#### 10. **field_templates**
BlueMoon custom field templates.
```sql
- id (TEXT, PK)
- name (TEXT)
- base_template (TEXT)
- hidden_fields (TEXT[])
- all_fields (TEXT[])
- institution_id (UUID, FK)
- created_by, created_at, updated_at
```

#### 11. **ai_sessions**
AI task execution history.
```sql
- id (UUID, PK)
- user_id (TEXT)
- record_id (UUID, FK -> records, SET NULL)
- provider (TEXT) -- 'openai', 'gemini', 'llama'
- model (TEXT)
- task_type (TEXT)
- prompt (TEXT)
- response (TEXT)
- tokens_used (INTEGER)
- latency_ms (INTEGER)
- status (TEXT) -- 'success', 'error', 'timeout', 'fallback'
- error_message (TEXT)
- routing_decision (JSONB)
- created_at
```
**Indexes:** provider, record_id

#### 12. **discovery_cache**
Federated search result cache (24-hour TTL).
```sql
- id (UUID, PK)
- query (TEXT)
- provider (TEXT)
- results (JSONB)
- result_count (INTEGER)
- cached_at (TIMESTAMPTZ)
- expires_at (TIMESTAMPTZ)
- UNIQUE (query, provider)
```
**Indexes:** query+provider, expires_at

#### 13. **ai_provider_health**
AI router circuit breaker state.
```sql
- provider (TEXT, PK)
- available (BOOLEAN)
- model (TEXT)
- circuit_breaker_open (BOOLEAN)
- circuit_breaker_reset_at (TIMESTAMPTZ)
- last_call_at (TIMESTAMPTZ)
- last_call_success (BOOLEAN)
- avg_latency_ms (REAL)
- total_calls, success_count, error_count, consecutive_errors (INTEGER)
- updated_at
```
Pre-populated with: openai, gemini, llama

#### 14. **moon_kv**
Generic key-value table (backward compatibility).
```sql
- key (TEXT, PK)
- value (JSONB)
- created_at, updated_at
```

#### 15. **kv_store_49c0e13c** (Legacy)
Original single KV table. **Still present for backward compatibility** but no new code should use it.

### Database Features

- **Row Level Security (RLS)**: Enabled on all tables with service_role bypass
- **Triggers**: Auto-update `updated_at` on UPDATE for 5 tables
- **Extensions**: uuid-ossp, pgcrypto, pg_trgm (trigram indexing for full-text search)
- **Policies**: Full access for `service_role` key

### Migration Status

| Module | Status | KV Calls Remaining |
|--------|--------|-------------------|
| recordService.tsx | ✅ Rewired | 0 |
| auditLog.tsx | ✅ Rewired | 0 |
| moonRecords.tsx | ✅ Rewired | 0 |
| authorities.tsx | ✅ Rewired | 0 |
| versioning.tsx | ✅ Rewired | 0 |
| multiTenant.tsx | ✅ Rewired | 0 |
| dataIsolation.tsx | ✅ Rewired | 0 |
| authorityMergeIntegrity.tsx | ✅ Rewired | 0 |
| observability.tsx | ✅ Rewired | 0 |
| discovery.tsx | ✅ Rewired | 0 |
| discoveryProviders.tsx | ✅ Rewired | 0 |
| aiEngine.tsx | ✅ Rewired | 0 |
| aiRouter.tsx | ✅ Rewired | 0 |
| ld4Integration.tsx | ✅ Rewired | 0 |
| **index.tsx** | ⏳ Pending | **61+** |

**Overall Progress:** 93% complete (14/15 modules)

### Migration SQL

The complete migration SQL is in **`/BUILDING_MOON_IN_KARBALA_222_MIGRATION.md`**. It's ready to paste into Supabase SQL Editor.

⚠️ **The SQL has NOT been run yet.** The project is waiting for the final `index.tsx` conversion before executing the migration.

---

## Major Components

### 1. MOON NEXUS (MoonNexus.tsx)

**Purpose:** Unified discovery and health monitoring platform

**Tabs (5):**
1. **Search** - Federated search interface
2. **Health** - AI provider health dashboard
3. **SPARQL** - SPARQL query interface
4. **Stats** - Catalog statistics
5. **Sources** - Discovery source configuration

**Key Features:**
- Real-time AI provider health monitoring
- SPARQL query builder with syntax highlighting
- Federated search with source tagging
- Catalog statistics dashboard

**Location:** `/src/app/components/MoonNexus.tsx`

---

### 2. MOON AI ORCHESTRATOR (MoonAIOrchestrator.tsx)

**Purpose:** Multi-AI task routing and management

**Tabs (10):**
1. **Orchestrator** - Main AI routing dashboard
2. **Tasks** - AI task management
3. **Providers** - Provider configuration
4. **Health** - Real-time health monitoring
5. **Sessions** - AI session history
6. **Analytics** - Usage analytics
7. **Circuit Breaker** - Circuit breaker status
8. **Routing** - Routing logic configuration
9. **Testing** - AI provider testing
10. **Logs** - Detailed execution logs

**Key Features:**
- Intelligent routing between OpenAI, Gemini, LLaMA
- Circuit breaker pattern for fault tolerance
- Real-time health checks with latency tracking
- Session history with token usage analytics
- Manual provider override for testing

**Location:** `/src/app/components/MoonAIOrchestrator.tsx`

---

### 3. MOON DIJLA CORE (MoonDijlaCore.tsx)

**Purpose:** Complete BIBFRAME cataloging workflow

**Tabs (8):**
1. **Cataloging** - Main cataloging interface
2. **Discovery** - Federated discovery
3. **AI** - AI-assisted cataloging
4. **Authorities** - Authority management
5. **Templates** - Template management
6. **Versioning** - Record versioning
7. **Export** - Multi-format export
8. **Settings** - Configuration

**Key Features:**
- Ontology-driven form generation
- Multi-authority search (LOC, VIAF, Wikidata)
- AI-powered metadata enrichment
- RDF triple generation
- Version control with diffs
- Multi-format export (JSON-LD, Turtle, MARC)

**Location:** `/src/app/components/MoonDijlaCore.tsx`

---

### 4. LD4 PLATFORM (LD4Platform.tsx)

**Purpose:** Integration with Linked Data for Libraries (LD4) / Sinopia

**Key Features:**
- Resource template browsing
- Sinopia resource import
- LD4 profile management
- Template-driven cataloging

**Location:** `/src/app/components/LD4Platform.tsx`

---

### 5. DIJLA PLATFORM (DijlaPlatform.tsx)

**Purpose:** Multi-platform orchestration dashboard

**Key Features:**
- Unified dashboard for all MOON platforms
- Quick navigation between modules
- System health overview
- Recent activity feed

**Location:** `/src/app/components/DijlaPlatform.tsx`

---

### 6. BLUE MOON (BlueMoon.tsx) ⚠️

**Purpose:** Main BIBFRAME cataloging editor

**Status:** ⚠️ **HAS PERSISTENT ERROR**  
**Error:** `TypeError: Failed to fetch dynamically imported module`

**Note:** This component MUST NOT BE TOUCHED unless explicitly requested. The error is persistent and touching it may cause further issues.

**Location:** `/src/app/components/BlueMoon.tsx`

---

### 7. DASHBOARD (Dashboard.tsx)

**Purpose:** Main control center and landing page

**Key Features:**
- Quick stats (record count, recent activity)
- Favorite tool picker (persistent)
- Quick action cards for all major platforms
- Recent records list with load functionality
- Backend health indicator
- Theme switcher

**Cards Displayed:**
- MOON NEXUS
- MOON AI ORCHESTRATOR
- MOON DIJLA CORE
- LD4 PLATFORM
- DIJLA PLATFORM
- BlueMoon Editor (when available)
- + 20+ other utility cards

**Location:** `/src/app/components/Dashboard.tsx`

---

### 8. LINKED DATA DISCOVERY (LinkedDataDiscovery.tsx)

**Purpose:** Federated search UI for 19 sources

**Key Features:**
- Faceted search with keyword autocomplete
- Record detail view with WEMI hierarchy
- Linked graph navigation (click author/subject)
- Content negotiation (JSON-LD, Turtle, N-Triples download)
- URI resolution display
- Catalog statistics
- Source filtering

**Location:** `/src/app/components/LinkedDataDiscovery.tsx`

---

## Technology Stack

### Frontend Dependencies

```json
{
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "typescript": "Latest via Vite",
  
  "UI Framework": {
    "@mui/material": "7.3.5",
    "@radix-ui/*": "Latest", // 20+ Radix UI primitives
    "class-variance-authority": "0.7.1",
    "clsx": "2.1.1",
    "tailwind-merge": "3.2.0",
    "lucide-react": "0.487.0" // Icon library
  },
  
  "Routing & State": {
    "@reduxjs/toolkit": "^2.11.2",
    "react-redux": "^9.2.0",
    "react-hook-form": "7.55.0"
  },
  
  "i18n": {
    "i18next": "^25.8.4",
    "react-i18next": "^16.5.4"
  },
  
  "Animations": {
    "motion": "12.23.24", // (formerly Framer Motion)
    "tw-animate-css": "1.3.8"
  },
  
  "Data Visualization": {
    "d3": "^7.9.0",
    "recharts": "2.15.2",
    "reactflow": "^11.11.4"
  },
  
  "RDF / Linked Data": {
    "jsonld": "^9.0.0",
    "n3": "^2.0.1",
    "js-yaml": "^4.1.1"
  },
  
  "Utilities": {
    "axios": "^1.13.5",
    "uuid": "^13.0.0",
    "date-fns": "3.6.0",
    "sonner": "2.0.3", // Toast notifications
    "react-popper": "2.3.0"
  },
  
  "Drag & Drop": {
    "react-dnd": "16.0.1",
    "react-dnd-html5-backend": "16.0.1"
  },
  
  "Build Tools": {
    "vite": "6.3.5",
    "@vitejs/plugin-react": "4.7.0",
    "tailwindcss": "4.1.12",
    "@tailwindcss/vite": "4.1.12",
    "postcss": "Latest"
  }
}
```

### Backend Dependencies (Deno Runtime)

```typescript
// Import via npm: and jsr: specifiers
{
  "hono": "npm:hono", // Web framework
  "hono/cors": "npm:hono/cors",
  "hono/logger": "npm:hono/logger",
  
  "@supabase/supabase-js": "jsr:@supabase/supabase-js@2",
  
  // Node built-ins via node: specifier
  "crypto": "node:crypto",
  "process": "node:process"
}
```

### Database

- **PostgreSQL** (Supabase-managed)
- **Extensions:** uuid-ossp, pgcrypto, pg_trgm
- **Schema:** 15 tables (see Database Architecture section)

### External APIs

**Cataloging & Authority:**
- Library of Congress APIs (id.loc.gov)
- VIAF (Virtual International Authority File)
- Wikidata
- ISBNdb (requires API key)

**AI Providers:**
- OpenAI (gpt-4o-mini)
- Google Gemini (gemini-1.5-flash)
- Groq LLaMA (llama-3.3-70b-versatile)

**Discovery Sources (19 total):**
- Library of Congress, VIAF, Wikidata, Open Library, WorldCat, FAST, ISBNdb, Google Books, CrossRef, BnF, LCSH, lobid-GND, ISNI, HathiTrust, Getty Vocabularies, Europeana, DPLA, ShareVDE, Internal Catalog

---

## AI Integration & Routing

### MOON DIJLA Multi-AI Router

**Purpose:** Intelligent routing between 3 AI providers with fault tolerance

**Architecture:**

```
User Request
     ↓
AI Router (aiRouter.tsx)
     ↓
Provider Selection Algorithm
     ├─→ Provider 1 (OpenAI) ──→ Success ✅
     ├─→ Provider 2 (Gemini) ──→ Fallback if Provider 1 fails
     └─→ Provider 3 (LLaMA)  ──→ Fallback if Provider 1 & 2 fail
     ↓
Circuit Breaker Check
     ↓
Execute Task
     ↓
Update Health Metrics
     ↓
Return Result or Error
```

### 5-Phase AI Engine (aiEngine.tsx)

The AI engine supports **5 cataloging phases**:

1. **Phase 1: Metadata Extraction** - Extract title, author, publisher from free text
2. **Phase 2: Subject Analysis** - Generate LCSH subject headings
3. **Phase 3: Classification** - Suggest LCC/DDC classification
4. **Phase 4: Authority Linking** - Match to LOC/VIAF authorities
5. **Phase 5: RDF Generation** - Generate BIBFRAME JSON-LD

Each phase can independently route to different AI providers based on task complexity.

### Circuit Breaker Pattern

The router implements a **circuit breaker** to prevent cascading failures:

**States:**
- **CLOSED** (Normal) - All requests pass through
- **OPEN** (Failing) - All requests immediately fail without calling provider
- **HALF-OPEN** (Testing) - Limited requests allowed to test recovery

**Thresholds:**
- Open circuit after **5 consecutive errors**
- Reset after **60 seconds** in open state
- Close circuit after **2 consecutive successes** in half-open state

**Tracking Table:** `ai_provider_health`

### Health Monitoring

Real-time metrics tracked per provider:
- Availability (up/down)
- Average latency (ms)
- Total calls
- Success count / Error count
- Consecutive errors
- Last call timestamp

**UI:** Displayed in MoonAIOrchestrator and MoonNexus

---

## Federated Discovery Engine

### 19 Discovery Sources

The discovery engine searches **19 sources simultaneously** and merges results:

| # | Source | ID | Base URL | Type |
|---|--------|-----|----------|------|
| 1 | Internal Catalog | `internal` | - | Local BIBFRAME records |
| 2 | Library of Congress | `loc` | id.loc.gov | Authority & BIBFRAME |
| 3 | VIAF | `viaf` | viaf.org | International authorities |
| 4 | Open Library | `openlibrary` | openlibrary.org | Book metadata |
| 5 | Wikidata | `wikidata` | wikidata.org | Linked open data |
| 6 | WorldCat | `worldcat` | worldcat.org | Union catalog |
| 7 | FAST | `fast` | fast.oclc.org | Subject headings |
| 8 | ISBNdb | `isbndb` | isbndb.com | ISBN database |
| 9 | Google Books | `googlebooks` | books.google.com | Book metadata |
| 10 | CrossRef | `crossref` | crossref.org | Scholarly metadata |
| 11 | BnF | `bnf` | data.bnf.fr | French National Library |
| 12 | LCSH | `lcsh` | id.loc.gov/authorities/subjects | Subject headings |
| 13 | lobid-GND | `lobidgnd` | lobid.org/gnd | German National Library |
| 14 | ISNI | `isni` | isni.org | Name identifiers |
| 15 | HathiTrust | `hathitrust` | hathitrust.org | Digital library |
| 16 | Getty Vocabularies | `getty` | vocab.getty.edu | Art & architecture |
| 17 | Europeana | `europeana` | europeana.eu | European collections |
| 18 | DPLA | `dpla` | dp.la | Digital Public Library of America |
| 19 | ShareVDE | `sharevde` | share-vde.org | Virtual discovery |

### Discovery Flow

```
1. User enters search query
2. Frontend sends POST /make-server-49c0e13c/discovery/search
3. Backend fans out to all enabled providers
4. Each provider:
   - Checks cache (24-hour TTL)
   - If cache miss, calls external API
   - Normalizes results to common schema
   - Tags results with source ID
5. Backend merges & deduplicates results
6. Returns unified result set with facets
7. Frontend displays with source badges
```

### Caching Strategy

- **Table:** `discovery_cache`
- **TTL:** 24 hours
- **Key:** `(query, provider)`
- **Invalidation:** Manual via `/discovery/clear-cache`

This drastically reduces external API calls and improves performance.

---

## Known Issues & Status

### 🔴 Critical Issues

#### 1. BlueMoon.tsx Dynamic Import Error
**Error:** `TypeError: Failed to fetch dynamically imported module`  
**Status:** Persistent, DO NOT TOUCH unless explicitly requested  
**Impact:** BlueMoon editor cannot be loaded  
**Location:** `/src/app/components/BlueMoon.tsx`  
**Workaround:** Use alternative editors (MoonDijlaCore, MoonSandV2, OntologyDrivenCatalogForm)

### 🟡 High Priority Issues

#### 2. Dark Mode Text Visibility
**Issue:** Text elements have low contrast in dark mode  
**Affected Files:**
- `/src/app/components/ontology/OntologyField.tsx` (partially fixed)
- Other components with similar patterns
**Status:** Partially addressed  
**Fix Needed:** Systematic review of all text color classes in dark mode

#### 3. API Key Security
**Issue:** OpenAI API key was previously exposed and needs rotation  
**Current State:**
- `OPENAI_API_KEY` exists as Supabase secret but needs new rotated key
- `GEMINI_API_KEY` needs to be set
- `LLAMA_API_KEY` needs to be set
**Action Required:**
1. Rotate OpenAI key in OpenAI dashboard
2. Update Supabase secret via `supabase secrets set OPENAI_API_KEY=<new-key>`
3. Set Gemini and LLaMA keys similarly

### 🟢 In Progress

#### 4. Database Migration
**Status:** 93% complete (14/15 modules)  
**Remaining:** Convert `index.tsx` (61+ KV calls)  
**SQL Ready:** Yes, in `/BUILDING_MOON_IN_KARBALA_222_MIGRATION.md`  
**SQL Executed:** No, waiting for index.tsx conversion

---

## Migration Progress

### Completed Modules (14)

1. ✅ **recordService.tsx** - Record CRUD operations
2. ✅ **auditLog.tsx** - Audit trail logging
3. ✅ **moonRecords.tsx** - MOON-specific record logic
4. ✅ **authorities.tsx** - Authority management
5. ✅ **versioning.tsx** - Record versioning
6. ✅ **multiTenant.tsx** - Multi-tenant isolation
7. ✅ **dataIsolation.tsx** - RLS enforcement
8. ✅ **authorityMergeIntegrity.tsx** - Merge validation
9. ✅ **observability.tsx** - Metrics & monitoring
10. ✅ **discovery.tsx** - Discovery orchestrator
11. ✅ **discoveryProviders.tsx** - 19 federated sources
12. ✅ **aiEngine.tsx** - 5-phase AI engine
13. ✅ **aiRouter.tsx** - MOON DIJLA router
14. ✅ **ld4Integration.tsx** - LD4/Sinopia integration

### Remaining Work (1)

⏳ **index.tsx** - Main server file with 166+ routes and 61+ KV calls

**Estimated Effort:** 8-12 hours of careful refactoring

**Strategy:**
1. Identify all KV call patterns
2. Map each to appropriate db.tsx method or SQL query
3. Preserve backward compatibility for critical routes
4. Test each route after conversion
5. Update error handling to use new schema
6. Run migration SQL after conversion complete

---

## API Routes Overview

### Route Prefix
All routes are prefixed with `/make-server-49c0e13c/`

### Categories (166+ routes total)

**Core (10 routes)**
- Health, KV test, JSON-LD parser, examples

**Records (25 routes)**
- CRUD, versioning, publishing, validation, export

**Authorities (15 routes)**
- CRUD, search, merge, linking, validation

**Discovery (12 routes)**
- Federated search, cache management, source config

**AI (20 routes)**
- Task routing, provider health, session history, testing

**Triple Store (18 routes)**
- SPARQL query, triple CRUD, graph management

**LOC APIs (30 routes)**
- Names, subjects, places, vocabularies, SPARQL proxy

**Ontology (10 routes)**
- Schema, property lookup, validation

**Audit (8 routes)**
- Log retrieval, entity history, archiving

**Multi-Tenant (12 routes)**
- Institution CRUD, user management, settings

**LD4 Integration (6 routes)**
- Template browsing, import, profile management

**MARC (8 routes)**
- MARC ↔ BIBFRAME conversion, validation

**Utilities (12 routes)**
- Mind map generation, load testing, examples

---

## File Structure

### Project Root
```
/
├── src/                           # Frontend source
│   ├── app/                       # React application
│   ├── imports/                   # Figma imports & docs
│   ├── services/                  # Frontend services
│   ├── styles/                    # CSS & themes
│   └── main.tsx                   # Vite entry point
├── supabase/                      # Backend
│   └── functions/
│       └── server/                # Edge function code
├── utils/                         # Shared utilities
│   └── supabase/
│       └── info.tsx               # Supabase connection info
├── docs/                          # Documentation (generated)
├── examples/                      # Example BIBFRAME records
├── guidelines/                    # Development guidelines
├── index.html                     # HTML entry point
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite build config
├── postcss.config.mjs             # PostCSS config
└── 100+ .md files                 # Documentation
```

### Key Directories

**`/src/app/components/`** (100+ files)
- All React components organized by function

**`/supabase/functions/server/`** (36 files)
- All backend logic, routes, services

**`/src/app/services/`**
- Frontend service layer (API clients, utilities)

**`/src/styles/`**
- Theme CSS files, Tailwind config, fonts

**`/src/app/types/`**
- TypeScript type definitions

**`/src/app/i18n/`**
- Internationalization configuration

---

## Developer Guide

### Prerequisites

1. **Node.js** v18+ ([nodejs.org](https://nodejs.org))
2. **pnpm** v8+ (`npm install -g pnpm`)
3. **Supabase CLI** ([supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli))
4. **Git**
5. **VS Code** (recommended)

### Setup Steps

1. **Clone the repository** (if not using Figma Make):
   ```bash
   git clone <repository-url>
   cd moon-sand-v2
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up Supabase**:
   - Create project at [supabase.com](https://supabase.com)
   - Copy URL and anon key
   - Update `/utils/supabase/info.tsx`

4. **Deploy backend**:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy server --no-verify-jwt
   ```

5. **Set secrets**:
   ```bash
   supabase secrets set OPENAI_API_KEY=<your-key>
   supabase secrets set GEMINI_API_KEY=<your-key>
   supabase secrets set LLAMA_API_KEY=<your-key>
   supabase secrets set ISBNDB_API_KEY=<your-key>
   ```

6. **Run migration SQL**:
   - Copy SQL from `/BUILDING_MOON_IN_KARBALA_222_MIGRATION.md`
   - Paste into Supabase SQL Editor
   - Click "Run"

7. **Start dev server**:
   ```bash
   pnpm dev
   ```

8. **Open in browser**:
   ```
   http://localhost:5173
   ```

9. **Login** (demo account):
   ```
   Email: demo@moon.local
   Password: demo123
   ```

### Development Workflow

**Frontend Changes:**
1. Edit files in `/src/app/`
2. Vite hot-reloads automatically
3. Check browser console for errors

**Backend Changes:**
1. Edit files in `/supabase/functions/server/`
2. Redeploy: `supabase functions deploy server --no-verify-jwt`
3. Check Edge Function logs in Supabase dashboard

**Database Changes:**
1. Write SQL in Supabase SQL Editor
2. Test in development
3. Apply to production (if applicable)

**Styling Changes:**
1. Edit Tailwind classes directly in components
2. Or modify theme files in `/src/styles/`

### Debugging Tips

**Frontend:**
- Use React DevTools
- Check browser console
- Use `console.log()` liberally
- Check Network tab for API errors

**Backend:**
- Check Supabase Edge Function logs
- Use `console.log()` in server code
- Test routes with curl or Postman
- Check Supabase database tables

**Common Errors:**

1. **"Failed to fetch dynamically imported module"**
   - Solution: Component is lazy-loaded, check network connectivity

2. **"Unauthorized" from backend**
   - Solution: Check Supabase keys in `/utils/supabase/info.tsx`

3. **AI provider errors**
   - Solution: Check API keys in Supabase secrets

4. **Dark mode text invisible**
   - Solution: Add `[.animated-gradient-bg-blue_&]:text-slate-100` class

---

## Future Roadmap

### Phase 4: Finalize Migration (Next 2 weeks)
- [ ] Convert `index.tsx` KV calls to db.tsx
- [ ] Run migration SQL in production
- [ ] Remove deprecated kv_store.tsx
- [ ] Full regression testing

### Phase 5: BlueMoon Fix (TBD)
- [ ] Investigate BlueMoon dynamic import error
- [ ] Refactor component architecture if needed
- [ ] Restore full functionality

### Phase 6: Dark Mode Polish (1 week)
- [ ] Systematic audit of all components
- [ ] Fix text visibility issues
- [ ] Add dark mode preview in Dashboard

### Phase 7: Security Hardening (2 weeks)
- [ ] Rotate all API keys
- [ ] Implement rate limiting on server
- [ ] Add request signing
- [ ] Penetration testing

### Phase 8: Performance Optimization (3 weeks)
- [ ] Add Redis caching layer
- [ ] Optimize SPARQL queries
- [ ] Lazy load more components
- [ ] Add service worker for offline support

### Phase 9: Mobile Support (4 weeks)
- [ ] Responsive design audit
- [ ] Touch-optimized UI
- [ ] Progressive Web App (PWA)
- [ ] Mobile cataloging workflows

### Phase 10: Advanced Features (Ongoing)
- [ ] Real-time collaboration (WebSockets)
- [ ] Batch import from external catalogs
- [ ] Advanced analytics dashboard
- [ ] Machine learning for auto-classification
- [ ] BIBFRAME 3.0 support (when released)

---

## Appendix: Quick Reference Card

### Essential Commands

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Deploy backend
supabase functions deploy server --no-verify-jwt

# Set secret
supabase secrets set KEY=value

# View backend logs
supabase functions logs server

# Link to Supabase project
supabase link --project-ref <ref>
```

### Key Files

| File | Purpose |
|------|---------|
| `/src/app/App.tsx` | Main application entry |
| `/src/app/components/Dashboard.tsx` | Dashboard |
| `/supabase/functions/server/index.tsx` | Main server |
| `/supabase/functions/server/db.tsx` | Database layer |
| `/utils/supabase/info.tsx` | Supabase config |
| `/package.json` | Dependencies |
| `/BUILDING_MOON_IN_KARBALA_222_MIGRATION.md` | Migration SQL |

### Important URLs

| Service | URL |
|---------|-----|
| Supabase Dashboard | https://supabase.com/dashboard |
| Frontend Dev Server | http://localhost:5173 |
| Backend Edge Function | https://`<project-id>`.supabase.co/functions/v1/make-server-49c0e13c |
| Supabase SQL Editor | https://supabase.com/dashboard/project/`<project-id>`/sql |

### Default Credentials

```
Email: demo@moon.local
Password: demo123
```

---

## Conclusion

**MOON SAND V2** represents a paradigm shift in library cataloging systems. By embracing semantic web technologies, multi-AI orchestration, and modern UX design, it bridges the gap between traditional MARC cataloging and the future of linked open data.

The project is **93% complete** on its database migration journey, with robust infrastructure already in place. The remaining work (index.tsx conversion) is well-documented and manageable. Once complete, MOON will be a fully production-ready, enterprise-grade BIBFRAME cataloging platform unlike any other in existence.

### Key Achievements

✅ 166+ API routes  
✅ 19 federated discovery sources  
✅ Multi-AI routing with circuit breaker  
✅ Full RDF triple store  
✅ Complete i18n (English/Arabic)  
✅ iOS-inspired glassmorphism UI  
✅ 14/15 backend modules migrated to PostgreSQL  
✅ Comprehensive audit logging  
✅ Multi-tenant architecture  
✅ SHACL validation  
✅ Version control for all records  

### Remaining Challenges

⏳ Complete index.tsx migration  
⚠️ Fix BlueMoon dynamic import error  
🎨 Polish dark mode text visibility  
🔐 Rotate exposed API keys  

---

**Report Generated:** March 7, 2026  
**Project Status:** Active Development - Phase 3 (Database Migration)  
**Next Milestone:** index.tsx conversion → SQL migration → Phase 4

**For questions or support, contact:** Isaac Faleh

---

*This report was generated as part of the "Building MOON in Karbala" documentation series.*

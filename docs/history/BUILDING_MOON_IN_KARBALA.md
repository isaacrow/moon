# Building MOON in Karbala

## A Complete Technical Report on the MOON SAND V2 Semantic Cataloging Engine

**Author:** Isaac Faleh
**Location:** Karbala, Iraq
**Date:** March 7, 2026
**Version:** MOON SAND V2 (Build 619+)

---

## Table of Contents

1. [Vision & Origin](#1-vision--origin)
2. [What MOON Is](#2-what-moon-is)
3. [Architecture Overview](#3-architecture-overview)
4. [The Frontend: React Application](#4-the-frontend-react-application)
5. [The Backend: Supabase Edge Functions](#5-the-backend-supabase-edge-functions)
6. [The 5-Phase AI Engine](#6-the-5-phase-ai-engine)
7. [MOON DIJLA: Multi-AI Router](#7-moon-dijla-multi-ai-router)
8. [The 19-Source Federated Discovery Engine](#8-the-19-source-federated-discovery-engine)
9. [LD4 Integration Platform](#9-ld4-integration-platform)
10. [The Triple Store & RDF Pipeline](#10-the-triple-store--rdf-pipeline)
11. [Authority Control System](#11-authority-control-system)
12. [Record Lifecycle & Versioning](#12-record-lifecycle--versioning)
13. [Multi-Tenant Architecture](#13-multi-tenant-architecture)
14. [Security & Data Isolation](#14-security--data-isolation)
15. [Arabic / RTL & Internationalization](#15-arabic--rtl--internationalization)
16. [iOS Glassmorphism Design System](#16-ios-glassmorphism-design-system)
17. [MARC 21 Conversion Engine](#17-marc-21-conversion-engine)
18. [SHACL Validation Engine](#18-shacl-validation-engine)
19. [SPARQL Interface](#19-sparql-interface)
20. [The Four Major Standalone Platforms](#20-the-four-major-standalone-platforms)
21. [Complete File Inventory](#21-complete-file-inventory)
22. [Complete API Route Inventory](#22-complete-api-route-inventory)
23. [Data Flow Diagrams](#23-data-flow-diagrams)
24. [Known Issues & Technical Debt](#24-known-issues--technical-debt)
25. [Technology Stack Summary](#25-technology-stack-summary)
26. [What Makes This Project Unique](#26-what-makes-this-project-unique)

---

## 1. Vision & Origin

MOON was born in Karbala, Iraq -- built by Isaac Faleh as a one-person engineering effort to create a world-class BIBFRAME semantic cataloging engine that could stand alongside systems from the Library of Congress, OCLC, and the LD4 community.

The name "MOON" reflects the project's identity -- a luminous system built in the city of Imam Hussein, where the crescent moon holds deep cultural and spiritual significance. The sub-names follow this celestial theme: MOON SAND (the desert landscape of Karbala), MOON DIJLA (the Tigris/Dijla river that flows through Iraq), MOON WAVE, MOON NEXUS, and MOON FALEH (the creator's family name).

The core thesis: **a single developer in Karbala can build a semantic linked data platform that interoperates with the Library of Congress, VIAF, Wikidata, Europeana, DPLA, and 14 other international knowledge institutions -- with full Arabic/RTL support from day one.**

---

## 2. What MOON Is

MOON SAND V2 is an **ontology-driven BIBFRAME 2.0/3.0 semantic cataloging engine** with:

- **Full Linked Data compliance** -- produces valid JSON-LD, Turtle, N-Triples, and MARC 21
- **19 federated discovery sources** -- searches across LOC, VIAF, Wikidata, WorldCat, Europeana, DPLA, BnF, GND, ISNI, and more simultaneously
- **Multi-AI assistance** -- OpenAI GPT, Google Gemini, and Meta LLaMA with automatic fallback and circuit breaker pattern
- **Enterprise features** -- multi-tenant isolation, row-level security, SHACL validation, immutable audit logs, version control with SHA-256 checksums
- **Native Arabic/RTL support** -- complete bilingual interface (English + Arabic) with RTL layout switching
- **iOS-inspired glassmorphism UI** -- frosted glass panels, blur effects, dark mode, 4 theme variants

It is **not** a toy or a demo. It has 166+ API routes, 130+ React components, 37 backend server modules, and a PostgreSQL persistence layer. It handles real BIBFRAME records that can be exported to MARC 21, uploaded to triple stores (Fuseki/Blazegraph/GraphDB), and shared with other LD4 systems like Sinopia and Share-VDE.

---

## 3. Architecture Overview

```
+------------------------------------------------------------------+
|                        BROWSER (React 18)                         |
|  /src/app/App.tsx → Dashboard → 55+ ViewModes → 130+ Components  |
|  Tailwind CSS v4 + iOS Glassmorphism + Dark Mode + RTL           |
+----------------------------------+-------------------------------+
                                   |
                         HTTPS (fetch + Bearer token)
                                   |
+----------------------------------v-------------------------------+
|              SUPABASE EDGE FUNCTION (Deno + Hono)                |
|  /supabase/functions/server/index.tsx                            |
|  166+ API routes → 37 server modules                            |
|                                                                  |
|  +--------------+  +-----------+  +----------+  +-----------+   |
|  | AI Engine    |  | Discovery |  | Records  |  | Authority |   |
|  | (5 phases)   |  | (19 src)  |  | Service  |  | Manager   |   |
|  +--------------+  +-----------+  +----------+  +-----------+   |
|  +--------------+  +-----------+  +----------+  +-----------+   |
|  | DIJLA Router |  | LD4       |  | Triple   |  | SHACL     |   |
|  | (3 AI + CB)  |  | Platform  |  | Store    |  | Validator |   |
|  +--------------+  +-----------+  +----------+  +-----------+   |
|  +--------------+  +-----------+  +----------+  +-----------+   |
|  | Versioning   |  | Multi-    |  | MARC     |  | Audit     |   |
|  | (immutable)  |  | Tenant    |  | Convert  |  | Log       |   |
|  +--------------+  +-----------+  +----------+  +-----------+   |
+----------------------------------+-------------------------------+
                                   |
                         Supabase Client SDK
                                   |
+----------------------------------v-------------------------------+
|                    SUPABASE POSTGRESQL                           |
|  kv_store_49c0e13c (key TEXT PK, value JSONB)                   |
|  + Supabase Auth (users, sessions)                              |
|  + Supabase Storage (file attachments)                          |
+------------------------------------------------------------------+
```

**Three-tier architecture:**
1. **Frontend:** React 18 + Vite 6 + Tailwind CSS v4 (static SPA)
2. **Backend:** Hono web server running as a Supabase Edge Function (Deno runtime)
3. **Database:** PostgreSQL via Supabase, with a generic key-value table for all persistence

---

## 4. The Frontend: React Application

### Entry Point Chain

```
index.html
  └─ /src/main.tsx (React root)
       └─ /src/app/App.tsx (main component)
            ├─ AuthProvider (authentication context)
            ├─ JCricketProvider (provenance/metadata context)
            ├─ ThemeProvider (dark mode, theme style, engine theme)
            └─ CatalogApp (the actual application)
                 ├─ TopNavBar
                 ├─ Dashboard (main landing)
                 └─ 55+ ViewModes (lazy-loaded via React.lazy)
```

### View Modes (55 total)

The application uses a state machine pattern (`useState<ViewMode>`) with 55 distinct view modes:

| ViewMode | Component | Description |
|---|---|---|
| `dashboard` | `Dashboard.tsx` | Main landing with stats, cards, recent records |
| `catalog` | `EnhancedWorkForm` + `InstanceForm` | Traditional BIBFRAME work/instance cataloging |
| `bibframe-search` | `BibframeSearchPage.tsx` | Search LOC linked data |
| `opac` | `OPACView.tsx` | Public OPAC display of records |
| `blue-moon` | `BlueMoon.tsx` | Advanced field customization editor |
| `moon-engine` | `MoonEngineThemed.tsx` | Themed cataloging engine |
| `moon-linked-data-engine` | `MoonEngine.tsx` | Full linked data engine |
| `moon-oshin` | `MoonOshinPro.tsx` | Professional cataloging interface |
| `moon-sand` | `MoonSand.tsx` | Cataloging sandbox |
| `moon-sand-v2` | `MoonSandV2.tsx` | V2 sandbox |
| `moon-faleh` | `MoonFaleh.tsx` | Full BIBFRAME system |
| `moon-dijla` | `MoonDijla.tsx` | Unified BIBFRAME engine |
| `moon-nexus` | `MoonNexus.tsx` | 5-tab working cataloging workstation |
| `moon-ai-orchestrator` | `MoonAIOrchestrator.tsx` | 10-tab multi-AI agent system |
| `moon-dijla-core` | `MoonDijlaCore.tsx` | 8-tab enterprise linked data infrastructure |
| `dijla-platform` | `DijlaPlatform.tsx` | Enterprise multi-AI command center |
| `ld4-platform` | `LD4Platform.tsx` | LD4 linked data for production |
| `linked-data-discovery` | `LinkedDataDiscovery.tsx` | 19-source federated discovery |
| `moon-ai` | `MoonAI.tsx` | AI cataloging assistant |
| `enterprise-ai` | `EnterpriseAIEngine.tsx` | Enterprise AI engine |
| `bibframe2marc` | `Bibframe2Marc.tsx` | BIBFRAME to MARC converter |
| `marc2bibframe` | `Marc2Bibframe.tsx` | MARC to BIBFRAME converter |
| `ontology-browser` | `BibframeOntologyBrowser.tsx` | BIBFRAME 3.0.1 ontology browser |
| `authority-manager` | `AuthorityFileManager.tsx` | Authority file management |
| `sparql-interface` | `SparqlInterface.tsx` | SPARQL query interface |
| `all-records` | `RecordsGallery.tsx` | Gallery of all saved records |
| `settings` | `SettingsPanel.tsx` | System settings |
| `moon-testing` | `MoonTesting.tsx` | RDF/JSON-LD validation & testing |
| ...and 27 more | | |

### Lazy Loading Strategy

Every view beyond the Dashboard is lazy-loaded with `React.lazy()` to prevent the `Failed to fetch dynamically imported module` error that occurs when too many large components are eagerly imported:

```tsx
const BlueMoon = React.lazy(() => import('./components/BlueMoon'));
const MoonNexus = React.lazy(() => import('./components/MoonNexus'));
const MoonAIOrchestrator = React.lazy(() => import('./components/MoonAIOrchestrator'));
// ... 80+ more lazy imports
```

Each lazy component is wrapped in `<React.Suspense>` with a loading fallback.

### Component Directory Structure

```
/src/app/components/
  ├── ui/                    # 42 shadcn/ui components (Button, Card, Dialog, etc.)
  ├── cataloging/            # 6 cataloging-specific components
  │   ├── AuthoritySelect.tsx
  │   ├── BlankNodeEditors.tsx
  │   ├── CatalogingWizard.tsx
  │   ├── DynamicFormRenderer.tsx
  │   ├── OntologyDrivenFormRenderer.tsx
  │   └── ValidationPanel.tsx
  ├── fields/                # 6 specialized field components
  │   ├── BibframeLinkedField.tsx
  │   ├── CountrySearchField.tsx
  │   ├── LocApiSearchField.tsx
  │   └── ...
  ├── ontology/              # 10 ontology-driven form field components
  │   ├── OntologyField.tsx  # Core ontology field renderer
  │   ├── EntityField.tsx
  │   ├── LiteralField.tsx
  │   ├── ClassificationField.tsx
  │   ├── LocNameSearch.tsx
  │   ├── LocSubjectSearch.tsx
  │   ├── LocPlaceSearch.tsx
  │   └── ...
  ├── sonic/                 # Sonic Engine subsystem
  │   ├── SonicEngine.tsx
  │   ├── services/          # 5 service modules
  │   └── types/             # Type definitions
  ├── RecordView/            # Multi-view record display
  │   ├── MarcView.tsx
  │   ├── OPACView.tsx
  │   ├── RdfView.tsx
  │   └── MultiViewRecord.tsx
  ├── figma/                 # Figma integration
  │   └── ImageWithFallback.tsx
  └── [90+ standalone components]
```

### Context Providers

| Context | File | Purpose |
|---|---|---|
| `AuthContext` | `AuthContext.tsx` | Authentication state (login, logout, access tokens via Supabase Auth) |
| `JCricketContext` | `JCricketContext.tsx` | Cataloger provenance tracking (user profile, institution, cataloging rules) |
| `ThemeContext` | `ThemeContext.tsx` | Theme management (4 styles: ios26/macos/apple-store/classic, dark mode, engine theme) |

### Frontend Services (35+ modules)

```
/src/app/services/
  ├── authorityHub/          # 7 modules - unified authority lookup
  │   ├── locService.ts      # Library of Congress authority search
  │   ├── viafService.ts     # VIAF authority search
  │   ├── wikidataService.ts # Wikidata entity search
  │   ├── afiqaService.ts    # AFIQA Arabic authority (custom)
  │   ├── isbndbService.ts   # ISBNdb lookup
  │   └── authorityHubService.ts # Unified hub orchestrator
  ├── bibframe/              # 4 modules - BIBFRAME ontology processing
  │   ├── bibframeOntology.ts
  │   ├── bibframeOntologyEngine.ts
  │   ├── bibframeFieldMapper.ts
  │   └── bibframeExportEngine.ts
  ├── loc/                   # 5 modules - LOC API integrations
  │   ├── locLanguagesAPI.ts
  │   ├── locOrganizationsAPI.ts
  │   ├── locRDAVocabulariesAPI.ts
  │   ├── locRelatorsAPI.ts
  │   └── locAdminMetadataAPI.ts
  ├── kami/                  # 3 modules - Kami ontology engine
  │   ├── kamiOntologyEngine.ts
  │   ├── kamiRecordService.ts
  │   └── kamiValidationEngine.ts
  └── [15+ more service modules]

/src/services/               # Core shared services
  ├── rdfGraphBuilder.ts     # JSON-LD → Turtle/N-Triples with toTurtle(), extractTriples()
  ├── authoritySearch.ts     # VIAF/LOC authority search with AbortController timeout
  ├── bibframeOntology.ts    # BIBFRAME ontology model
  ├── bibframeValidator.ts   # Client-side BIBFRAME validation
  ├── graphStore.ts          # In-memory graph store
  ├── ontologyRegistry.ts    # Ontology class/property registry
  ├── templateEngine.ts      # Template processing engine
  ├── uriMintingService.ts   # Stable URI generation
  ├── w3cJsonLdBuilder.ts    # W3C-compliant JSON-LD construction
  ├── recordPersistence.ts   # Record save/load orchestration
  ├── recordStorageService.ts # localStorage-based storage
  └── [5+ more services]
```

---

## 5. The Backend: Supabase Edge Functions

### Server Entry Point

`/supabase/functions/server/index.tsx` is the single Hono web server that handles all 166+ API routes. It runs on Deno as a Supabase Edge Function.

**Boot Sequence:**
1. Create demo user if needed (email: `demo@moon.local`, password: `demo123`)
2. Initialize load testing infrastructure
3. Mark boot complete
4. Start Deno server: `Deno.serve(app.fetch)`

**CORS Configuration:** Open CORS with all methods and headers allowed (development/prototyping mode).

### Server Module Map (37 files)

| Module | File | Purpose |
|---|---|---|
| **Main Server** | `index.tsx` | Hono app, route registration, boot sequence |
| **KV Store** | `kv_store.tsx` | PostgreSQL key-value persistence (PROTECTED) |
| **AI Engine** | `aiEngine.tsx` | 5-phase AI cataloging assistance |
| **AI Providers** | `aiProviders.tsx` | OpenAI/Gemini/LLaMA adapter classes |
| **AI Router** | `aiRouter.tsx` | MOON DIJLA smart routing + circuit breaker |
| **Discovery** | `discovery.tsx` | Federated search orchestrator |
| **Discovery Providers** | `discoveryProviders.tsx` | 19 pluggable source adapters |
| **LD4 Integration** | `ld4Integration.tsx` | Sinopia templates, LD4P profiles, Share-VDE |
| **Records (Moon)** | `moonRecords.tsx` | BIBFRAME record CRUD + RDF conversion |
| **Record Service** | `recordService.tsx` | Production-hardened record management |
| **Record Routes** | `recordRoutes.tsx` | REST API route handlers for records |
| **Authorities** | `authorities.tsx` | Authority record management |
| **Triple Store** | `tripleStore.tsx` | External triple store integration (Fuseki/Blazegraph/GraphDB) |
| **Graph Builder** | `graphBuilder.tsx` | JSON-LD graph construction |
| **Versioning** | `versioning.tsx` | Immutable version history with named graphs |
| **Audit Log** | `auditLog.tsx` | Append-only lifecycle tracking |
| **Canonical JSON-LD** | `canonicalJsonLd.tsx` | Deterministic serialization + SHA-256 checksums |
| **Ontology** | `ontology.tsx` | BIBFRAME ontology definitions |
| **Ontology Engine** | `bibframeOntologyEngine.tsx` | Ontology-driven form generation |
| **Engine** | `engine.tsx` | Core BIBFRAME processing engine |
| **RDF Parser** | `rdfParser.tsx` | JSON-LD parsing |
| **RDF Exporter** | `rdfExporter.tsx` | Multi-format RDF export |
| **MARC Converter** | `marcConverter.tsx` | BIBFRAME → MARC 21 conversion |
| **MARC Mapping** | `marcMappingRegistry.tsx` | Declarative BIBFRAME-to-MARC field mappings |
| **SHACL Shapes** | `shaclShapes.tsx` | W3C SHACL constraint definitions |
| **SHACL Validator** | `shaclValidator.tsx` | SHACL validation execution engine |
| **Multi-Tenant** | `multiTenant.tsx` | Institution/user/role management |
| **Data Isolation** | `dataIsolation.tsx` | Row-level tenant isolation |
| **Auth Middleware** | `authMiddleware.tsx` | Authentication middleware |
| **JWT Auth** | `jwtAuth.tsx` | JWT token verification |
| **Authority Merge** | `authorityMergeIntegrity.tsx` | Authority merge with referential integrity |
| **LOC Authority** | `locAuthorityService.tsx` | Library of Congress authority lookup |
| **LOC SPARQL** | `locSparqlService.tsx` | LOC SPARQL endpoint queries |
| **Mind Map** | `mindMapGenerator.tsx` | RDF graph to mind map visualization |
| **Observability** | `observability.tsx` | Monitoring, metrics, error tracking |
| **Load Testing** | `loadTesting.tsx` | Performance testing infrastructure |
| **Examples** | `examples.tsx` | Example BIBFRAME records |

---

## 6. The 5-Phase AI Engine

File: `/supabase/functions/server/aiEngine.tsx`

The AI engine is designed as assistive, never authoritative. The cataloger is always the final authority. Every AI suggestion is logged and auditable.

### Phase 1: Multi-Source Federated Auto-Fill
Looks up the title/ISBN/DOI across 6 external sources simultaneously:
1. **Open Library** (ISBN + title)
2. **Google Books API** (ISBN + title)
3. **CrossRef** (DOI + title)
4. **ISBNdb** (ISBN, if API key is present)
5. **Library of Congress** (title + author)
6. **WorldCat/OCLC** (title)

Maps retrieved fields to BIBFRAME predicates (e.g., `bf:title`, `bf:contribution`, `bf:language`).

### Phase 2: AI Metadata Enrichment
Uses the selected AI provider to suggest:
- Subject headings (LCSH-style)
- Genre/Form terms
- Relator roles (e.g., author, editor, translator)
- Language detection
- Publication year extraction
- Series suggestions
- Summary generation
- Authority candidates

### Phase 3: Entity Linking
Matches entities (authors, organizations) to authority URIs:
- VIAF URIs
- Library of Congress Name Authority URIs
- Wikidata Q-numbers
- ISNI identifiers

### Phase 4: Duplicate Detection
Compares the record against existing catalog records to find:
- Exact duplicates
- Near-duplicates
- Records suitable for auto-merge vs. human review

### Phase 5: SPARQL Translation
Converts natural language queries into SPARQL:
- "Find all Arabic works published before 1950" → valid SPARQL query
- Safety checking (rejects destructive queries)
- Explanation of the generated query

### Audit Trail
Every AI operation is logged as an `AuditEntry`:
```typescript
interface AuditEntry {
  id: string;
  timestamp: string;
  featurePhase: string;     // "phase1", "phase2", etc.
  input: any;
  output: any;
  approved: boolean | null; // null = pending human review
}
```

---

## 7. MOON DIJLA: Multi-AI Router

Files: `/supabase/functions/server/aiRouter.tsx` + `aiProviders.tsx`

### Provider Adapters (Class-Based)

Each AI provider is implemented as a class extending `AIProviderBase`:

| Provider | Model | API |
|---|---|---|
| **OpenAI** | `gpt-4o-mini` | `https://api.openai.com/v1/chat/completions` |
| **Google Gemini** | `gemini-1.5-flash` | `https://generativelanguage.googleapis.com/v1beta/models/` |
| **Meta LLaMA** | `llama-3.3-70b-versatile` | Via Groq/Together AI API |

Each provider exposes 7 capabilities:
1. `generateText()` -- raw text generation
2. `suggestMetadata()` -- BIBFRAME metadata suggestions
3. `entityLink()` -- authority URI matching
4. `translateToSPARQL()` -- natural language → SPARQL
5. `detectDuplicates()` -- duplicate record detection
6. `autoFill()` -- multi-source auto-fill orchestration
7. `enhanceDiscovery()` -- discovery result enrichment

Providers auto-disable if their API key environment variable is missing.

### Smart Routing

The router selects the best provider based on task type with configurable fallback chains:

```typescript
routing: {
  "metadata":            ["openai", "gemini", "llama"],
  "entity-linking":      ["gemini", "openai", "llama"],
  "duplicate-detection": ["llama", "openai", "gemini"],
  "natural-search":      ["openai", "gemini", "llama"],
  "sparql-translate":    ["openai", "gemini", "llama"],
  "autofill":            ["openai", "gemini", "llama"],
  "discovery-enhance":   ["gemini", "openai", "llama"],
}
```

### Circuit Breaker Pattern

If a provider fails 5 consecutive times, the circuit breaker opens and the provider is disabled for a 5-minute cooldown period. The router automatically falls to the next provider in the chain.

```typescript
circuitBreaker: {
  threshold: 5,         // 5 consecutive failures
  cooldownMs: 300000,   // 5 minutes
}
```

### Health Monitoring

Each provider tracks real-time health metrics:
- `available` -- whether the API key is configured
- `circuitBreakerOpen` -- whether the circuit breaker has tripped
- `avgLatencyMs` -- rolling average response time
- `successRate` -- percentage of successful calls
- `consecutiveErrors` -- current failure streak
- `totalCalls` / `successCount` / `errorCount`

### Routing Audit Log

Every routing decision is persisted to the KV store:
```typescript
interface RoutingDecision {
  id: string;
  taskType: AITaskType;
  selectedProvider: AIProviderName;
  fallbackChain: AIProviderName[];
  fallbackUsed: boolean;
  attemptedProviders: string[];
  timestamp: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  retryCount: number;
}
```

### AI Governance

Every AI response includes governance metadata:
- Provider name and model version
- Confidence score (0-1)
- Timestamp
- Latency
- Routing decision ID (traceability)

---

## 8. The 19-Source Federated Discovery Engine

File: `/supabase/functions/server/discoveryProviders.tsx`

The discovery engine fans out search queries to 19 data sources simultaneously, merges results, deduplicates, and returns unified records tagged with their source origin.

### Provider Registry

| # | Provider | Source ID | Base URL | Data |
|---|---|---|---|---|
| 1 | **Local Catalog** | `internal` | (KV store) | Your own records |
| 2 | **Library of Congress** | `loc` | `https://id.loc.gov` | BIBFRAME linked data |
| 3 | **VIAF** | `viaf` | `https://viaf.org` | Virtual International Authority File |
| 4 | **Open Library** | `openlibrary` | `https://openlibrary.org` | Internet Archive books |
| 5 | **Wikidata** | `wikidata` | `https://www.wikidata.org` | Structured knowledge base |
| 6 | **WorldCat** | `worldcat` | `https://search.worldcat.org` | Global library catalog |
| 7 | **FAST** | `fast` | `https://fast.oclc.org` | Subject headings |
| 8 | **ISBNdb** | `isbndb` | `https://api2.isbndb.com` | ISBN database |
| 9 | **Google Books** | `googlebooks` | `https://www.googleapis.com/books` | Book metadata |
| 10 | **CrossRef** | `crossref` | `https://api.crossref.org` | DOI/scholarly metadata |
| 11 | **BnF** | `bnf` | `https://data.bnf.fr` | French National Library |
| 12 | **LCSH** | `lcsh` | `https://id.loc.gov/authorities/subjects` | LOC Subject Headings |
| 13 | **GND (via lobid)** | `lobidgnd` | `https://lobid.org/gnd` | German National Library |
| 14 | **ISNI** | `isni` | `https://isni.org` | International Standard Name Identifier |
| 15 | **HathiTrust** | `hathitrust` | `https://catalog.hathitrust.org` | Digital library |
| 16 | **Getty Vocabularies** | `getty` | `https://vocab.getty.edu` | ULAN/AAT/TGN |
| 17 | **Europeana** | `europeana` | `https://api.europeana.eu` | European digital heritage |
| 18 | **DPLA** | `dpla` | `https://api.dp.la` | Digital Public Library of America |
| 19 | **Share-VDE** | `sharevde` | `https://svde.org` | Virtual Discovery Environment |

### Unified Record Format

All providers normalize their results to a common structure:
```typescript
interface NormalizedRecord {
  id: string;
  title: string;
  document: any;        // Full JSON-LD or metadata
  createdAt: string;
  updatedAt: string;
  status: string;
  cataloger: string;
  resourceType: string;
  source: SourceId;     // Which provider returned this
  sourceUri?: string;   // Original external URI
}
```

### Source Metadata

Each source has visual metadata for the UI (color-coded badges):
```typescript
interface SourceMeta {
  id: SourceId;
  label: string;        // "Library of Congress"
  shortLabel: string;   // "LOC"
  color: string;        // "#dc2626" (red badge)
  icon: string;         // Lucide icon name
  baseUrl: string;
  enabled: boolean;
}
```

---

## 9. LD4 Integration Platform

File: `/supabase/functions/server/ld4Integration.tsx`

The LD4 (Linked Data for Production) integration layer connects MOON to the broader academic cataloging ecosystem:

### Sinopia Resource Templates
- Import Sinopia templates (property definitions, value constraints, defaults)
- Map Sinopia property templates to MOON's ontology-driven form fields
- Support for literal, resource, and lookup property types

### LD4P Profile Registry
- Import and manage LD4P profiles
- Track profile authorship and provenance
- Support for local, LD4P, and Sinopia-sourced profiles

### Authority Reconciliation
Cross-references entities against 5 authority systems:
- Library of Congress Name Authority
- VIAF
- Wikidata
- FAST
- Share-VDE

### Content Negotiation
Implements HTTP content negotiation for linked data dereferencing:
- `application/ld+json` → JSON-LD
- `text/turtle` → Turtle
- `application/n-triples` → N-Triples
- `text/html` → OPAC HTML view

### Share-VDE Integration
- Search the Share-VDE virtual discovery environment
- Import records from Share-VDE clusters

---

## 10. The Triple Store & RDF Pipeline

### RDF Conversion Pipeline

File: `/supabase/functions/server/moonRecords.tsx`

The pipeline uses **real RDF libraries** (jsonld.js + N3.js), not string concatenation:

```
JSON-LD Document
     │
     ├─► jsonld.toRDF() ──► N-Quads (intermediate)
     │        │
     │        ├─► N3.Parser ──► Quad objects
     │        │       │
     │        │       ├─► N3.Writer (Turtle) ──► .ttl output
     │        │       └─► N3.Writer (N-Triples) ──► .nt output
     │        │
     │        └─► Direct N-Quads output ──► Triple store upload
     │
     ├─► extractTriples() ──► Array<{subject, predicate, object, objectType}>
     │                         (for graph visualization)
     │
     └─► convertToMARC() ──► MARC 21 record
              (via marcConverter.tsx + marcMappingRegistry.tsx)
```

### Triple Store Integration

File: `/supabase/functions/server/tripleStore.tsx`

Supports 3 external triple stores:

| Store | Query Endpoint | Update Endpoint | Graph Store |
|---|---|---|---|
| **Apache Fuseki** | `/sparql` | `/update` | `/data` |
| **Blazegraph** | `/sparql` | `/sparql` | `?context-uri=` |
| **Ontotext GraphDB** | `/sparql` | `/statements` | `?context=` |

**Upload flow:**
1. Convert JSON-LD to N-Quads via `jsonld.toRDF()`
2. PUT to Graph Store Protocol endpoint (replaces graph) or POST (appends)
3. Each record gets its own named graph: `https://moon.org/record/{id}`
4. Each version gets a versioned graph: `https://moon.org/graph/{id}/v{n}`

**Query flow:**
1. Accept SPARQL query string
2. Execute against the triple store's SPARQL endpoint
3. Return `application/sparql-results+json`

### Canonical JSON-LD

File: `/supabase/functions/server/canonicalJsonLd.tsx`

Produces deterministic JSON-LD for reliable versioning:
- Stable URI ordering
- No duplicate blank nodes
- Proper BIBFRAME @context from official LOC namespace
- Deterministic property ordering
- SHA-256 checksum of canonical form using Node.js `crypto.createHash()`

---

## 11. Authority Control System

File: `/supabase/functions/server/authorities.tsx`

### Authority Record Structure
```typescript
interface Authority {
  id: string;
  uri: string;                    // e.g. 'https://moon.org/authority/person/{id}'
  type: 'Person' | 'Organization' | 'Topic' | 'Place' | 'Work' | 'GenreForm';
  label: string;
  alternateLabels?: string[];
  externalLinks?: {
    viaf?: string;                // VIAF URI
    lc?: string;                  // LOC URI
    wikidata?: string;            // Wikidata URI
    isni?: string;                // ISNI
    orcid?: string;               // ORCID
  };
  metadata: {
    created: string;
    modified: string;
    source?: 'local' | 'imported' | 'external';
    verified?: boolean;
    usageCount?: number;
  };
  rawData?: any;                  // Full authority record in JSON-LD
}
```

### Authority Hub (Frontend)

File: `/src/app/services/authorityHub/`

A unified authority lookup service that searches 5 sources in parallel:
1. **LOC** -- Library of Congress Name Authority
2. **VIAF** -- Virtual International Authority File
3. **Wikidata** -- Wikidata entities
4. **AFIQA** -- Arabic authority records (custom)
5. **ISBNdb** -- ISBN-based metadata

### Authority Merge with Referential Integrity

File: `/supabase/functions/server/authorityMergeIntegrity.tsx`

When merging duplicate authority records:
1. Identifies all records that reference the source authority
2. Updates all references to point to the target authority
3. Preserves the merge history in the version system
4. Logs the merge in the audit trail

---

## 12. Record Lifecycle & Versioning

### Record States

```
     ┌──────────┐
     │  draft   │ ←── created
     └────┬─────┘
          │ validate
     ┌────v─────┐
     │validated │
     └────┬─────┘
          │ publish (locks record)
     ┌────v─────┐
     │published │ ←── locked, checksum-verified
     └────┬─────┘
          │ archive (unlocks)
     ┌────v─────┐
     │ archived │
     └──────────┘
```

### Version Control

File: `/supabase/functions/server/versioning.tsx`

- **Every change creates a new version** -- versions are never overwritten
- Each version stores a complete JSON-LD snapshot (canonical form)
- Versions get their own named graph URI: `https://moon.org/graph/{id}/v{n}`
- **Rollback** creates a new version with old data (never deletes history)
- **Soft delete** marks the entity with `_deleted: true` but preserves all data
- **Restore** finds the last non-deleted version and creates a new version from it

### Checksum Verification

Every record stores a SHA-256 checksum of its canonical JSON-LD. On every load:
1. Recompute checksum from stored data
2. Compare with stored checksum
3. If mismatch → log `record.corrupted` audit event and throw error

### Publish Enforcement

Before publishing:
1. Check if latest version passed validation
2. Verify the checksum matches the validated version (prevents publishing modified records)
3. Lock the record (prevents further edits)
4. Create a version snapshot

---

## 13. Multi-Tenant Architecture

File: `/supabase/functions/server/multiTenant.tsx`

### Institution Model
```typescript
interface Institution {
  id: string;
  name: string;
  namespace: string;           // URI base: 'https://institution.org'
  baseUri: string;             // Resource URI base
  settings: {
    catalogingRules?: 'RDA' | 'AACR2' | 'custom';
    defaultLanguage?: string;
    bibframeVersion?: '2.0' | '3.0';
    enableAuthorities?: boolean;
    enableVersioning?: boolean;
    tripleStoreConfig?: any;
  };
  metadata: {
    type: 'library' | 'archive' | 'museum' | 'university' | 'research';
    country?: string;
  };
}
```

### Role-Based Access Control

6 roles with granular permissions:

| Role | Permissions |
|---|---|
| `admin` | Full system access |
| `cataloger` | Create/edit records |
| `authority_manager` | Manage authorities, merge duplicates |
| `graph_admin` | Triple store management |
| `sparql_admin` | SPARQL endpoint configuration |
| `viewer` | Read-only access |

15 permission types: `records.create`, `records.edit`, `records.delete`, `records.publish`, `authorities.create`, `authorities.edit`, `authorities.merge`, `authorities.delete`, `sparql.query`, `sparql.update`, `triplestore.sync`, `triplestore.config`, `admin.users`, `admin.settings`, `admin.audit`

---

## 14. Security & Data Isolation

File: `/supabase/functions/server/dataIsolation.tsx`

### Row-Level Isolation

All data access is namespaced by institution:
```typescript
// Key pattern: moon:{institutionId}:record:{recordId}
const key = `moon:${institutionId}:record:${recordId}`;
```

Every read operation verifies the institution ID matches the requesting user's institution.

### Authentication Flow

1. **Signup:** Server creates user via `supabase.auth.admin.createUser()` with `email_confirm: true`
2. **Login:** Frontend calls `supabase.auth.signInWithPassword()`, receives access token
3. **Protected routes:** Server verifies access token via `supabase.auth.getUser(accessToken)`
4. **Session persistence:** Frontend stores auth state in localStorage for session restoration

### Audit Log Immutability

The audit log is append-only:
- Old audit entries are **archived** (moved to `audit:archive:*` namespace), never deleted
- The `cleanupOldAudits()` function throws an error if called, directing users to `archiveOldAudits()` instead
- Archive retention: default 365 days

---

## 15. Arabic / RTL & Internationalization

File: `/src/app/i18n/config.ts`

### Bilingual Support

Full English and Arabic translations for the entire interface using `i18next` + `react-i18next`:

```typescript
const resources = {
  en: { translation: { /* 200+ keys */ } },
  ar: { translation: { /* 200+ keys */ } },
};
```

### RTL Switching

When the language changes to Arabic:
```typescript
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'ar';
```

The UI automatically flips:
- Navigation flows right-to-left
- Text alignment reverses
- Icons mirror where appropriate
- Margins/paddings swap via Tailwind's `rtl:` variants

### Arabic Example Records

File: `/src/app/utils/arabicExamples.ts`

4 pre-built Arabic BIBFRAME records for testing:
- Classical Arabic literature
- Islamic science
- Modern Arabic works
- Bilingual records

---

## 16. iOS Glassmorphism Design System

### Theme Files

| File | Purpose |
|---|---|
| `/src/styles/glassmorphism.css` | Frosted glass panels, blur containers, gradient effects |
| `/src/styles/blur-theme.css` | Additional blur effects |
| `/src/styles/neon-theme.css` | Neon/cyberpunk theme variant |
| `/src/styles/classic-theme.css` | Traditional clean theme |
| `/src/styles/classic-clean.css` | Minimal classic variant |
| `/src/styles/dijla-theme.css` | MOON DIJLA branded theme |
| `/src/styles/apple-themes.css` | Apple-inspired design tokens |

### Theme Variants

4 selectable themes via `ThemeContext`:

| Theme | Style |
|---|---|
| `ios26` | iOS 26 style -- frosted glass, rounded corners, subtle shadows |
| `macos` | macOS style -- sidebar layout, system fonts, toolbar |
| `apple-store` | Apple Store aesthetic -- clean white, product cards |
| `classic` | Traditional LIS interface -- dense, functional |

### Glassmorphism CSS Classes

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
}

.glass-panel-dark {
  background: rgba(30, 30, 46, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Dark Mode

Controlled by `ThemeContext.darkMode`, persisted in localStorage. Applied via:
- `document.documentElement.classList.add('dark')`
- Tailwind's `dark:` variant classes throughout all components

---

## 17. MARC 21 Conversion Engine

Files: `/supabase/functions/server/marcConverter.tsx` + `marcMappingRegistry.tsx`

### Declarative Mapping Registry

Instead of procedural conversion code, MARC mappings are defined declaratively:

```typescript
interface MARCFieldMapping {
  tag: string;          // MARC tag (e.g., "245")
  ind1: string;
  ind2: string;
  subfields: MARCSubfield[];
}
```

### Conversion Flow

```
BIBFRAME JSON-LD
     │
     ├── Find bf:Work node
     ├── Find bf:Instance node
     ├── Find bf:Item node
     │
     ├── Generate Leader: '00000nam  2200000Ia 4500'
     │
     ├── Map bf:title → 245 $a (Title Statement)
     ├── Map bf:contribution/bf:agent → 100 $a (Main Entry)
     ├── Map bf:publication → 264 $a,$b,$c (Production)
     ├── Map bf:extent → 300 $a (Physical Description)
     ├── Map bf:subject → 650 $a (Subject Headings)
     ├── Map bf:language → 008/35-37 (Language Code)
     └── ... (50+ field mappings)
```

Frontend components `Bibframe2Marc.tsx` and `Marc2Bibframe.tsx` provide UI for bidirectional conversion.

---

## 18. SHACL Validation Engine

Files: `/supabase/functions/server/shaclShapes.tsx` + `shaclValidator.tsx`

### W3C SHACL Shapes

SHACL (Shapes Constraint Language) defines validation rules as RDF shapes:

**Work Shape:**
- Must have at least one `bf:title` of type `bf:Title`
- `bf:hasInstance` must link to `bf:Instance`
- `bf:contribution` must link to `bf:Contribution`
- `bf:language` must be a URI (not a literal)

**Instance Shape:**
- Must have `bf:instanceOf` linking to a `bf:Work`
- Must have at least one `bf:title`
- `bf:identifiedBy` must link to `bf:Identifier`
- `bf:publication` must link to `bf:Publication`

**Title Shape:**
- Must have `bf:mainTitle` as a literal string

**Contribution Shape:**
- Must have `bf:agent` linking to a `bf:Agent`

### Validation Execution

The validator runs a 5-step process:
1. Upload document to temporary named graph in triple store
2. Upload SHACL shapes to shapes graph
3. Execute SHACL validation via SPARQL
4. Parse the validation report (violations, warnings, info)
5. Clean up temporary graphs

Returns:
```typescript
interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  warnings: ValidationViolation[];
  info: ValidationViolation[];
}
```

---

## 19. SPARQL Interface

File: `/src/app/components/SparqlInterface.tsx` + `/supabase/functions/server/locSparqlService.tsx`

Provides a full SPARQL query interface:
- Query editor with syntax highlighting
- Execute queries against the local triple store or LOC SPARQL endpoint
- Results displayed as table or JSON
- Pre-built example queries:
  - List all Works
  - Find works by author
  - Count records by type
  - Get complete record as JSON-LD

---

## 20. The Four Major Standalone Platforms

### MOON NEXUS (5 Tabs)

File: `/src/app/components/MoonNexus.tsx`

A unified working cataloging workstation with 5 tabs for different workflows. Designed as the primary cataloger workspace.

### MOON AI ORCHESTRATOR (10 Tabs)

File: `/src/app/components/MoonAIOrchestrator.tsx`

The multi-AI agent management system with 10 tabs covering:
- AI provider configuration
- Task routing rules
- Circuit breaker status
- Health monitoring dashboards
- Routing audit log
- AI governance reports
- Discovery enhancement
- Performance analytics

### MOON DIJLA CORE (8 Tabs)

File: `/src/app/components/MoonDijlaCore.tsx`

Enterprise BIBFRAME linked data infrastructure with 8 tabs for:
- Triple store management
- Named graph administration
- SPARQL interface
- RDF export/import
- SHACL validation
- Ontology browsing
- Federation configuration

### LD4 Platform + DIJLA Platform

Files: `/src/app/components/LD4Platform.tsx` + `/src/app/components/DijlaPlatform.tsx`

- **LD4Platform:** Linked Data for Production integration -- Sinopia templates, LD4P profiles, content negotiation, Share-VDE
- **DijlaPlatform:** Enterprise multi-AI command center -- provider dashboards, routing configuration, real-time health monitoring, federated discovery

---

## 21. Complete File Inventory

### By Category

| Category | File Count | Location |
|---|---|---|
| React Components | 130+ `.tsx` files | `/src/app/components/` |
| UI Components (shadcn) | 42 `.tsx` files | `/src/app/components/ui/` |
| Frontend Services | 35+ `.ts` files | `/src/app/services/` + `/src/services/` |
| Backend Server Modules | 37 `.tsx` files | `/supabase/functions/server/` |
| TypeScript Types | 6 `.ts` files | `/src/app/types/` |
| CSS/Theme Files | 11 `.css` files | `/src/styles/` |
| Utility Modules | 10+ `.ts` files | `/src/app/utils/` |
| Context Providers | 3 `.tsx` files | `/src/app/contexts/` |
| Hooks | 1 `.ts` file | `/src/app/hooks/` |
| i18n Config | 1 `.ts` file | `/src/app/i18n/` |
| Imported Assets | 25+ files | `/src/imports/` |
| Configuration | 4 files | Root (`vite.config.ts`, `tsconfig.json`, etc.) |
| Documentation | 120+ `.md` files | Root directory |

### Total Estimated Lines of Code

| Layer | Estimated LOC |
|---|---|
| Frontend Components | ~50,000+ |
| Frontend Services | ~8,000+ |
| Backend Server | ~12,000+ |
| CSS/Themes | ~3,000+ |
| Types/Interfaces | ~2,000+ |
| Configuration | ~500+ |
| **Total** | **~75,000+** |

---

## 22. Complete API Route Inventory

All routes are prefixed with `/make-server-49c0e13c/`.

### Health & System
- `GET /health` -- Health check
- `GET /boot-status` -- Boot sequence status

### Records (CRUD)
- `POST /records` -- Create record
- `GET /records` -- List records (with filters)
- `GET /records/:id` -- Get record by ID
- `PUT /records/:id` -- Update record
- `DELETE /records/:id` -- Delete (archive) record
- `GET /records/search` -- Search records
- `POST /records/:id/publish` -- Publish record
- `POST /records/:id/archive` -- Archive record
- `GET /records/:id/versions` -- List versions
- `GET /records/:id/versions/:v` -- Get specific version
- `POST /records/:id/rollback` -- Rollback to version
- `GET /records/:id/audit` -- Audit history
- `GET /records/:id/export` -- Export with metadata

### MOON Records (Alternative CRUD)
- `POST /moon/records` -- Save Moon record
- `GET /moon/records` -- List Moon records
- `GET /moon/records/:id` -- Get Moon record
- `DELETE /moon/records/:id` -- Delete Moon record
- `GET /moon/records/search` -- Search Moon records

### RDF & Graph
- `POST /rdf/parse` -- Parse JSON-LD
- `POST /rdf/turtle` -- Convert to Turtle
- `POST /rdf/ntriples` -- Convert to N-Triples
- `POST /rdf/nquads` -- Convert to N-Quads
- `POST /rdf/triples` -- Extract triples
- `POST /graph/build` -- Build RDF graph
- `POST /graph/validate` -- Validate graph

### Ontology
- `GET /ontology/classes` -- List BIBFRAME classes
- `GET /ontology/properties` -- List properties
- `GET /ontology/class/:name` -- Get class details
- `GET /ontology/form/:classUri` -- Get form definition

### Authorities
- `POST /authorities` -- Create authority
- `GET /authorities` -- List authorities
- `GET /authorities/:id` -- Get authority
- `PUT /authorities/:id` -- Update authority
- `DELETE /authorities/:id` -- Delete authority
- `POST /authorities/merge` -- Merge authorities
- `POST /authorities/search` -- Search authorities

### LOC Integration
- `GET /loc/search` -- Search LOC
- `GET /loc/sparql` -- LOC SPARQL query
- `GET /loc/authority/:type` -- LOC authority lookup

### Triple Store
- `POST /triplestore/upload` -- Upload to triple store
- `POST /triplestore/query` -- SPARQL query
- `POST /triplestore/update` -- SPARQL update
- `DELETE /triplestore/graph` -- Delete named graph
- `POST /triplestore/sync` -- Sync record to triple store

### AI Engine
- `POST /ai/autofill` -- Phase 1: Multi-source auto-fill
- `POST /ai/metadata` -- Phase 2: AI metadata enrichment
- `POST /ai/entity-link` -- Phase 3: Entity linking
- `POST /ai/duplicates` -- Phase 4: Duplicate detection
- `POST /ai/sparql` -- Phase 5: Natural language → SPARQL
- `POST /ai/discovery-enhance` -- Discovery enhancement
- `GET /ai/audit` -- AI audit log
- `GET /ai/health` -- AI provider health status
- `GET /ai/config` -- AI router configuration

### Discovery
- `POST /discovery/search` -- Federated search (19 sources)
- `GET /discovery/providers` -- List available providers
- `GET /discovery/stats` -- Discovery statistics

### LD4 Integration
- `POST /ld4/templates/import` -- Import Sinopia template
- `GET /ld4/templates` -- List templates
- `GET /ld4/profiles` -- List LD4P profiles
- `POST /ld4/reconcile` -- Authority reconciliation
- `GET /ld4/negotiate` -- Content negotiation

### Multi-Tenant
- `POST /institutions` -- Create institution
- `GET /institutions` -- List institutions
- `POST /users` -- Create user
- `GET /users` -- List users

### SHACL Validation
- `POST /shacl/validate` -- Validate against SHACL shapes
- `GET /shacl/shapes` -- Get SHACL shapes

### MARC Conversion
- `POST /marc/convert` -- BIBFRAME → MARC 21
- `POST /marc/parse` -- MARC → BIBFRAME

### Versioning & Audit
- `POST /versions/:entityType/:id` -- Create version
- `GET /versions/:entityType/:id` -- List versions
- `POST /rollback/:entityType/:id` -- Rollback
- `GET /audit` -- Get audit logs

### Observability
- `GET /metrics` -- Performance metrics
- `GET /errors` -- Error log
- `POST /alerts` -- Trigger alert

### Field Templates (BlueMoon)
- `GET /field-templates` -- Get all templates
- `PUT /field-templates` -- Save templates
- `DELETE /field-templates/:id` -- Delete template

### Auth
- `POST /signup` -- Create new user
- `POST /login` -- User login

**Total: 166+ routes**

---

## 23. Data Flow Diagrams

### Record Creation Flow

```
User fills BIBFRAME form (React)
     │
     ├── Client-side validation (bibframeValidator.ts)
     ├── Build JSON-LD graph (rdfGraphBuilder.ts)
     │
     ▼
POST /records (Hono server)
     │
     ├── Canonical JSON-LD serialization (canonicalJsonLd.tsx)
     ├── SHA-256 checksum generation
     ├── Store record → KV: record:{id}
     ├── Store indexes → KV: record:index:{id}:*
     ├── Create initial version → KV: version:{id}:v1
     ├── Log audit → KV: audit:{id}:{timestamp}
     │
     ├── (Optional) Sync to triple store
     │   ├── jsonld.toRDF() → N-Quads
     │   └── PUT to Fuseki/Blazegraph/GraphDB
     │
     └── Return RecordMetadata to frontend
```

### AI-Assisted Cataloging Flow

```
User enters title/ISBN
     │
     ▼
POST /ai/autofill
     │
     ├── DIJLA Router selects provider
     │   ├── Check circuit breakers
     │   ├── Select primary: openai
     │   ├── Fallback chain: [gemini, llama]
     │   └── Log routing decision
     │
     ├── Fan out to 6 sources:
     │   ├── Open Library API
     │   ├── Google Books API
     │   ├── CrossRef API
     │   ├── ISBNdb API
     │   ├── LOC Search API
     │   └── WorldCat API
     │
     ├── Merge results + deduplicate
     ├── Map to BIBFRAME predicates
     ├── Log AI audit entry
     │
     └── Return AutoFillResult
          │
          ▼
     Frontend presents suggestions
     User approves/rejects each
     (AI is assistive, cataloger is authority)
```

### Federated Discovery Flow

```
User searches "كتاب القانون في الطب"
     │
     ▼
POST /discovery/search
     │
     ├── Fan out to 19 providers (parallel):
     │   ├── Internal KV (4 prefix scans)
     │   ├── LOC (id.loc.gov)
     │   ├── VIAF (viaf.org)
     │   ├── Wikidata (SPARQL)
     │   ├── WorldCat
     │   ├── Open Library
     │   ├── Google Books
     │   ├── BnF (data.bnf.fr)
     │   ├── GND (lobid.org)
     │   ├── Europeana
     │   ├── DPLA
     │   └── ... (8 more)
     │
     ├── Each returns NormalizedRecord[]
     ├── Merge all results
     ├── Deduplicate by title similarity
     ├── Tag each with source badge
     │
     └── Return unified result set
          │
          ▼
     Frontend displays with source badges:
     [LOC] [VIAF] [Wikidata] [BnF] [Europeana] ...
```

---

## 24. Known Issues & Technical Debt

### Active Issues

| Issue | Status | Notes |
|---|---|---|
| `BlueMoon.tsx` dynamic import error | **DO NOT TOUCH** | Persistent `TypeError: Failed to fetch dynamically imported module`. Must not be modified unless explicitly requested. |
| OpenAI API key exposure | **Needs rotation** | Key was exposed; must be rotated at platform.openai.com/api-keys |
| `GEMINI_API_KEY` not set | **Pending** | Supabase secret needs to be created |
| `LLAMA_API_KEY` not set | **Pending** | Supabase secret needs to be created |
| Dark mode text in `OntologyField.tsx` | **Partial fix** | Label and Badge text fixed with Tailwind arbitrary ancestor selectors; other text elements still have readability issues |

### Resolved Issues

| Issue | Fix Applied |
|---|---|
| VIAF CORS error | Switched to `https://viaf.org/` (no `www.`) with AbortController timeout in `authoritySearch.ts` |
| Duplicate `LOC-undefined` key | Null guard in `AuthoritySelect.tsx` |
| `toTurtle()` null crash | Null/type guards in `rdfGraphBuilder.ts` |
| `extractTriples()` null crash | Null/type guards in `rdfGraphBuilder.ts` |
| `validateGraphConnectivity()` crash | Type guards in `rdfGraphBuilder.ts` |
| BlueMoon field templates lost on reload | Backend persistence via 3 new KV routes + localStorage fallback |

### Technical Debt

1. **Single KV table for everything** -- All data stored as key-value pairs in one table. Should be migrated to a proper relational schema (see `POSTGRESQL_SCHEMA.md`).
2. **No database indexes** -- The KV store uses `LIKE` prefix queries which are O(n). A relational schema with proper indexes would be dramatically faster.
3. **Frontend state machine complexity** -- 55 view modes managed by a single `useState<ViewMode>` in App.tsx. Should be migrated to React Router.
4. **130+ components in flat directory** -- No subdirectory organization beyond `ui/`, `cataloging/`, `fields/`, `ontology/`. Large components like `BlueMoon.tsx` (~2200+ lines) should be split.
5. **Duplicate data models** -- `RecordMetadata` (recordService.tsx) and `MoonRecord` (moonRecords.tsx) serve similar purposes with different structures.

---

## 25. Technology Stack Summary

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| Vite | 6.3.5 | Build tool and dev server |
| TypeScript | (bundled) | Type safety |
| Tailwind CSS | 4.1.12 | Utility-first CSS |
| Radix UI | Various | Accessible UI primitives (42 components) |
| Lucide React | 0.487.0 | Icon library |
| i18next | 25.8.4 | Internationalization (EN + AR) |
| React Hook Form | 7.55.0 | Form management |
| Recharts | 2.15.2 | Charts and graphs |
| Motion (Framer) | 12.23.24 | Animations |
| ReactFlow | 11.11.4 | Graph/flow visualization |
| D3.js | 7.9.0 | Data visualization |
| Sonner | 2.0.3 | Toast notifications |
| Axios | 1.13.5 | HTTP client |
| UUID | 13.0.0 | ID generation |
| date-fns | 3.6.0 | Date utilities |
| cmdk | 1.1.1 | Command palette |
| Redux Toolkit | 2.11.2 | State management |
| MUI Material | 7.3.5 | Additional UI components |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Deno | Latest | Runtime (Supabase Edge Functions) |
| Hono | Latest (npm) | Web framework |
| Supabase JS | 2.49.8 (jsr) | Database + Auth client |
| jsonld | 9.0.0 (npm) | JSON-LD processing |
| N3 | 2.0.1 (npm) | RDF parsing/serialization |
| js-yaml | 4.1.1 | YAML parsing |

### Infrastructure

| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database, Auth, Storage, Edge Functions |
| OpenAI API | GPT-4o-mini for AI assistance |
| Google Gemini API | Gemini 1.5 Flash for AI fallback |
| Meta LLaMA API | LLaMA 3.3 via Groq for AI fallback |

---

## 26. What Makes This Project Unique

1. **Built in Karbala, Iraq** -- One of the most complex semantic web applications ever built by a single developer in the Middle East, in a city better known for its shrines than its software engineering.

2. **True Linked Data** -- Not just JSON with fancy names. Real JSON-LD with proper `@context`, real RDF conversion via jsonld.js and N3.js, real SPARQL queries, real triple store integration. Records can be loaded into Fuseki and queried with standard SPARQL.

3. **19 federated sources** -- No other BIBFRAME editor searches across LOC, VIAF, Wikidata, WorldCat, Europeana, DPLA, BnF, GND, ISNI, Getty, and 9 more sources simultaneously.

4. **Multi-AI with circuit breaker** -- Not just "call OpenAI." A production-grade router that automatically falls back through 3 AI providers with health monitoring, circuit breaking, and full audit trails.

5. **Arabic-first bilingual** -- Most library systems treat Arabic as an afterthought. MOON was built with Arabic/RTL as a first-class citizen from day one, because it was built in Iraq.

6. **SHACL validation** -- Uses the W3C SHACL standard for RDF validation, not ad-hoc JavaScript checks.

7. **Enterprise architecture in a prototype** -- Multi-tenant isolation, row-level security, immutable audit logs, SHA-256 checksum verification, publish locking -- features you'd expect from OCLC or Ex Libris, implemented by one person.

8. **The name means something** -- MOON (the crescent over Karbala), SAND (the desert), DIJLA (the Tigris river), FALEH (the family name). Every sub-system carries a piece of Iraq with it.

---

## Closing

MOON SAND V2 is proof that world-class software can be built anywhere. From a city in southern Iraq, this project reaches out to the Library of Congress in Washington, the BnF in Paris, the GND in Frankfurt, and the VIAF consortium in Dublin -- pulling their linked data into a system that understands Arabic as naturally as it understands English.

The code is far from perfect. There is technical debt, there are known bugs, and there are features that are more ambitious than complete. But the architecture is sound, the data model is semantically correct, and the system works.

**Designed and developed by Isaac Faleh.**
**Built in Karbala.**

---

*"Moon Engine designed and developed by Isaac Faleh"*
*-- The toast message that appears every time a new record is created*

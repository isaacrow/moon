# 🌕 MOON Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    🌕 MOON SYSTEM ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
├─────────────────────────┬───────────────────────────────────────┤
│   🌕 MOON ENGINE        │        🌕 MOON OPAC                   │
│   (Cataloging Editor)   │    (Public Discovery)                 │
│                         │                                        │
│  ┌─────────────────┐   │   ┌──────────────────┐                │
│  │ Form View       │   │   │ Search Bar       │                │
│  │ JSON-LD View    │   │   │ Record List      │                │
│  │ Turtle View     │   │   │ Faceted Filters  │                │
│  │ Graph View      │   │   │ Export Buttons   │                │
│  │ Preview View    │   │   │ Permanent URIs   │                │
│  └─────────────────┘   │   └──────────────────┘                │
│                         │                                        │
│  ┌─────────────────┐   │   ┌──────────────────┐                │
│  │ Validation      │   │   │ Display Modes:   │                │
│  │ Save/Update     │   │   │ • Human          │                │
│  │ URI Generation  │   │   │ • JSON-LD        │                │
│  └─────────────────┘   │   │ • Turtle         │                │
│                         │   │ • Graph          │                │
│                         │   └──────────────────┘                │
└─────────────────────────┴───────────────────────────────────────┘
                                  │
                                  │ HTTP/REST
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API LAYER                               │
│                     (Supabase Edge Functions)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📡 REST API Endpoints:                                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  GET    /moon/records              List all records    │    │
│  │  GET    /moon/records/:id          Get single record   │    │
│  │  POST   /moon/records              Create record       │    │
│  │  PUT    /moon/records/:id          Update record       │    │
│  │  DELETE /moon/records/:id          Delete record       │    │
│  │  GET    /moon/search?q=query       Search records      │    │
│  │  GET    /moon/records/:id/jsonld   Export JSON-LD      │    │
│  │  GET    /moon/records/:id/turtle   Export Turtle       │    │
│  │  GET    /moon/records/:id/ntriples Export N-Triples    │    │
│  │  POST   /moon/validate             Validate JSON-LD    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  🔧 Business Logic:                                             │
│  • JSON-LD validation                                           │
│  • URI generation                                               │
│  • RDF conversion (Turtle, N-Triples)                          │
│  • Title extraction                                             │
│  • Version tracking                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ SQL
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PERSISTENCE LAYER                          │
│                    (PostgreSQL via Supabase)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  💾 Key-Value Store:  moon:record:{uuid}                       │
│                                                                  │
│  Record Structure:                                               │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  {                                                      │    │
│  │    "id": "abc-123-def-456",                           │    │
│  │    "uri": "https://moon.org/record/abc-123-def-456",  │    │
│  │    "title": "Example Book",                           │    │
│  │    "document": {                                       │    │
│  │      "@context": "https://id.loc.gov/ontologies/...", │    │
│  │      "@graph": [                                       │    │
│  │        {                                               │    │
│  │          "@id": "https://moon.org/work/...",         │    │
│  │          "@type": "bf:Work",                         │    │
│  │          "bf:title": [...],                          │    │
│  │          "bf:contribution": [...],                   │    │
│  │          "bf:subject": [...],                        │    │
│  │          "bf:hasInstance": [...]                     │    │
│  │        },                                              │    │
│  │        {                                               │    │
│  │          "@id": "https://moon.org/instance/...",     │    │
│  │          "@type": "bf:Instance",                     │    │
│  │          "bf:instanceOf": [...],                     │    │
│  │          "bf:identifiedBy": [...],                   │    │
│  │          "bf:provisionActivity": [...]               │    │
│  │        }                                               │    │
│  │      ]                                                 │    │
│  │    },                                                  │    │
│  │    "metadata": {                                       │    │
│  │      "created": "2024-01-01T00:00:00Z",              │    │
│  │      "modified": "2024-01-02T00:00:00Z",             │    │
│  │      "status": "published",                          │    │
│  │      "version": 2                                     │    │
│  │    },                                                  │    │
│  │    "workUri": "https://moon.org/work/...",          │    │
│  │    "instanceUri": "https://moon.org/instance/..."   │    │
│  │  }                                                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Creating a Record

```
┌──────────────┐
│ MOON ENGINE  │
│              │
│ Cataloger    │
│ enters data  │
└──────┬───────┘
       │
       │ 1. Fill form or edit JSON-LD
       ▼
┌──────────────┐
│ Validation   │
│              │
│ Check:       │
│ • @context   │
│ • @graph     │
│ • @id/@type  │
│ • bf:Work    │
│ • bf:Instance│
└──────┬───────┘
       │
       │ 2. If valid
       ▼
┌──────────────┐
│ API Layer    │
│              │
│ POST /moon/  │
│   records    │
│              │
│ Generate:    │
│ • UUID       │
│ • URI        │
│ • Timestamps │
└──────┬───────┘
       │
       │ 3. Save JSON-LD
       ▼
┌──────────────┐
│ PostgreSQL   │
│              │
│ Store with   │
│ key:         │
│ moon:record: │
│   {uuid}     │
└──────┬───────┘
       │
       │ 4. Immediately available
       ▼
┌──────────────┐
│ MOON OPAC    │
│              │
│ Record       │
│ appears in   │
│ search       │
└──────────────┘
```

### Searching Records

```
┌──────────────┐
│ MOON OPAC    │
│              │
│ User enters  │
│ search query │
└──────┬───────┘
       │
       │ 1. Type in search box
       ▼
┌──────────────┐
│ API Layer    │
│              │
│ GET /moon/   │
│   search?    │
│   q=query    │
└──────┬───────┘
       │
       │ 2. Query database
       ▼
┌──────────────┐
│ PostgreSQL   │
│              │
│ Full-text    │
│ search in    │
│ title and    │
│ document     │
└──────┬───────┘
       │
       │ 3. Return matches
       ▼
┌──────────────┐
│ MOON OPAC    │
│              │
│ Display      │
│ results      │
└──────────────┘
```

### Exporting RDF

```
┌──────────────┐
│ MOON OPAC    │
│              │
│ User clicks  │
│ "Download    │
│  Turtle"     │
└──────┬───────┘
       │
       │ 1. Request export
       ▼
┌──────────────┐
│ API Layer    │
│              │
│ GET /moon/   │
│   records/   │
│   {id}/      │
│   turtle     │
└──────┬───────┘
       │
       │ 2. Fetch JSON-LD
       ▼
┌──────────────┐
│ PostgreSQL   │
│              │
│ Return       │
│ document     │
└──────┬───────┘
       │
       │ 3. Convert to Turtle
       ▼
┌──────────────┐
│ RDF          │
│ Converter    │
│              │
│ JSON-LD →    │
│   Turtle     │
└──────┬───────┘
       │
       │ 4. Return as text/turtle
       ▼
┌──────────────┐
│ Browser      │
│              │
│ Download     │
│ .ttl file    │
└──────────────┘
```

---

## Component Hierarchy

```
App.tsx
├── Dashboard.tsx
│   ├── 🌕 MOON Engine Card → routes to MoonEngine
│   └── 🌕 MOON OPAC Card → routes to MoonOPAC
│
├── MoonEngine.tsx (moon-linked-data-engine)
│   ├── Header (with Validate & Save buttons)
│   ├── ViewTabs
│   │   ├── Form View
│   │   ├── JSON-LD View
│   │   ├── Turtle View
│   │   ├── Graph View
│   │   └── Preview View
│   └── Validation/Messages Display
│
└── MoonOPAC.tsx (moon-opac)
    ├── Header (with Search)
    ├── Records List (left panel)
    │   └── Record Cards
    └── Record Display (right panel)
        ├── DisplayTabs
        │   ├── Human View
        │   ├── JSON-LD View
        │   ├── Turtle View
        │   └── Graph View
        ├── Export Options
        └── Schema.org Example
```

---

## API Request/Response Flow

### Example: Creating a Record

**Request:**
```http
POST /moon/records
Authorization: Bearer {anonKey}
Content-Type: application/json

{
  "document": {
    "@context": "https://id.loc.gov/ontologies/bibframe.jsonld",
    "@graph": [...]
  },
  "metadata": {
    "status": "published"
  }
}
```

**Processing:**
1. Validate JSON-LD structure
2. Check for required fields
3. Generate UUID
4. Generate permanent URI
5. Extract title from bf:Work
6. Add timestamps
7. Save to PostgreSQL

**Response:**
```json
{
  "id": "generated-uuid",
  "uri": "https://moon.org/record/generated-uuid",
  "title": "Extracted Title",
  "document": {...},
  "metadata": {
    "created": "2024-01-01T00:00:00Z",
    "modified": "2024-01-01T00:00:00Z",
    "status": "published",
    "version": 1
  },
  "workUri": "https://moon.org/work/...",
  "instanceUri": "https://moon.org/instance/..."
}
```

---

## URI Strategy

```
Base URL: https://moon.org

Record URI Pattern:
  https://moon.org/record/{uuid}

Work URI Pattern:
  https://moon.org/work/{uuid}

Instance URI Pattern:
  https://moon.org/instance/{uuid}

Item URI Pattern (optional):
  https://moon.org/item/{uuid}

External Authority URIs:
  VIAF:     https://viaf.org/viaf/{id}
  LC Names: http://id.loc.gov/authorities/names/{id}
  LC Subjects: http://id.loc.gov/authorities/subjects/{id}
  Wikidata: https://www.wikidata.org/wiki/{id}
```

---

## Technology Stack

```
Frontend:
├── React 18
├── TypeScript
├── Tailwind CSS
├── Lucide Icons
└── Supabase Client

Backend:
├── Supabase Edge Functions
├── Hono (Express-compatible)
├── Deno Runtime
└── PostgreSQL

Standards:
├── BIBFRAME 2.0
├── JSON-LD 1.1
├── RDF 1.1
├── Turtle
└── N-Triples
```

---

## File Structure

```
/
├── supabase/
│   └── functions/
│       └── server/
│           ├── moonRecords.tsx     # MOON API logic
│           ├── index.tsx           # Server with endpoints
│           └── kv_store.tsx        # Database interface
│
├── src/
│   └── app/
│       ├── components/
│       │   ├── MoonEngine.tsx      # Cataloging editor
│       │   ├── MoonOPAC.tsx        # Public discovery
│       │   └── Dashboard.tsx       # Navigation hub
│       └── App.tsx                 # Main router
│
├── example-bibframe-record.json    # Sample record
├── MOON_SYSTEM.md                  # System docs
├── MOON_QUICK_START.md             # Quick start
├── MOON_API.md                     # API reference
├── MOON_SUMMARY.md                 # Summary
├── MOON_CHECKLIST.md               # Requirements check
├── MOON_ARCHITECTURE.md            # This file
└── README_MOON.md                  # Main README
```

---

## Security Model

```
┌─────────────────┐
│ Public User     │
└────────┬────────┘
         │
         │ Authorization: Bearer {anonKey}
         ▼
┌─────────────────┐
│ API Gateway     │
│ (Supabase)      │
└────────┬────────┘
         │
         │ Validate token
         ▼
┌─────────────────┐
│ Edge Function   │
│ (Hono Server)   │
└────────┬────────┘
         │
         │ Service role key (server-side only)
         ▼
┌─────────────────┐
│ PostgreSQL      │
└─────────────────┘

Notes:
• Frontend uses public anon key
• Backend uses service role key
• Service key never exposed to client
• All requests authenticated
```

---

## Deployment Architecture

```
┌───────────────────────────────────────────┐
│           Supabase Platform                │
│                                            │
│  ┌──────────────┐    ┌─────────────────┐ │
│  │   Frontend   │    │  Edge Functions  │ │
│  │   (React)    │◄───►    (Hono)       │ │
│  │  Static Host │    │   MOON API      │ │
│  └──────────────┘    └────────┬────────┘ │
│                                │          │
│                                ▼          │
│                      ┌─────────────────┐ │
│                      │   PostgreSQL    │ │
│                      │   (Database)    │ │
│                      └─────────────────┘ │
└───────────────────────────────────────────┘
                       │
                       │ HTTPS
                       ▼
               ┌───────────────┐
               │ End Users     │
               │ (Catalogers & │
               │  Public)      │
               └───────────────┘
```

---

**🌕 MOON Architecture - Clear, Complete, Production-Ready**

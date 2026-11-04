# 🏗️ MOON SAND V2 - Production Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           MOON SAND V2                              │
│              Enterprise Linked Data Cataloging Platform             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ MoonSandV2   │  │ Records      │  │ Record       │              │
│  │ (Editor)     │  │ Dashboard    │  │ Viewer       │              │
│  │              │  │              │  │ Dialog       │              │
│  │ - Edit forms │  │ - Browse     │  │ - OPAC       │              │
│  │ - Validation │  │ - Search     │  │ - Mind Map   │              │
│  │ - Auto-save  │  │ - Filters    │  │ - MARC       │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│         └─────────────────┴─────────────────┘                        │
│                           │                                          │
│                           ↓                                          │
│                 ┌─────────────────┐                                 │
│                 │   API Client    │                                 │
│                 │   (Fetch API)   │                                 │
│                 └─────────────────┘                                 │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           │ HTTPS
                           │
┌──────────────────────────┴───────────────────────────────────────────┐
│                      BACKEND API LAYER                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Supabase Edge Functions (Hono)                │    │
│  │                /make-server-49c0e13c/*                     │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   Record Routes                            │    │
│  │                                                            │    │
│  │  POST   /api/records                  Create record       │    │
│  │  GET    /api/records/:id              Get record          │    │
│  │  GET    /api/records/:id/public       Get published 🆕    │    │
│  │  PUT    /api/records/:id              Update record       │    │
│  │  DELETE /api/records/:id              Delete record       │    │
│  │  GET    /api/records                  List records        │    │
│  │                                                            │    │
│  │  POST   /api/records/:id/version      Create version      │    │
│  │  GET    /api/records/:id/versions     List versions       │    │
│  │                                                            │    │
│  │  POST   /api/records/:id/publish      Publish (lock) 🔒   │    │
│  │  POST   /api/records/:id/archive      Archive (unlock)    │    │
│  │                                                            │    │
│  │  GET    /api/records/:id/export       Export JSON-LD      │    │
│  │  GET    /api/records/:id/marc         Export MARC 🆕      │    │
│  │  GET    /api/records/:id/mindmap      Mind map 🆕         │    │
│  │                                                            │    │
│  │  GET    /api/records/:id/audit        Audit history 🆕    │    │
│  │  GET    /api/records/:id/validation-  Validation 🆕       │    │
│  │         history                                           │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ↓                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                   Record Service                           │    │
│  │                                                            │    │
│  │  - createRecord()         🔐 Canonical + Checksum         │    │
│  │  - updateRecord()         🔒 Lock check                   │    │
│  │  - publishRecord()        🔒 Lock + Audit                 │    │
│  │  - getPublicRecord()      ✅ Published only               │    │
│  │  - exportWithMetadata()   📋 Export stamps                │    │
│  │  - createVersion()        ✅ Snapshot + Validation        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                           │                                         │
│                           ↓                                         │
│  ┌─────────────┬───────────────┬──────────────┬──────────────┐    │
│  │             │               │              │              │    │
│  ↓             ↓               ↓              ↓              ↓    │
│  ┌──────────┐  ┌───────────┐   ┌──────────┐   ┌──────────┐  │    │
│  │Canonical │  │   MARC    │   │ Mind Map │   │  Audit   │  │    │
│  │JSON-LD   │  │ Converter │   │Generator │   │  Logger  │  │    │
│  │          │  │           │   │          │   │          │  │    │
│  │- Stable  │  │- Registry │   │- From    │   │- All     │  │    │
│  │  URIs    │  │- Explicit │   │  triples │   │  actions │  │    │
│  │- @context│  │  mapping  │   │- True    │   │- User    │  │    │
│  │- Ordered │  │- 245,     │   │  graph   │   │  track   │  │    │
│  │- SHA-256 │  │  100, etc │   │- Colors  │   │- IP log  │  │    │
│  └──────────┘  └───────────┘   └──────────┘   └──────────┘  │    │
│                                                                      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    KV Store (Key-Value)                    │    │
│  │                                                            │    │
│  │  record:bibframe:record:*        Record metadata          │    │
│  │  version:bibframe:record:*:v*    Version snapshots        │    │
│  │  audit:bibframe:record:*:*       Audit log entries        │    │
│  │  record:index:*                  Indexes (title, type)    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Create Record

```
┌────────────┐
│  Frontend  │
│  (Editor)  │
└─────┬──────┘
      │
      │ 1. Submit graphJson (raw)
      ↓
┌────────────────────────────────────────────┐
│  POST /api/records                         │
│  - graphJson (raw, from UI)                │
│  - title                                   │
│  - resourceType                            │
│  - userId                                  │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  recordService.createRecord()              │
└─────┬──────────────────────────────────────┘
      │
      │ 2. toCanonicalJsonLd(graphJson)
      ↓
┌────────────────────────────────────────────┐
│  canonicalJsonLd.tsx                       │
│  - Sort nodes by type, then URI            │
│  - Sort properties by BIBFRAME order       │
│  - Add official @context                   │
│  - Remove duplicates                       │
└─────┬──────────────────────────────────────┘
      │
      │ 3. Canonical graph
      ↓
┌────────────────────────────────────────────┐
│  generateChecksum(canonical)               │
│  - SHA-256 hash of normalized JSON         │
│  - Returns 64-char hex string              │
└─────┬──────────────────────────────────────┘
      │
      │ 4. Checksum
      ↓
┌────────────────────────────────────────────┐
│  Store record                              │
│  {                                         │
│    id, title, resourceType,                │
│    graphJson: canonical,                   │
│    checksum,                               │
│    locked: false,                          │
│    status: 'draft',                        │
│    versionNumber: 1,                       │
│    createdAt, createdBy                    │
│  }                                         │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  createVersion()                           │
│  - Snapshot canonical graph                │
│  - Store checksum                          │
│  - Run validation                          │
│  - Store validation result                 │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  auditLog.logRecordCreated()               │
│  - Timestamp                               │
│  - User ID                                 │
│  - IP address                              │
│  - Checksum                                │
└─────┬──────────────────────────────────────┘
      │
      │ 5. Return record
      ↓
┌────────────┐
│  Frontend  │
│  (Success) │
└────────────┘
```

---

## Data Flow: Update Published Record (BLOCKED)

```
┌────────────┐
│  Frontend  │
│  (Editor)  │
└─────┬──────┘
      │
      │ 1. Submit updated graphJson
      ↓
┌────────────────────────────────────────────┐
│  PUT /api/records/:id                      │
│  - graphJson (updated)                     │
│  - userId                                  │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  recordService.updateRecord()              │
└─────┬──────────────────────────────────────┘
      │
      │ 2. Get existing record
      ↓
┌────────────────────────────────────────────┐
│  const existing = await getRecord(id)      │
└─────┬──────────────────────────────────────┘
      │
      │ 3. Check lock status
      ↓
┌────────────────────────────────────────────┐
│  if (existing.locked) {                    │
│    throw new Error(                        │
│      'Record is locked (published)'        │
│    );                                      │
│  }                                         │
└─────┬──────────────────────────────────────┘
      │
      │ 4. ERROR THROWN 🔒
      ↓
┌────────────────────────────────────────────┐
│  HTTP 500: Record is locked                │
│  "Cannot modify published records"         │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────┐
│  Frontend  │
│  (Error)   │
│  🚫 Edit   │
│  blocked   │
└────────────┘
```

---

## Data Flow: Publish Record

```
┌────────────┐
│  Frontend  │
└─────┬──────┘
      │
      │ 1. Click "Publish"
      ↓
┌────────────────────────────────────────────┐
│  POST /api/records/:id/publish             │
│  - userId                                  │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  recordService.publishRecord()             │
└─────┬──────────────────────────────────────┘
      │
      │ 2. Validate record
      ↓
┌────────────────────────────────────────────┐
│  validateForPublishing(graphJson)          │
│  - Check Work exists                       │
│  - Check Instance exists                   │
│  - Check required properties               │
└─────┬──────────────────────────────────────┘
      │
      │ 3. If valid, create version snapshot
      ↓
┌────────────────────────────────────────────┐
│  createVersion()                           │
│  - Canonical snapshot                      │
│  - Checksum                                │
│  - Validation result                       │
│  - Comment: "Published version X"          │
└─────┬──────────────────────────────────────┘
      │
      │ 4. Update record status
      ↓
┌────────────────────────────────────────────┐
│  Update record:                            │
│  {                                         │
│    status: 'published',                    │
│    locked: true,          🔒 LOCK          │
│    publishedAt: now,                       │
│    publishedBy: userId,                    │
│    versionNumber: +1                       │
│  }                                         │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  auditLog.logRecordPublished()             │
│  auditLog.logLockAcquired()                │
└─────┬──────────────────────────────────────┘
      │
      │ 5. Return published record
      ↓
┌────────────┐
│  Frontend  │
│  (Success) │
│  🔒 Locked │
└────────────┘
```

---

## Data Flow: OPAC View (Public Access)

```
┌────────────┐
│  OPAC View │
│  (Public)  │
└─────┬──────┘
      │
      │ 1. Request record for display
      ↓
┌────────────────────────────────────────────┐
│  GET /api/records/:id/public               │
│  (NOT /api/records/:id)                    │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  recordService.getPublicRecord()           │
└─────┬──────────────────────────────────────┘
      │
      │ 2. Get record
      ↓
┌────────────────────────────────────────────┐
│  const record = await getRecord(id)        │
└─────┬──────────────────────────────────────┘
      │
      │ 3. Check publication status
      ↓
┌────────────────────────────────────────────┐
│  if (record.status !== 'published') {      │
│    return null; // 404                     │
│  }                                         │
└─────┬──────────────────────────────────────┘
      │
      │ 4. Add export metadata
      ↓
┌────────────────────────────────────────────┐
│  addExportMetadata()                       │
│  - generationDate                          │
│  - generationProcess                       │
│  - generationTool                          │
└─────┬──────────────────────────────────────┘
      │
      │ 5. Return sanitized canonical graph
      ↓
┌────────────────────────────────────────────┐
│  {                                         │
│    "@context": {...},                      │
│    "@graph": [...],                        │
│    "metadata": {                           │
│      recordId, title,                      │
│      publishedAt, publishedBy,             │
│      versionNumber, checksum               │
│    }                                       │
│  }                                         │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────┐
│  OPAC View │
│  (Render)  │
│  ✅ Only   │
│  published │
└────────────┘
```

---

## Data Flow: Export with Metadata

```
┌────────────┐
│  Frontend  │
└─────┬──────┘
      │
      │ 1. Click "Download JSON-LD"
      ↓
┌────────────────────────────────────────────┐
│  GET /api/records/:id/export?format=jsonld │
│  Header: X-User-Id: user123                │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  recordService.exportWithMetadata()        │
└─────┬──────────────────────────────────────┘
      │
      │ 2. Get record
      ↓
┌────────────────────────────────────────────┐
│  const record = await getRecord(id)        │
└─────┬──────────────────────────────────────┘
      │
      │ 3. Add export metadata to graph
      ↓
┌────────────────────────────────────────────┐
│  addExportMetadata(canonical, userId, id)  │
│  - bf:generationDate                       │
│  - bf:generationProcess (with user)        │
│  - bf:generationTool                       │
└─────┬──────────────────────────────────────┘
      │
      │ 4. Create export package
      ↓
┌────────────────────────────────────────────┐
│  {                                         │
│    data: enrichedCanonical,                │
│    metadata: {                             │
│      recordId,                             │
│      title,                                │
│      status,                               │
│      versionNumber,                        │
│      checksum,                             │
│      exportedAt: now,                      │
│      exportedBy: userId,                   │
│      exportFormat: 'jsonld'                │
│    }                                       │
│  }                                         │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  auditLog.logExport(id, 'jsonld', userId)  │
└─────┬──────────────────────────────────────┘
      │
      │ 5. Return with HTTP headers
      ↓
┌────────────────────────────────────────────┐
│  Response Headers:                         │
│  X-Export-Timestamp: 2024-03-15T10:30:00Z  │
│  X-Record-Checksum: abc123...              │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────┐
│  Frontend  │
│  (Download)│
│  📥 File   │
└────────────┘
```

---

## Data Flow: MARC Export

```
┌────────────┐
│  Frontend  │
└─────┬──────┘
      │
      │ 1. Click "Export MARC"
      ↓
┌────────────────────────────────────────────┐
│  GET /api/records/:id/marc                 │
│  Header: X-User-Id: user123                │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  Get record                                │
└─────┬──────────────────────────────────────┘
      │
      │ 2. Convert using registry
      ↓
┌────────────────────────────────────────────┐
│  marcConverter.convertToMARC(graphJson)    │
└─────┬──────────────────────────────────────┘
      │
      │ 3. Process mappings
      ↓
┌────────────────────────────────────────────┐
│  MARC_MAPPING_REGISTRY.forEach(mapping)    │
│                                            │
│  bf:title → 245 $a$b                       │
│  bf:contribution → 100/700 $a$e            │
│  bf:subject → 650 $a                       │
│  bf:identifiedBy(ISBN) → 020 $a            │
│  bf:classification(LCC) → 050 $a           │
│  bf:provisionActivity → 264 $a$b$c         │
│  bf:extent → 300 $a$c                      │
│  ...                                       │
└─────┬──────────────────────────────────────┘
      │
      │ 4. Format as MARC text
      ↓
┌────────────────────────────────────────────┐
│  LEADER 00000nam  2200000Ia 4500           │
│  001    bibframe:record:123                │
│  003    MOON                               │
│  ...                                       │
│  245 00 $aExample Title :$bSubtitle        │
│  650  0 $aLibrary science                  │
│  ...                                       │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  auditLog.logExport(id, 'marc', userId)    │
└─────┬──────────────────────────────────────┘
      │
      │ 5. Return with headers
      ↓
┌────────────────────────────────────────────┐
│  Response:                                 │
│  Content-Type: text/plain                  │
│  Content-Disposition: attachment;          │
│    filename="record.mrc"                   │
│  X-Export-Timestamp: now                   │
│  X-Record-Checksum: abc123...              │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────┐
│  Frontend  │
│  (Download)│
│  📥 .mrc   │
└────────────┘
```

---

## Data Flow: Mind Map Generation

```
┌────────────┐
│  Frontend  │
└─────┬──────┘
      │
      │ 1. Request mind map
      ↓
┌────────────────────────────────────────────┐
│  GET /api/records/:id/mindmap?format=json  │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  Get record                                │
└─────┬──────────────────────────────────────┘
      │
      │ 2. Generate from graph
      ↓
┌────────────────────────────────────────────┐
│  generateMindMapFromGraph(graphJson)       │
└─────┬──────────────────────────────────────┘
      │
      │ 3. Extract nodes from @graph
      ↓
┌────────────────────────────────────────────┐
│  graph.forEach(entity => {                 │
│    Node = {                                │
│      id: entity['@id'],                    │
│      label: getNodeLabel(entity),          │
│      type: entity['@type'],                │
│      color: TYPE_COLORS[type],             │
│      size: getNodeSize(type)               │
│    }                                       │
│  })                                        │
└─────┬──────────────────────────────────────┘
      │
      │ 4. Extract edges from properties
      ↓
┌────────────────────────────────────────────┐
│  Object.entries(entity).forEach(           │
│    ([predicate, value]) => {               │
│      if (value['@id']) {                   │
│        Edge = {                            │
│          source: entity['@id'],            │
│          target: value['@id'],             │
│          label: formatPredicate(predicate),│
│          type: predicate                   │
│        }                                   │
│      }                                     │
│    }                                       │
│  )                                         │
└─────┬──────────────────────────────────────┘
      │
      │ 5. Apply layout algorithm
      ↓
┌────────────────────────────────────────────┐
│  applyForceLayout(nodes, edges)            │
│  - Works in center                         │
│  - Instances to right                      │
│  - Other nodes in orbit                    │
└─────┬──────────────────────────────────────┘
      │
      │ 6. Return mind map data
      ↓
┌────────────────────────────────────────────┐
│  {                                         │
│    nodes: [...],                           │
│    edges: [...],                           │
│    metadata: {                             │
│      nodeCount,                            │
│      edgeCount,                            │
│      types: [...]                          │
│    }                                       │
│  }                                         │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────┐
│  Frontend  │
│  (Render)  │
│  🧠 True   │
│  graph viz │
└────────────┘
```

---

## Record Lifecycle States

```
┌─────────────────────────────────────────────────────────────┐
│                    RECORD LIFECYCLE                         │
└─────────────────────────────────────────────────────────────┘

┌────────────┐
│   DRAFT    │
│            │
│ locked: ❌ │
│ status:    │
│  'draft'   │
└─────┬──────┘
      │
      │ User edits
      │ (allowed)
      ↓
┌────────────┐
│   DRAFT    │
│ (modified) │
│            │
│ locked: ❌ │
└─────┬──────┘
      │
      │ Validate
      │ & Publish
      ↓
┌────────────┐
│ PUBLISHED  │
│            │
│ locked: ✅ │  🔒 IMMUTABLE
│ status:    │
│ 'published'│
└─────┬──────┘
      │
      │ Try to edit
      │ ❌ BLOCKED
      ↓
┌────────────┐
│   ERROR    │
│ "Record is │
│  locked"   │
└────────────┘

      OR

┌────────────┐
│ PUBLISHED  │
│            │
│ locked: ✅ │
└─────┬──────┘
      │
      │ Archive
      ↓
┌────────────┐
│  ARCHIVED  │
│            │
│ locked: ❌ │  🔓 UNLOCKED
│ status:    │
│ 'archived' │
└────────────┘
```

---

## Checksum Verification Flow

```
┌────────────────────────────────────────────┐
│  Version Created                           │
│  - graphSnapshot (canonical)               │
│  - checksum (SHA-256)                      │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  Store in KV                               │
│  version:bibframe:record:123:v1            │
└─────┬──────────────────────────────────────┘
      │
      │ ... time passes ...
      │
      ↓
┌────────────────────────────────────────────┐
│  Retrieve Version                          │
│  const version = await getVersion(id, 1)   │
└─────┬──────────────────────────────────────┘
      │
      │ Verify integrity
      ↓
┌────────────────────────────────────────────┐
│  const currentChecksum =                   │
│    generateChecksum(version.graphSnapshot) │
└─────┬──────────────────────────────────────┘
      │
      ↓
┌────────────────────────────────────────────┐
│  if (currentChecksum !== version.checksum) │
│    throw Error('Integrity check failed!')  │
│  else                                      │
│    return version ✅                       │
└────────────────────────────────────────────┘
```

---

## Audit Log Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    AUDIT LOG ENTRY                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  {                                                          │
│    id: "audit:bibframe:record:123:1234567890:uuid",        │
│    timestamp: "2024-03-15T10:30:00Z",                      │
│    action: "record.published",                             │
│    recordId: "bibframe:record:123",                        │
│    userId: "user123",                                      │
│    metadata: {                                             │
│      versionNumber: 3,                                     │
│      status: "published",                                  │
│      checksum: "abc123def456..."                           │
│    },                                                      │
│    ipAddress: "192.168.1.1",                               │
│    userAgent: "Mozilla/5.0..."                             │
│  }                                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Timeline for Record 123:

2024-03-15T10:30:00Z  record.published      user123
2024-03-15T10:29:45Z  validation.passed     user123
2024-03-15T10:25:00Z  record.updated        user123
2024-03-14T14:20:00Z  record.updated        user123
2024-03-14T09:15:00Z  version.created       user123
2024-03-13T16:30:00Z  validation.failed     user123
2024-03-13T11:00:00Z  record.created        user123
```

---

*MOON SAND V2 - Complete Production Architecture*  
*Enterprise-Ready Linked Data Cataloging Platform* 🚀

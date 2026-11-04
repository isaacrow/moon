# 🏗️ Save/Load Architecture - How It Works Now

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTION                              │
│                     (Create Record in UI)                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ work: { '@type': 'bf:Work', ... }
                            │ instance: { '@type': 'bf:Instance', ... }
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SAVE OPERATION                              │
│                   (recordStorageBackend.ts)                      │
│                                                                  │
│  1. Extract title from work/instance                            │
│  2. Build safe nodes with buildSafeNode()                       │
│     ┌───────────────────────────────────────┐                   │
│     │ buildSafeNode(record.work,            │                   │
│     │   'bf:Work',                          │                   │
│     │   'http://moon.local/work/...')       │                   │
│     │                                       │                   │
│     │ Returns: {                            │                   │
│     │   ...record.work,  ← SPREAD FIRST    │                   │
│     │   '@id': ... || defaultId,            │                   │
│     │   '@type': ... || 'bf:Work' ← LAST   │                   │
│     │ }                                     │                   │
│     └───────────────────────────────────────┘                   │
│                                                                  │
│  3. Create JSON-LD document                                     │
│     {                                                            │
│       '@context': 'http://id.loc.gov/ontologies/bibframe/',     │
│       '@graph': [safeWork, safeInstance]                        │
│     }                                                            │
│                                                                  │
│  4. Log: "💾 Saving with @types: ..."                          │
│  5. POST to /records/save                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│                                                                  │
│  Stores:                                                         │
│  {                                                               │
│    id: "record-123...",                                          │
│    document: {                                                   │
│      '@context': '...',                                          │
│      '@graph': [                                                 │
│        { '@type': 'bf:Work', '@id': '...', ... },               │
│        { '@type': 'bf:Instance', '@id': '...', ... }            │
│      ]                                                           │
│    },                                                            │
│    metadata: { ... }                                             │
│  }                                                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Also cached to localStorage
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LOAD OPERATION                               │
│                   (When user clicks "Load")                      │
│                                                                  │
│  1. GET /records (fetch all records)                            │
│  2. For each record from server:                                │
│     ┌───────────────────────────────────────┐                   │
│     │ Normalize @graph:                     │                   │
│     │   graph = record.document?.['@graph'] │                   │
│     │        || record['@graph']            │                   │
│     │                                       │                   │
│     │ Extract nodes:                        │                   │
│     │   extractNodesFromGraph(graph)        │                   │
│     │     → Returns { work, instance }      │                   │
│     │     → Throws error if invalid         │                   │
│     │                                       │                   │
│     │ Convert to work/instance format:      │                   │
│     │   {                                   │                   │
│     │     '@context': { ... },              │                   │
│     │     work: workNode,                   │                   │
│     │     instance: instanceNode,           │                   │
│     │     metadata: { ... }                 │                   │
│     │   }                                   │                   │
│     └───────────────────────────────────────┘                   │
│                                                                  │
│  3. Return normalized SavedRecord[]                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DISPLAY IN UI (App.tsx)                         │
│                                                                  │
│  handleLoadRecordFromGallery(savedRecord):                      │
│                                                                  │
│  1. Check if normalized (has .work and .instance)               │
│     ✅ YES → Use directly                                       │
│     ❌ NO → Extract from @graph                                 │
│                                                                  │
│  2. Set state:                                                   │
│     setWork(record.work)                                         │
│     setInstance(record.instance)                                 │
│     setCurrentRecord(record)                                     │
│                                                                  │
│  3. Navigate to catalog view                                     │
│  4. Show success toast with actual title                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 The Three Critical Functions

### 1️⃣ buildSafeNode()

**Purpose**: Guarantee @type and @id can never be undefined

```typescript
function buildSafeNode(node: any, defaultType: string, defaultId: string) {
  return {
    ...node,                                    // ← Spread FIRST
    '@id': node?.['@id'] || defaultId,         // ← Defaults LAST
    '@type': node?.['@type'] || defaultType    // ← Ensures value exists
  };
}
```

**Why it works:**
- Even if `node['@type']` is `undefined`, the `|| defaultType` provides a value
- The default is set AFTER the spread, so it takes precedence

**Old broken code:**
```typescript
{
  '@type': record.work['@type'] || 'bf:Work',  // ← Set default FIRST
  ...record.work,                               // ← Spread SECOND
  // If record.work has '@type': undefined, it overwrites the default!
}
```

---

### 2️⃣ extractNodesFromGraph()

**Purpose**: Extract Work and Instance from @graph array

```typescript
function extractNodesFromGraph(graph: any[]) {
  const work = graph.find(n => {
    const type = n['@type'];
    return Array.isArray(type) 
      ? type.some((t: string) => t?.includes?.('Work'))
      : type?.includes?.('Work');
  });

  const instance = graph.find(n => {
    const type = n['@type'];
    return Array.isArray(type)
      ? type.some((t: string) => t?.includes?.('Instance'))
      : type?.includes?.('Instance');
  });

  if (!work || !instance) {
    throw new Error("Invalid BIBFRAME graph: missing Work or Instance");
  }

  return { work, instance };
}
```

**Why it works:**
- Handles both string and array @type values
- Uses `.includes()` to match 'bf:Work', 'Work', etc.
- Throws error instead of returning undefined
- No silent fallback to templates

---

### 3️⃣ Normalization in getAllRecords()

**Purpose**: Convert server format (@graph) to client format (work/instance)

```typescript
// Server returns:
{
  document: {
    '@graph': [
      { '@type': 'bf:Work', ... },
      { '@type': 'bf:Instance', ... }
    ]
  }
}

// We normalize to:
{
  record: {
    '@context': { ... },
    work: { '@type': 'bf:Work', ... },
    instance: { '@type': 'bf:Instance', ... },
    metadata: { ... }
  }
}
```

**Why it works:**
- Frontend uses work/instance format for easy form binding
- Normalize once when fetching, use everywhere
- No format ambiguity

---

## 🔄 Save/Load Cycle

```
┌────────────────────────────────────────────────────────────┐
│                       SAVE CYCLE                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Client Format                                             │
│  (work/instance)                                           │
│       ↓                                                    │
│  buildSafeNode()                                           │
│  (guarantee @type)                                         │
│       ↓                                                    │
│  Server Format                                             │
│  (@graph array)                                            │
│       ↓                                                    │
│  Supabase Database                                         │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                       LOAD CYCLE                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Supabase Database                                         │
│       ↓                                                    │
│  Server Format                                             │
│  (@graph array)                                            │
│       ↓                                                    │
│  extractNodesFromGraph()                                   │
│  (extract work/instance)                                   │
│       ↓                                                    │
│  Client Format                                             │
│  (work/instance)                                           │
│       ↓                                                    │
│  React State                                               │
│  (form fields)                                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Error Handling Strategy

### Old Approach (BROKEN):
```
Error → Return empty template → User sees empty form → Confused 😵
```

### New Approach (FIXED):
```
Error → Throw exception → Show error toast → User knows what happened 😎
```

---

## 📁 File Responsibilities

### `/src/app/utils/recordStorageBackend.ts`
**Role**: Storage layer - talks to Supabase and localStorage

**Responsibilities**:
- ✅ Save records with guaranteed @type
- ✅ Load records and normalize format
- ✅ Handle errors (no silent failures)
- ✅ Cache to localStorage for offline access

**Key Functions**:
- `buildSafeNode()` - Guarantees @type exists
- `extractNodesFromGraph()` - Extracts from @graph
- `saveRecord()` - Saves to database
- `getAllRecords()` - Loads and normalizes all records
- `getRecordById()` - Loads single record
- `updateRecord()` - Updates existing record

---

### `/src/app/App.tsx`
**Role**: UI layer - displays forms and handles user interaction

**Responsibilities**:
- ✅ Display work/instance forms
- ✅ Load records into React state
- ✅ Handle save button clicks
- ✅ Show toast messages
- ✅ Navigate between views

**Key Functions**:
- `handleSave()` - Calls saveRecord from backend
- `handleLoadRecordFromGallery()` - Loads record into state
- `handleFileImport()` - Imports from JSON file

---

## 🎯 Key Principles

1. **Normalize Once, Use Everywhere**
   - Convert @graph → work/instance when loading
   - Frontend always works with work/instance format

2. **Fail Fast, Fail Loud**
   - Throw errors instead of returning undefined
   - Show toast messages to user
   - Log to console for debugging

3. **Guarantee Data Integrity**
   - buildSafeNode ensures @type exists
   - extractNodesFromGraph validates structure
   - No silent corruption

4. **Single Source of Truth**
   - Supabase is primary storage
   - localStorage is cache/fallback
   - One format in React state

---

## 🚀 Performance Considerations

### Caching Strategy
- Load from Supabase on app start
- Cache to localStorage immediately
- Future loads can use cache (instant)
- Background sync to Supabase

### Normalization Cost
- Normalization happens once per load
- Converted records are cached
- Forms work with normalized format (fast)

---

## 📊 Format Cheat Sheet

### Server Format (Database)
```json
{
  "id": "record-123",
  "document": {
    "@context": "http://id.loc.gov/ontologies/bibframe/",
    "@graph": [
      { "@type": "bf:Work", "@id": "...", "bf:title": {...} },
      { "@type": "bf:Instance", "@id": "...", "bf:instanceOf": {...} }
    ]
  }
}
```

### Client Format (React State)
```json
{
  "@context": {...},
  "work": { "@type": "bf:Work", "@id": "...", "bf:title": {...} },
  "instance": { "@type": "bf:Instance", "@id": "...", "bf:instanceOf": {...} },
  "metadata": { "catalogingLanguage": "en", ... }
}
```

### SavedRecord Format (Storage Layer)
```typescript
{
  id: "record-123",
  record: BIBFRAMERecord,  // Client format
  title: "Extracted Title",
  createdAt: "2026-02-18T...",
  modifiedAt: "2026-02-18T...",
  cataloger: "username",
  resourceType: "Monograph"
}
```

---

## ✅ Success Criteria

After implementing this architecture:

- [x] Records save with valid @type (never undefined)
- [x] Records load with actual data (never template)
- [x] Errors show clear messages (never silent)
- [x] Format is consistent (one structure everywhere)
- [x] Code is maintainable (clear responsibilities)
- [x] Performance is good (caching works)

**Status**: ✅ COMPLETE AND VERIFIED

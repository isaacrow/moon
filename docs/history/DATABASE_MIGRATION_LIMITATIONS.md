# 🗄️ Database Migration Limitations in Figma Make Environment

## ⚠️ Important Constraint

**MOON is currently running in the Figma Make environment**, which has specific limitations regarding database schema modifications.

---

## What Cannot Be Done

### ❌ Creating New PostgreSQL Tables
The Figma Make system does not support creating custom PostgreSQL tables through DDL statements or migrations:

```sql
-- ❌ THIS CANNOT BE EXECUTED
CREATE TABLE moon_records (
  id UUID PRIMARY KEY,
  institution_id UUID NOT NULL,
  document JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Reason:** The Make environment's database schema is managed centrally and custom table creation would break compatibility with the rest of the system.

### ❌ Database Migrations
Migration files cannot be executed:
```typescript
// ❌ THIS CANNOT BE RUN
-- migrations/001_create_moon_schema.sql
-- migrations/002_add_indexes.sql
```

### ❌ SQL Indexes
Direct index creation is not supported:
```sql
-- ❌ THIS CANNOT BE EXECUTED
CREATE INDEX idx_moon_records_institution 
ON moon_records (institution_id);

CREATE INDEX idx_moon_records_search 
USING GIN (document jsonb_path_ops);
```

### ❌ Foreign Key Constraints at DB Level
```sql
-- ❌ THIS CANNOT BE EXECUTED
ALTER TABLE moon_records 
ADD CONSTRAINT fk_institution 
FOREIGN KEY (institution_id) 
REFERENCES moon_institutions(id);
```

---

## What We Can Do (Current Implementation)

### ✅ KV Store with Structured Patterns

Instead of SQL tables, we use **namespaced key-value patterns** that provide similar organization:

```typescript
// Equivalent to table partitioning
moon:{institutionId}:record:{recordId}
moon:{institutionId}:authority:{authorityId}
moon:{institutionId}:version:{versionId}
moon:{institutionId}:audit:{timestamp}:{eventId}
```

### ✅ Application-Level Enforcement

We enforce data integrity in the application layer:

**Instead of:**
```sql
-- DB-level foreign key
FOREIGN KEY (institution_id) REFERENCES institutions(id)
```

**We do:**
```typescript
// Application-level verification
const institution = await dataIsolation.getInstitution(institutionId);
if (!institution) {
  throw new Error('Invalid institution');
}
```

### ✅ JSONB Storage in KV

The KV store accepts JSON documents, giving us flexibility:

```typescript
await kv.set(`moon:${institutionId}:record:${id}`, JSON.stringify({
  id,
  institutionId,
  document: { /* full JSON-LD */ },
  metadata: { created, modified, version }
}));
```

### ✅ Prefix-Based Queries (Instead of Indexes)

```typescript
// Get all records for an institution
const records = await kv.getByPrefix(`moon:${institutionId}:record:`);

// Get all authorities of a type
const agents = await kv.getByPrefix(`moon:${institutionId}:authority:agent:`);
```

### ✅ Application-Level Search

Instead of SQL full-text search, we filter in application code:

```typescript
const allRecords = await kv.getByPrefix(`moon:${institutionId}:record:`);
const results = allRecords.filter(record => {
  const searchable = JSON.stringify(record).toLowerCase();
  return searchable.includes(query.toLowerCase());
});
```

---

## Performance Implications

### What We Gain:
- ✅ **Zero schema management** - No migrations needed
- ✅ **Flexible schema evolution** - JSON documents can change freely
- ✅ **Simple deployment** - No DB setup required
- ✅ **Platform compatibility** - Works within Make constraints

### What We Lose:
- ❌ **Scalability beyond ~10,000 records** - Client-side filtering doesn't scale
- ❌ **Complex queries** - No JOIN, GROUP BY, or aggregate functions
- ❌ **Full-text search performance** - Linear scan instead of indexed search
- ❌ **Database-level constraints** - Integrity only enforced in code
- ❌ **Atomic transactions** - Can't guarantee multi-key consistency

---

## Realistic Scale Limits

### With Current KV Implementation:

| Records | Performance | Status |
|---------|-------------|--------|
| 1-100 | Excellent | ✅ Production ready |
| 100-1,000 | Good | ✅ Production ready |
| 1,000-10,000 | Acceptable | ⚠️ May need optimization |
| 10,000-100,000 | Slow | ❌ Not recommended |
| 100,000+ | Unusable | ❌ Requires SQL migration |

### Bottlenecks:
1. **List operations** - Loading all records for filtering
2. **Search** - Full JSON string scan
3. **Authority merge** - Must iterate all records to find references
4. **Faceted discovery** - Client-side aggregation

---

## Mitigation Strategies (Within Constraints)

### 1. Optimize KV Queries

**Use more specific prefixes:**
```typescript
// ❌ Broad query
const all = await kv.getByPrefix('moon:inst-123:');

// ✅ Specific query
const works = await kv.getByPrefix('moon:inst-123:record:work:');
```

### 2. Add Metadata Indexes (KV-Based)

**Create secondary indexes using additional keys:**
```typescript
// Primary: Full record
await kv.set(`moon:${instId}:record:${id}`, record);

// Index: By type
await kv.set(`moon:${instId}:index:type:${type}:${id}`, id);

// Index: By status
await kv.set(`moon:${instId}:index:status:${status}:${id}`, id);

// Query via index
const workIds = await kv.getByPrefix(`moon:${instId}:index:type:Work:`);
```

### 3. Implement Pagination Early

**Don't load all results:**
```typescript
// ❌ Loads everything
const all = await dataIsolation.listRecords(institutionId);

// ✅ Paginated
const page = await dataIsolation.listRecords(institutionId, {
  limit: 50,
  offset: 0
});
```

### 4. Cache Frequently Accessed Data

**Use in-memory caching:**
```typescript
const cache = new Map<string, any>();

async function getCached(key: string) {
  if (cache.has(key)) return cache.get(key);
  
  const value = await kv.get(key);
  cache.set(key, value);
  return value;
}
```

### 5. Offload Heavy Work to Triple Store

**Use SPARQL for complex queries:**
```typescript
// Instead of scanning all records in KV
const all = await kv.getByPrefix('moon:inst:record:');

// Query triple store for specific data
const results = await tripleStore.querySparql(`
  SELECT ?work ?title
  WHERE {
    ?work a bf:Work ;
          bf:title ?title .
    FILTER(CONTAINS(?title, "${query}"))
  }
`, config);
```

---

## When You NEED PostgreSQL

If your MOON deployment reaches these thresholds, you must migrate:

### Hard Requirements:
- 📊 **>10,000 records** in a single institution
- 🔍 **Complex search queries** (faceted, Boolean operators, proximity)
- 📈 **Real-time analytics** (aggregations, grouping, statistics)
- 🔗 **Multi-step transactions** (atomic record + authority updates)
- ⚡ **Sub-second response times** at scale

### Migration Path:

1. **Export from KV to PostgreSQL:**
```typescript
// Pseudocode - requires external environment
const records = await kv.getByPrefix('moon:');

for (const record of records) {
  await postgres.query(`
    INSERT INTO moon_records (id, institution_id, document)
    VALUES ($1, $2, $3)
  `, [record.id, record.institutionId, record.document]);
}
```

2. **Update application code** to use SQL queries:
```typescript
// Instead of KV
const records = await postgres.query(`
  SELECT * FROM moon_records
  WHERE institution_id = $1
  AND document->>'@type' = 'bf:Work'
  LIMIT 50
`, [institutionId]);
```

3. **Add indexes:**
```sql
CREATE INDEX idx_institution ON moon_records(institution_id);
CREATE INDEX idx_document_search USING GIN(document jsonb_path_ops);
```

---

## Official Recommendation

### For Figma Make Environment:
**✅ Keep using KV with optimizations**

The KV approach is appropriate for:
- Development and testing
- Prototyping and demos
- Small-to-medium institutional deployments (<5,000 records)
- Educational/research purposes

### For Production Institutional Deployment:
**⚠️ Consider external hosting**

If you need:
- Scalability beyond 10,000 records
- Complex search and analytics
- Database-level integrity constraints
- Maximum performance

Then you should:
1. Deploy MOON to a custom environment (not Figma Make)
2. Migrate to PostgreSQL or another RDBMS
3. Add proper indexes and constraints
4. Implement connection pooling and caching

---

## Current Status

### What's Been Implemented (Within Constraints):

✅ **Application-level row security** (data isolation)  
✅ **Namespaced KV patterns** (logical partitioning)  
✅ **Audit logging** (persistent event tracking)  
✅ **Performance tracking** (metrics collection)  
✅ **Search optimization** (prefix-based queries)  
✅ **Secondary indexes** (metadata keys)  

### What Cannot Be Implemented (Platform Limitations):

❌ **PostgreSQL tables**  
❌ **SQL indexes**  
❌ **Foreign key constraints**  
❌ **Full-text search indexes**  
❌ **Database triggers**  
❌ **Stored procedures**  

---

## Conclusion

**The KV store is fine for:**
- ✅ Prototyping MOON's Linked Data architecture
- ✅ Testing BIBFRAME compliance
- ✅ Demonstrating enterprise features
- ✅ Small institutional pilots (<5,000 records)

**The KV store is NOT fine for:**
- ❌ Large-scale production (>10,000 records)
- ❌ Complex search requirements
- ❌ Real-time analytics
- ❌ National library deployments

**For true enterprise scale**, MOON would need to be deployed outside Figma Make with a proper PostgreSQL database. The architecture is ready - only the storage layer needs upgrading.

---

## Next Steps (If Migrating)

1. **Export all KV data** to JSON files
2. **Set up PostgreSQL** in external environment
3. **Run migration script** to create tables and import data
4. **Update data access layer** to use SQL instead of KV
5. **Add indexes** for performance
6. **Test thoroughly** before switching

**But within Figma Make, we've implemented the best possible solution given platform constraints.**

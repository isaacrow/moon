## 📊 Load Testing & Performance Benchmarking

### Overview

MOON must be tested under realistic loads to ensure enterprise readiness. This guide provides testing strategies, benchmarks, and tools.

---

## Test Scenarios

### 1️⃣ Record Volume Tests

Test MOON's performance with increasing record counts:

| Test | Records | Expected Performance |
|------|---------|---------------------|
| Small | 100 | <100ms list operations |
| Medium | 1,000 | <500ms list operations |
| Large | 10,000 | <2s list operations |
| Very Large | 100,000 | >5s list operations (⚠️ not recommended) |

### 2️⃣ Concurrent Operations

Test simultaneous user actions:

- 10 users creating records simultaneously
- 50 users searching simultaneously
- 5 users running SPARQL queries simultaneously

### 3️⃣ Authority Merge at Scale

Test merge performance:

- Merge 2 authorities affecting 10 records
- Merge 2 authorities affecting 100 records
- Merge 5 authorities affecting 1,000 records

### 4️⃣ SHACL Validation Latency

Test validation timing:

- Simple record (5 triples): Target <500ms
- Medium record (50 triples): Target <2s
- Complex record (500 triples): Target <10s

### 5️⃣ SPARQL Update Contention

Test concurrent triple store operations:

- 5 simultaneous uploads
- 10 simultaneous queries
- Mixed upload + query operations

---

## Load Testing Tools

### Tool 1: Bulk Record Generator

```bash
# Create 1,000 test records
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/test/generate-records \
  -H "X-User-ID: admin-id" \
  -d '{"count": 1000, "institutionId": "demo-inst"}'
```

### Tool 2: Concurrent Request Simulator

```bash
# Run 50 concurrent searches
for i in {1..50}; do
  curl -H "X-User-ID: cataloger-id" \
    https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/search?q=test &
done
wait
```

### Tool 3: Apache Bench (ab)

```bash
# Test record listing endpoint
ab -n 100 -c 10 \
  -H "X-User-ID: cataloger-id" \
  https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records

# Output shows:
# - Requests per second
# - Average response time
# - 95th percentile latency
```

### Tool 4: Artillery.io

```yaml
# artillery-config.yml
config:
  target: 'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c'
  phases:
    - duration: 60
      arrivalRate: 10 # 10 users per second

scenarios:
  - name: "Search records"
    flow:
      - get:
          url: "/moon/search?q=test"
          headers:
            X-User-ID: "cataloger-id"
```

```bash
artillery run artillery-config.yml
```

---

## Performance Benchmarks

### Expected Timings (KV Store):

| Operation | 100 records | 1,000 records | 10,000 records |
|-----------|-------------|---------------|----------------|
| List all | 50ms | 300ms | 2,500ms |
| Search | 80ms | 500ms | 4,000ms |
| Get by ID | 10ms | 10ms | 10ms |
| Create | 50ms | 50ms | 50ms |
| Authority merge (10 refs) | 500ms | 500ms | 500ms |
| Authority merge (100 refs) | 2s | 2s | 2s |
| Authority merge (1,000 refs) | 15s | 15s | 15s |

### SHACL Validation (with triple store):

| Record Size | Upload | Validation | Total |
|-------------|--------|------------|-------|
| Small (5 triples) | 200ms | 300ms | 500ms |
| Medium (50 triples) | 500ms | 1,000ms | 1,500ms |
| Large (500 triples) | 2,000ms | 5,000ms | 7,000ms |

### SPARQL Queries (Apache Jena Fuseki):

| Query Type | Complexity | Expected Time |
|------------|------------|---------------|
| SELECT (simple) | 10 triples | <100ms |
| SELECT (complex) | 100+ triples | <1s |
| CONSTRUCT | 50 triples | <500ms |
| UPDATE | 10 triples | <200ms |

---

## Stress Test Checklist

### ✅ Pre-Test Setup

- [ ] Create test institution separate from production
- [ ] Generate test user accounts (admin, cataloger, viewer)
- [ ] Set up monitoring (health endpoint, error logs)
- [ ] Configure triple store (if testing SHACL/SPARQL)
- [ ] Document baseline metrics (empty system)

### ✅ During Testing

- [ ] Monitor CPU and memory usage
- [ ] Track response times
- [ ] Log all errors
- [ ] Check audit log size
- [ ] Monitor triple store performance

### ✅ Post-Test Analysis

- [ ] Review error logs for failures
- [ ] Identify bottlenecks (list, search, merge, etc.)
- [ ] Check data integrity (no corrupted records)
- [ ] Verify audit logs captured all operations
- [ ] Document performance degradation points

---

## Known Bottlenecks

### 1. List Operations
**Problem:** Loading all records from KV for filtering  
**Impact:** Linear with record count  
**Solution:** Implement pagination, use indexes

### 2. Search
**Problem:** Full JSON string scan  
**Impact:** O(n) complexity  
**Solution:** Use triple store SPARQL for complex queries

### 3. Authority Merge
**Problem:** Must scan all records to find references  
**Impact:** O(n × m) where n=records, m=authorities  
**Solution:** Maintain reverse index or use triple store

### 4. SHACL Validation
**Problem:** Triple store round-trip + graph processing  
**Impact:** Network latency + validation time  
**Solution:** Batch validation, cache shapes

### 5. Concurrent Writes
**Problem:** KV store may not support transactions  
**Impact:** Race conditions possible  
**Solution:** Implement optimistic locking

---

## Optimization Strategies

### 1. Pagination (Implemented)
```typescript
// Always use limits
const records = await dataIsolation.listRecords(institutionId, {
  limit: 50,
  offset: page * 50
});
```

### 2. Caching
```typescript
// In-memory cache for frequently accessed data
const cache = new Map();

async function getCachedRecord(id, institutionId) {
  const cacheKey = `${institutionId}:${id}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const record = await dataIsolation.getRecord(id, institutionId);
  cache.set(cacheKey, record);
  return record;
}
```

### 3. Secondary Indexes
```typescript
// Create metadata indexes
await kv.set(`moon:${instId}:index:type:Work:${id}`, id);
await kv.set(`moon:${instId}:index:status:published:${id}`, id);

// Query via index
const workIds = await kv.getByPrefix(`moon:${instId}:index:type:Work:`);
const works = await Promise.all(
  workIds.map(id => dataIsolation.getRecord(id, instId))
);
```

### 4. Batch Operations
```typescript
// Instead of sequential saves
for (const record of records) {
  await saveRecord(record); // Slow
}

// Use batch/parallel
await Promise.all(
  records.map(record => saveRecord(record))
);
```

### 5. Offload to Triple Store
```typescript
// Instead of KV scan for search
const allRecords = await kv.getByPrefix('...');
const filtered = allRecords.filter(...);

// Use SPARQL
const results = await tripleStore.querySparql(`
  SELECT ?work ?title
  WHERE {
    ?work a bf:Work ;
          bf:title ?title .
    FILTER(CONTAINS(?title, "${query}"))
  }
`);
```

---

## Performance Monitoring

### Health Endpoint
```bash
curl https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/health
```

Returns:
```json
{
  "status": "healthy",
  "metrics": {
    "errorRate": 0.5,
    "avgResponseTime": 245,
    "recentErrors": 3,
    "criticalAlerts": 0
  },
  "issues": []
}
```

### Performance Metrics Endpoint
```bash
curl -H "X-User-ID: admin-id" \
  https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/admin/metrics?operation=record.create
```

Returns:
```json
{
  "metrics": [...],
  "statistics": {
    "avgDuration": 342,
    "successRate": 98.5,
    "totalOperations": 1523
  }
}
```

---

## Scale Limits

### Current Architecture (KV):

**Production Ready:**
- ✅ 1-1,000 records: Excellent performance
- ✅ 1,000-5,000 records: Good performance with pagination

**Acceptable:**
- ⚠️ 5,000-10,000 records: Acceptable with optimizations

**Not Recommended:**
- ❌ 10,000-100,000 records: Slow, requires PostgreSQL
- ❌ 100,000+ records: Unusable, MUST migrate to SQL

### Scaling Path:

1. **0-1,000 records:** Use as-is
2. **1,000-5,000 records:** Add pagination, caching
3. **5,000-10,000 records:** Add indexes, offload search to triple store
4. **10,000+ records:** Migrate to PostgreSQL (outside Figma Make)

---

## Load Test Results Template

Document your test results:

```markdown
## Load Test Results - [Date]

### Test Configuration
- Records: 1,000
- Concurrent Users: 10
- Duration: 5 minutes
- Triple Store: Apache Jena Fuseki

### Results
- Total Requests: 2,450
- Successful: 2,387 (97.4%)
- Failed: 63 (2.6%)
- Avg Response Time: 423ms
- 95th Percentile: 1,245ms
- Throughput: 8.2 req/s

### Bottlenecks Identified
1. List operations taking >1s with 1,000 records
2. Search timeout on complex queries
3. Authority merge >5s with 100 references

### Recommended Actions
1. Implement pagination for list endpoint
2. Add caching for frequently accessed records
3. Create secondary indexes for type-based queries
```

---

## Continuous Performance Testing

### Set Up Automated Tests

```bash
# Daily performance check
crontab -e

# Add:
0 2 * * * /path/to/performance-test.sh >> /var/log/moon-perf.log
```

### Alert on Degradation

```typescript
// In observability.tsx
if (avgResponseTime > 2000) {
  await triggerAlert('performance_degradation', {
    avgResponseTime,
    operation,
    threshold: 2000
  });
}
```

---

## Conclusion

**MOON's current architecture performs well up to ~5,000 records.**

Beyond that, you need:
1. Pagination (implemented ✅)
2. Caching (can be added)
3. Secondary indexes (can be added)
4. PostgreSQL migration (requires external environment)

**For most institutional pilots and demos, current performance is production-ready.**

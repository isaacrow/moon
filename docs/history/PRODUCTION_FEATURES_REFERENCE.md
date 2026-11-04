# 🔐 MOON SAND V2 - Production Features Reference
**Quick guide for developers and system administrators**

---

## 🛡️ Data Integrity Protection

### Automatic Checksum Verification
**Every record load is verified for corruption**

```typescript
// Automatic on all getRecord() calls
const record = await recordService.getRecord(recordId);
// ✅ Checksum verified
// ❌ Throws error if corrupted
```

**Error Response:**
```json
{
  "error": "Data corruption detected for record bibframe:record:abc123. Checksum mismatch.",
  "code": "DATA_CORRUPTION"
}
```

**What happens on corruption:**
1. Error logged to console with checksums
2. Audit log entry created
3. Error thrown (fail-safe)
4. Client receives HTTP 500

---

## 🔒 Publishing Workflow

### Validation Enforcement
**Records must be validated before publishing**

```typescript
// 1. Validate record
const validation = recordService.validateForPublishing(graph);

// 2. Attempt publish
const published = await recordService.publishRecord(recordId, userId);
// ✅ Succeeds if validation passed
// ❌ Fails if validation failed or record modified
```

**Publish Rejection Scenarios:**

#### Scenario 1: Validation Failed
```json
{
  "error": "Cannot publish: Record failed validation with 3 errors. Please fix validation errors before publishing.",
  "code": "VALIDATION_REQUIRED"
}
```
**HTTP Status:** 409 Conflict

#### Scenario 2: Modified After Validation
```json
{
  "error": "Cannot publish: Record has been modified since last validation. Please re-validate the current version before publishing.",
  "code": "REVALIDATION_REQUIRED"
}
```
**HTTP Status:** 409 Conflict

### Record Locking
**Published records are automatically locked**

```typescript
// Attempt to update published record
const updated = await recordService.updateRecord(recordId, newGraph, title, userId);
// ❌ Throws error
```

**Error Response:**
```json
{
  "error": "Record bibframe:record:xyz789 is locked (status: published). Cannot modify published records.",
  "code": "RECORD_LOCKED"
}
```
**HTTP Status:** 403 Forbidden

**To update a published record:**
1. Create new draft version
2. Modify draft
3. Publish new version

---

## 📝 Immutable Audit Trail

### Audit Logging
**All record operations are logged**

```typescript
// Get full audit history
const auditHistory = await auditLog.getAuditHistory(recordId);

// Get specific actions
const publishEvents = await auditLog.getAuditByAction(recordId, 'record.published');

// Get statistics
const stats = await auditLog.getAuditStats(recordId);
```

### Tracked Actions
- `record.created` - Record creation
- `record.updated` - Record modification
- `record.published` - Publishing event
- `record.archived` - Soft deletion
- `record.corrupted` - Corruption detection
- `version.created` - Version snapshot
- `export.jsonld` / `export.turtle` / `export.marc` - Export operations
- `validation.passed` / `validation.failed` - Validation results

### Archive (Not Delete)
**Audit logs are never deleted**

```typescript
// ✅ Archive old logs (keeps them)
const archived = await auditLog.archiveOldAudits(recordId, 365);

// ✅ Retrieve archived logs
const archivedLogs = await auditLog.getArchivedAuditHistory(recordId);

// ❌ Delete is deprecated
const deleted = await auditLog.cleanupOldAudits(recordId);
// Throws: "DEPRECATED: cleanupOldAudits() is not allowed. Audit logs are immutable."
```

---

## 🌐 Public API Endpoints

### Public Record Access
**Only published records are accessible**

```bash
GET /make-server-49c0e13c/api/records/{id}/public
```

**Response (Published Record):**
```json
{
  "@context": { "bf": "http://id.loc.gov/ontologies/bibframe/", ... },
  "@graph": [ ... ],
  "metadata": {
    "recordId": "bibframe:record:abc123",
    "title": "Sample Work",
    "publishedAt": "2026-02-25T10:30:00Z",
    "versionNumber": 2,
    "checksum": "a1b2c3d4..."
  }
}
```

**Response (Not Published):**
```json
{
  "error": "Record not found or not published"
}
```
**HTTP Status:** 404 Not Found

**What's Stripped:**
- ❌ Internal user IDs (removed from publishedBy)
- ❌ Audit history
- ❌ Validation errors
- ❌ Draft versions
- ✅ Only canonical graph + public metadata

---

## 📊 Versioning

### Create Version
**Version snapshots include validation**

```typescript
const version = await recordService.createVersion(
  recordId,
  graphSnapshot,
  userId,
  'My version comment'
);
```

**Version Structure:**
```typescript
{
  id: "bibframe:record:abc123:v2",
  recordId: "bibframe:record:abc123",
  versionNumber: 2,
  graphSnapshot: { ... }, // Canonical JSON-LD
  checksum: "a1b2c3...",
  createdAt: "2026-02-25T10:30:00Z",
  createdBy: "user123",
  comment: "My version comment",
  validationResult: {
    valid: true,
    errors: [],
    timestamp: "2026-02-25T10:30:00Z",
    checksumValidated: "a1b2c3..." // ✅ Tied to this checksum
  }
}
```

### Retrieve Versions
```typescript
// Get all versions
const versions = await recordService.getVersionHistory(recordId);

// Get specific version
const v2 = await recordService.getVersion(recordId, 2);

// Get latest version
const latest = await recordService.getLatestVersion(recordId);
```

### Restore Version
```bash
POST /make-server-49c0e13c/api/records/{id}/versions/{versionNumber}/restore
```

---

## 🔄 Export Formats

### Canonical JSON-LD
```bash
GET /make-server-49c0e13c/api/records/{id}/export?format=jsonld
```

**Features:**
- Deterministic ordering
- Stable checksums
- Export metadata included

### RDF Turtle
```bash
GET /make-server-49c0e13c/api/records/{id}/export?format=turtle
```

### MARC 21
```bash
GET /make-server-49c0e13c/api/records/{id}/export?format=marc
```

**Uses:** `marcMappingRegistry.tsx` for explicit BIBFRAME → MARC conversion

### Mind Map
```bash
GET /make-server-49c0e13c/api/records/{id}/mindmap?format=json
GET /make-server-49c0e13c/api/records/{id}/mindmap?format=svg
```

**JSON Response:**
```json
{
  "nodes": [
    {
      "id": "http://example.org/work/1",
      "label": "Sample Work",
      "type": "bf:Work",
      "color": "#3b82f6",
      "size": 40,
      "x": 700,
      "y": 500
    }
  ],
  "edges": [
    {
      "source": "http://example.org/work/1",
      "target": "http://example.org/instance/1",
      "label": "hasInstance",
      "type": "bf:hasInstance"
    }
  ],
  "metadata": {
    "nodeCount": 5,
    "edgeCount": 8,
    "entityTypes": ["bf:Work", "bf:Instance", "bf:Title"]
  }
}
```

---

## 🚨 Error Handling

### HTTP Status Codes
| Code | Meaning | When |
|------|---------|------|
| **200** | Success | Operation completed |
| **400** | Bad Request | Missing required fields |
| **403** | Forbidden | Trying to modify locked record |
| **404** | Not Found | Record doesn't exist or not published |
| **409** | Conflict | Validation failed or stale data |
| **500** | Server Error | Data corruption or system failure |

### Error Response Format
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

### Error Codes
- `RECORD_LOCKED` - Cannot modify published record
- `VALIDATION_REQUIRED` - Validation failed
- `REVALIDATION_REQUIRED` - Record modified after validation
- `DATA_CORRUPTION` - Checksum mismatch detected

---

## 🔧 Configuration

### Validation Settings
**Strict Mode** (require validation before publish):
```typescript
// In publishRecord(), uncomment:
if (!latestVersion || !latestVersion.validationResult) {
  throw new Error('Cannot publish: Record must be validated first');
}
```

**Lenient Mode** (current default):
- Allow publish without validation history
- Only enforce if validation exists

### Archive Retention
```typescript
// Archive logs older than 1 year (default)
await auditLog.archiveOldAudits(recordId, 365);

// Archive logs older than 5 years
await auditLog.archiveOldAudits(recordId, 1825);
```

### Checksum Algorithm
**Current:** SHA-256  
**File:** `/supabase/functions/server/canonicalJsonLd.tsx`

To change algorithm:
```typescript
export function generateChecksum(canonicalJsonLd: any): string {
  const normalized = JSON.stringify(canonicalJsonLd, null, 0);
  const hash = createHash('sha512'); // ← Change here
  hash.update(normalized);
  return hash.digest('hex');
}
```

---

## 📈 Monitoring & Observability

### Key Metrics to Track

#### Data Integrity
- Corruption detection rate
- Checksum verification failures
- Archive size growth

#### Publishing Workflow
- Validation failure rate
- Publish attempts on invalid records
- Lock violation attempts

#### Performance
- Average checksum verification time
- Version creation latency
- Export generation time

### Log Patterns
```bash
# Corruption detection
[CORRUPTION DETECTED] Record bibframe:record:abc123 checksum mismatch

# Audit archiving
[AUDIT ARCHIVE] Archived 127 audit logs older than 365 days for record bibframe:record:abc123

# Validation enforcement
[VALIDATION] Cannot publish bibframe:record:abc123: 3 validation errors

# Version creation
[VERSION] Created version 5 for record bibframe:record:abc123 with checksum a1b2c3...
```

---

## 🧪 Testing Checklist

### Data Integrity Tests
```bash
# Test 1: Checksum stability
✅ Save record → get checksum A
✅ Reload record → get checksum B
✅ Assert: A === B

# Test 2: Corruption detection
✅ Save record
✅ Manually corrupt data in KV store
✅ Attempt to load
✅ Assert: Throws corruption error
```

### Publishing Workflow Tests
```bash
# Test 3: Validation enforcement
✅ Create record with invalid data
✅ Attempt publish
✅ Assert: Returns 409 Conflict

# Test 4: Lock enforcement
✅ Publish record
✅ Attempt to modify
✅ Assert: Returns 403 Forbidden

# Test 5: Stale validation
✅ Validate record
✅ Modify record
✅ Attempt publish
✅ Assert: Returns 409 Conflict (revalidation required)
```

### Audit Trail Tests
```bash
# Test 6: Immutability
✅ Create audit log
✅ Attempt to delete with cleanupOldAudits()
✅ Assert: Throws deprecation error

# Test 7: Archive functionality
✅ Create old audit log
✅ Call archiveOldAudits()
✅ Assert: Log moved to archive namespace
✅ Assert: Original log still exists (marked archived)
```

---

## 📚 API Reference Summary

### Records
```
POST   /api/records                    Create record
GET    /api/records                    List records
GET    /api/records/:id                Get record (with checksum verification)
PUT    /api/records/:id                Update record (lock check)
DELETE /api/records/:id                Archive record
GET    /api/records/:id/public         Get published record (public access)
```

### Publishing
```
POST   /api/records/:id/publish        Publish record (validation enforcement)
POST   /api/records/:id/archive        Archive record
POST   /api/records/:id/unpublish      Unpublish record
```

### Versions
```
GET    /api/records/:id/versions                    List versions
GET    /api/records/:id/versions/:num              Get specific version
POST   /api/records/:id/versions/:num/restore      Restore version
```

### Export
```
GET    /api/records/:id/export?format=jsonld      Canonical JSON-LD
GET    /api/records/:id/export?format=turtle      RDF Turtle
GET    /api/records/:id/export?format=marc        MARC 21
```

### Visualization
```
GET    /api/records/:id/mindmap?format=json       Mind map data
GET    /api/records/:id/mindmap?format=svg        Mind map SVG
```

### Audit
```
GET    /api/records/:id/audit                     Audit history
GET    /api/records/:id/audit/stats               Audit statistics
```

---

## 🎯 Best Practices

### 1. Always Validate Before Publishing
```typescript
// ✅ Good
const validation = validateForPublishing(graph);
if (!validation.valid) {
  // Show errors to user
  return;
}
await publishRecord(recordId, userId);

// ❌ Bad
await publishRecord(recordId, userId); // Might fail
```

### 2. Handle Lock Errors Gracefully
```typescript
try {
  await updateRecord(recordId, graph);
} catch (error) {
  if (error.message.includes('locked')) {
    // Show user: "This record is published. Create new version?"
  }
}
```

### 3. Monitor Corruption Events
```typescript
// Set up alert on this log pattern
[CORRUPTION DETECTED] Record ...
```

### 4. Use Archive for Compliance
```typescript
// Run monthly
await auditLog.archiveOldAudits(recordId, 365);
// Logs preserved for forensic investigation
```

### 5. Leverage Semantic HTTP Codes
```typescript
// Client-side
if (response.status === 409) {
  if (response.data.code === 'REVALIDATION_REQUIRED') {
    // Show: "Please re-validate before publishing"
  }
}
```

---

**End of Reference Guide**

For detailed implementation, see:
- `/ENTERPRISE_AUDIT_REPORT.md` - Full audit analysis
- `/PRODUCTION_HARDENING_SUMMARY.md` - Implementation details

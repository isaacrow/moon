# 🚀 Production Hardening - Quick Start Guide

## For Developers: How to Use the New Features

### 1. Creating Records (Now Production-Safe)

**Before:**
```typescript
// Frontend serializes graph
const graphJson = myGraph;
await saveRecord(graphJson);
```

**After (Automatic):**
```typescript
// Backend automatically canonicalizes
const response = await fetch('/api/records', {
  method: 'POST',
  body: JSON.stringify({
    graphJson: myGraph, // Raw input
    title: 'My Work',
    resourceType: 'Work',
    userId: currentUser.id
  })
});

// Backend does:
// 1. toCanonicalJsonLd(graphJson)
// 2. generateChecksum()
// 3. Store with checksum
// 4. Create version snapshot
// 5. Log to audit trail
```

✅ **No code changes needed** - backend handles everything!

---

### 2. Checking if Record is Locked

```typescript
const record = await fetch(`/api/records/${id}`).then(r => r.json());

if (record.locked) {
  // Disable edit button
  setEditable(false);
  showMessage(`This record is locked (${record.status})`);
}
```

**Lock States:**
- `draft` → `locked: false` ✏️ Editable
- `published` → `locked: true` 🔒 Read-only
- `archived` → `locked: false` ✏️ Editable

---

### 3. Using Public Endpoint for OPAC

**Before:**
```typescript
// OPAC showed draft records
const record = await fetch(`/api/records/${id}`);
```

**After:**
```typescript
// OPAC only shows published
const response = await fetch(`/api/records/${id}/public`);

if (response.status === 404) {
  showMessage('Record not published');
} else {
  const { record } = await response.json();
  renderOPAC(record);
}
```

---

### 4. Downloading JSON-LD (With Export Metadata)

**Before:**
```typescript
const blob = new Blob([JSON.stringify(jsonldData, null, 2)]);
```

**After:**
```typescript
const response = await fetch(
  `/api/records/${id}/export?format=jsonld`,
  {
    headers: { 'X-User-Id': currentUser.id }
  }
);

const exported = await response.json();

// Exported includes metadata
const blob = new Blob([JSON.stringify(exported, null, 2)], {
  type: 'application/ld+json'
});

// Download includes:
// - Canonical JSON-LD
// - Export timestamp
// - User who exported
// - Checksum
// - Version number
```

---

### 5. Exporting MARC 21

**Before:**
```typescript
// Frontend conversion (unreliable)
const marc = convertToMARC(data);
```

**After:**
```typescript
// Backend uses mapping registry
const response = await fetch(
  `/api/records/${id}/marc`,
  {
    headers: { 'X-User-Id': currentUser.id }
  }
);

const marcText = await response.text();
// Returns MARC 21 formatted text

// Also logs export to audit trail
```

---

### 6. Generating Mind Map

**Before:**
```typescript
// Manually create nodes from Work/Instance
const mindMap = createMindMapFromWorkInstance(work, instance);
```

**After:**
```typescript
// Backend generates from RDF triples
const response = await fetch(`/api/records/${id}/mindmap?format=json`);
const { mindMap } = await response.json();

// mindMap contains:
// - nodes: Array of RDF subjects
// - edges: Array of RDF predicates
// - metadata: Node/edge counts, types
```

**SVG Format:**
```typescript
// Get SVG directly
const response = await fetch(`/api/records/${id}/mindmap?format=svg`);
const svgText = await response.text();

// Use in img tag
<img src={`data:image/svg+xml,${encodeURIComponent(svgText)}`} />
```

---

### 7. Viewing Audit History

```typescript
const response = await fetch(`/api/records/${id}/audit`);
const { history } = await response.json();

// Render timeline
history.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.action} by ${entry.userId}`);
});

// Example output:
// 2024-03-15T10:30:00Z: record.published by user123
// 2024-03-14T09:15:00Z: record.updated by user123
// 2024-03-13T14:20:00Z: record.created by user123
```

---

### 8. Viewing Validation History

```typescript
const response = await fetch(`/api/records/${id}/validation-history`);
const { history } = await response.json();

// Show validation status per version
history.forEach(validation => {
  if (validation.valid) {
    console.log(`✅ Version ${validation.versionNumber}: Valid`);
  } else {
    console.log(`❌ Version ${validation.versionNumber}: Errors:`);
    validation.errors.forEach(err => console.log(`  - ${err}`));
  }
});
```

---

## Frontend Component Updates

### Update RecordViewerDialog.tsx

**OPAC Tab:**
```typescript
// Before
const transformedData = transformForViews(jsonldData);

// After - fetch from public endpoint
useEffect(() => {
  fetch(`/api/records/${recordId}/public`)
    .then(r => r.json())
    .then(({ record }) => setPublicData(record));
}, [recordId]);
```

**Mind Map Tab:**
```typescript
// Before
<MindMapViewContent workData={work} instanceData={instance} />

// After - use endpoint
useEffect(() => {
  fetch(`/api/records/${recordId}/mindmap?format=json`)
    .then(r => r.json())
    .then(({ mindMap }) => setMindMapData(mindMap));
}, [recordId]);

// Then render from mindMapData.nodes and mindMapData.edges
```

**MARC Tab:**
```typescript
// Before
const marcRecords = convertToMARC(data);

// After - use endpoint
useEffect(() => {
  fetch(`/api/records/${recordId}/marc`)
    .then(r => r.text())
    .then(marcText => setMarcData(marcText));
}, [recordId]);
```

**Download Button:**
```typescript
// Before
const handleDownload = () => {
  const blob = new Blob([JSON.stringify(jsonldData, null, 2)]);
  downloadBlob(blob, 'record.jsonld');
};

// After - with export metadata
const handleDownload = async () => {
  const response = await fetch(
    `/api/records/${recordId}/export?format=jsonld`,
    { headers: { 'X-User-Id': currentUser.id } }
  );
  const exported = await response.json();
  
  const blob = new Blob([JSON.stringify(exported, null, 2)], {
    type: 'application/ld+json'
  });
  downloadBlob(blob, `record-${recordId}.jsonld`);
};
```

---

### Update MoonSandV2.tsx

**Add Lock Indicator:**
```typescript
{record?.locked && (
  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded">
    <Lock className="h-4 w-4" />
    <span>This record is locked (published). Create a new version to edit.</span>
  </div>
)}
```

**Disable Save When Locked:**
```typescript
const handleSave = async () => {
  if (record?.locked) {
    toast.error('Cannot edit published records');
    return;
  }
  
  // ... continue save
};
```

**Show Audit Button:**
```typescript
<Button
  variant="outline"
  onClick={() => setShowAuditHistory(true)}
>
  <History className="h-4 w-4 mr-2" />
  View Audit History
</Button>
```

---

### Update RecordsDashboard.tsx

**Show Lock Status:**
```typescript
{records.map(record => (
  <Card key={record.id}>
    <div className="flex items-center justify-between">
      <h3>{record.title}</h3>
      <div className="flex items-center gap-2">
        <Badge variant={record.status === 'published' ? 'success' : 'default'}>
          {record.status}
        </Badge>
        {record.locked && <Lock className="h-4 w-4 text-amber-600" />}
      </div>
    </div>
    <p className="text-sm text-gray-500">
      Checksum: {record.checksum?.substring(0, 8)}...
    </p>
  </Card>
))}
```

---

## Error Handling

### Locked Record Error
```typescript
try {
  await updateRecord(id, graphJson);
} catch (error) {
  if (error.message.includes('locked')) {
    toast.error(
      'This record is published and locked. ' +
      'Please create a new version or unpublish to edit.'
    );
  }
}
```

### Unpublished Record (Public Access)
```typescript
const response = await fetch(`/api/records/${id}/public`);

if (response.status === 404) {
  showMessage('This record is not published or does not exist');
  return;
}
```

---

## Testing

### Test Canonical Serialization
```typescript
// Create same record twice
const record1 = await createRecord(graphJson);
const record2 = await createRecord(graphJson);

// Checksums should match (deterministic)
expect(record1.checksum).toBe(record2.checksum);
```

### Test Lock Enforcement
```typescript
// Publish record
await publishRecord(id);

// Try to update
const response = await fetch(`/api/records/${id}`, {
  method: 'PUT',
  body: JSON.stringify({ graphJson: updatedGraph })
});

// Should fail
expect(response.status).toBe(500);
expect(await response.json()).toMatchObject({
  error: expect.stringContaining('locked')
});
```

### Test Audit Logging
```typescript
// Create record
await createRecord(graphJson, 'My Work', 'Work', 'user123');

// Check audit log
const { history } = await fetch(`/api/records/${id}/audit`)
  .then(r => r.json());

expect(history).toContainEqual(
  expect.objectContaining({
    action: 'record.created',
    userId: 'user123'
  })
);
```

---

## Migration Checklist

### Backend (✅ Complete)
- [x] Canonical JSON-LD serialization
- [x] MARC mapping registry
- [x] Audit logging
- [x] Mind map generator
- [x] Record locking
- [x] Version checksums
- [x] Export metadata
- [x] Validation history

### Frontend (TODO)
- [ ] Update OPAC to use `/public` endpoint
- [ ] Update Mind Map to use `/mindmap` endpoint
- [ ] Update MARC to use `/marc` endpoint
- [ ] Update JSON-LD download to use `/export` endpoint
- [ ] Show lock indicator in UI
- [ ] Disable edit when locked
- [ ] Add audit history viewer
- [ ] Add validation history viewer
- [ ] Update error messages for lock errors

---

## Quick Tips

### 1. Always Use Export Endpoint
❌ **Don't:**
```typescript
const data = record.graphJson;
downloadBlob(data, 'export.json');
```

✅ **Do:**
```typescript
const exported = await fetch(`/api/records/${id}/export?format=jsonld`);
const data = await exported.json();
downloadBlob(data, 'export.json');
```

### 2. Check Lock Before Edit
❌ **Don't:**
```typescript
const handleEdit = () => {
  setEditMode(true);
};
```

✅ **Do:**
```typescript
const handleEdit = () => {
  if (record.locked) {
    toast.error('Record is locked');
    return;
  }
  setEditMode(true);
};
```

### 3. Use Public Endpoint for OPAC
❌ **Don't:**
```typescript
// OPAC showing drafts
const record = await getRecord(id);
```

✅ **Do:**
```typescript
// OPAC only published
const record = await getPublicRecord(id);
```

### 4. Log User Actions
✅ **Always include userId:**
```typescript
await fetch('/api/records', {
  method: 'POST',
  headers: { 'X-User-Id': currentUser.id },
  body: JSON.stringify({ ... })
});
```

---

## 🎯 Summary

**Key Changes:**
1. All serialization is now backend-only (canonical)
2. Published records are locked (immutable)
3. OPAC uses `/public` endpoint (published only)
4. Mind Map generated from RDF triples
5. MARC uses explicit mapping registry
6. All actions logged to audit trail
7. All versions have checksums
8. All exports have metadata

**Benefits:**
- ✅ Reliable versioning (deterministic)
- ✅ Data integrity (checksums)
- ✅ Audit trail (accountability)
- ✅ Record immutability (safety)
- ✅ Explicit mappings (testable)
- ✅ True graph viz (semantic)

**Migration Effort:**
- Backend: **COMPLETE** ✅
- Frontend: **Simple updates** to use new endpoints

---

*Ready for production deployment!* 🚀

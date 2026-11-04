# 🚀 LOC Integration Quick Reference Card
## For Moon BIBFRAME Developers

---

## 📦 Import Services

```typescript
// Authority Service
import { locAuthorityService } from '/src/app/services/locAuthorityService';

// SPARQL Service
import { locSparqlService } from '/src/app/services/locSparqlService';

// Ontology Binder
import { 
  resolveAuthority, 
  authorityToURIReference,
  isURIReference,
  validateNoLiteral,
  hasAuthorityBinding,
  getAuthorityServiceName
} from '/src/app/engine/ontologyBinder';
```

---

## 🔍 Authority Search (Direct)

```typescript
// LCNAF (Names)
const names = await locAuthorityService.searchNames('García Márquez');

// LCSH (Subjects)
const subjects = await locAuthorityService.searchSubjects('Magic realism');

// LCGFT (Genre/Form)
const genres = await locAuthorityService.searchGenreForms('Novels');

// LCC (Classification)
const classes = await locAuthorityService.searchClassification('PQ8180');
```

**Returns:**
```typescript
[{
  label: "García Márquez, Gabriel, 1927-2014",
  uri: "http://id.loc.gov/authorities/names/n79084266",
  type: "Authority",
  description: "Colombian author"
}]
```

---

## 🧠 Ontology-Driven Search (Recommended)

```typescript
// Define property
const property = {
  id: "bf:creator",
  uri: "http://id.loc.gov/ontologies/bibframe/creator",
  label: "Creator",
  range: ["bf:Agent"]  // ← Determines service
};

// Automatic service selection based on range
const results = await resolveAuthority(property, 'García');
// Automatically calls LCNAF because range is bf:Agent
```

**Range Mappings:**
- `bf:Agent` / `bf:Person` / `bf:Organization` → **LCNAF**
- `bf:Topic` / `bf:Subject` → **LCSH**
- `bf:GenreForm` → **LCGFT**
- `bf:Classification` → **LCC**

---

## 🔄 Convert to URI Reference

```typescript
// Selected authority from search
const selected = {
  label: "García Márquez, Gabriel, 1927-2014",
  uri: "http://id.loc.gov/authorities/names/n79084266",
  type: "Authority"
};

// Convert to proper URI reference
const uriRef = authorityToURIReference(selected);

// Result:
{
  "@id": "http://id.loc.gov/authorities/names/n79084266",
  "rdfs:label": "García Márquez, Gabriel, 1927-2014",
  "@type": "bf:Agent"
}

// Store in work data
workData["bf:creator"] = uriRef;  // ✅ URI reference
// NOT: workData["bf:creator"] = "García Márquez";  // ❌ Plain string
```

---

## 📖 Fetch BIBFRAME Records

```typescript
// Fetch Work from LOC
const work = await locAuthorityService.fetchBIBFRAMEWork('12345678');

// Fetch Instance from LOC
const instance = await locAuthorityService.fetchBIBFRAMEInstance('87654321');
```

---

## 🔎 SPARQL Queries

```typescript
// Search works by keyword
const works = await locSparqlService.searchWorks('solitude');

// Detect duplicates before creating record
const duplicates = await locSparqlService.detectDuplicates(
  'One Hundred Years of Solitude',
  'García Márquez'
);

// Find related works
const related = await locSparqlService.findRelatedWorks(
  'http://id.loc.gov/resources/works/12345'
);

// Cluster works (FRBR)
const cluster = await locSparqlService.clusterWorks(
  'http://id.loc.gov/resources/works/12345'
);

// Discover by subject
const bySubject = await locSparqlService.discoverBySubject(
  'http://id.loc.gov/authorities/subjects/sh85004379',
  20 // limit
);

// Discover by creator
const byCreator = await locSparqlService.discoverByCreator(
  'http://id.loc.gov/authorities/names/n79084266',
  20 // limit
);

// Custom SPARQL query
const results = await locSparqlService.customQuery(`
  PREFIX bf: <http://id.loc.gov/ontologies/bibframe/>
  SELECT ?work ?title WHERE {
    ?work a bf:Work ;
          bf:title ?titleObj .
    ?titleObj bf:mainTitle ?title .
  }
  LIMIT 10
`);
```

---

## ✅ Validation

```typescript
// Check if value is URI reference
if (!isURIReference(workData['bf:creator'])) {
  console.error('Creator must have @id!');
}

// Validate no plain strings where URIs required
if (!validateNoLiteral(workData['bf:creator'], creatorProperty)) {
  throw new Error('Creator requires URI, not plain string');
}

// Check if property has authority binding
if (hasAuthorityBinding(property)) {
  console.log('This property can use LOC authorities');
}

// Get service name for display
const serviceName = getAuthorityServiceName(property);
// Returns: "LC Name Authority (LCNAF)"
```

---

## 📊 Cache Management

```typescript
// Get cache statistics
const stats = locAuthorityService.getCacheStats();
console.log('Cache size:', stats.size);
console.log('Entries:', stats.entries);

// Clear cache
locAuthorityService.clearCache();
```

---

## 🎯 Common Patterns

### Pattern 1: Autocomplete Field

```typescript
async function handleSearch(query: string, property: OntologyProperty) {
  // Ontology determines service
  const results = await resolveAuthority(property, query);
  
  // Show in dropdown
  setSuggestions(results);
}

function handleSelect(authority: AuthorityResult) {
  // Convert to URI reference
  const uriRef = authorityToURIReference(authority);
  
  // Store (not plain string!)
  onChange(uriRef);
}
```

### Pattern 2: Pre-Save Validation

```typescript
async function beforeSave(workData: any) {
  // Check for duplicates
  const title = workData['bf:title'];
  const creator = workData['bf:creator']?.['rdfs:label'];
  
  const duplicates = await locSparqlService.detectDuplicates(title, creator);
  
  if (duplicates.length > 0) {
    if (!confirm('Possible duplicates found. Continue?')) {
      return false;
    }
  }
  
  // Validate URIs
  for (const [key, value] of Object.entries(workData)) {
    if (typeof value === 'object' && value?.['@id']) {
      if (!isURIReference(value)) {
        throw new Error(`${key} must be proper URI reference`);
      }
    }
  }
  
  return true;
}
```

### Pattern 3: Load LOC Example

```typescript
async function loadLOCExample(workId: string) {
  const work = await locAuthorityService.fetchBIBFRAMEWork(workId);
  
  if (work) {
    // Parse and populate form
    setWorkData(work);
  }
}
```

---

## ⚡ Performance Tips

1. **Debounce searches** (300ms recommended)
2. **Cache is automatic** (24h TTL, no action needed)
3. **Timeouts are handled** (8s for authorities, 30s for SPARQL)
4. **Errors return empty arrays** (no try/catch needed for most cases)

---

## 🚨 Common Mistakes

### ❌ DON'T: Store plain strings
```typescript
workData['bf:creator'] = 'García Márquez';  // WRONG
```

### ✅ DO: Store URI references
```typescript
workData['bf:creator'] = {
  '@id': 'http://id.loc.gov/authorities/names/n79084266',
  'rdfs:label': 'García Márquez, Gabriel',
  '@type': 'bf:Agent'
};  // CORRECT
```

---

### ❌ DON'T: Hardcode service in UI
```typescript
if (fieldName === 'creator') {
  searchLCNAF(query);  // WRONG - hardcoded
}
```

### ✅ DO: Use ontology binder
```typescript
const results = await resolveAuthority(property, query);  // CORRECT
```

---

### ❌ DON'T: Use label as key
```typescript
{ "label": "García Márquez" }  // WRONG
```

### ✅ DO: Use @id as key
```typescript
{ "@id": "http://id.loc.gov/..." }  // CORRECT
```

---

## 📱 Quick Test

```typescript
// Test LCNAF
console.log(await locAuthorityService.searchNames('shakespeare'));

// Test LCSH
console.log(await locAuthorityService.searchSubjects('drama'));

// Test ontology binding
const prop = { label: 'Creator', range: ['bf:Agent'] };
console.log(await resolveAuthority(prop, 'shakespeare'));

// Test validation
console.log(isURIReference({ '@id': 'http://...' }));  // true
console.log(isURIReference('plain string'));  // false
```

---

## 🎉 That's It!

Three main services:
1. **`locAuthorityService`** - Direct LOC API calls
2. **`locSparqlService`** - SPARQL queries
3. **`ontologyBinder`** - Smart property-to-service mapping

Use `resolveAuthority()` for most cases - let the ontology decide! 🚀

---

**Quick Reference Version:** 1.0  
**Last Updated:** February 15, 2026

# 🌕 MOON API Reference

Complete REST API documentation for the MOON Linked Data Library Platform.

---

## Base URL

```
https://{projectId}.supabase.co/functions/v1/make-server-49c0e13c/moon
```

Replace `{projectId}` with your Supabase project ID.

---

## Authentication

All requests require the Supabase anonymous key in the Authorization header:

```http
Authorization: Bearer {publicAnonKey}
```

---

## Endpoints

### 📋 List Records

Get a list of all MOON records.

```http
GET /moon/records
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | - | Filter by status: 'draft', 'published', 'archived' |
| limit | number | - | Maximum number of records to return |
| offset | number | - | Number of records to skip (pagination) |

**Example Request:**

```bash
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records?status=published&limit=10' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**

```json
{
  "records": [
    {
      "id": "abc-123-def-456",
      "uri": "https://moon.org/record/abc-123-def-456",
      "title": "Example Book",
      "document": { "@context": "...", "@graph": [...] },
      "metadata": {
        "created": "2024-01-01T00:00:00Z",
        "modified": "2024-01-02T00:00:00Z",
        "status": "published",
        "version": 1
      },
      "workUri": "https://moon.org/work/...",
      "instanceUri": "https://moon.org/instance/..."
    }
  ],
  "total": 42
}
```

---

### 📖 Get Record

Get a single record by ID.

```http
GET /moon/records/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Record UUID |

**Example Request:**

```bash
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/abc-123' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**

```json
{
  "id": "abc-123",
  "uri": "https://moon.org/record/abc-123",
  "title": "Example Book",
  "document": {
    "@context": "https://id.loc.gov/ontologies/bibframe.jsonld",
    "@graph": [
      {
        "@id": "https://moon.org/work/xyz",
        "@type": "bf:Work",
        "bf:title": [...]
      }
    ]
  },
  "metadata": { ... }
}
```

**Error Response (404):**

```json
{
  "error": "Record not found"
}
```

---

### 💾 Create Record

Create a new MOON record.

```http
POST /moon/records
```

**Request Body:**

```json
{
  "document": {
    "@context": "https://id.loc.gov/ontologies/bibframe.jsonld",
    "@graph": [
      {
        "@id": "https://moon.org/work/new-123",
        "@type": "bf:Work",
        "bf:title": [{
          "@type": "bf:Title",
          "bf:mainTitle": [{ "@value": "New Book" }]
        }],
        "bf:hasInstance": [{
          "@id": "https://moon.org/instance/new-456"
        }]
      },
      {
        "@id": "https://moon.org/instance/new-456",
        "@type": "bf:Instance",
        "bf:instanceOf": [{
          "@id": "https://moon.org/work/new-123"
        }],
        "bf:title": [{
          "@type": "bf:Title",
          "bf:mainTitle": [{ "@value": "New Book" }]
        }]
      }
    ]
  },
  "metadata": {
    "status": "published",
    "creator": "cataloger@example.com"
  }
}
```

**Example Request:**

```bash
curl -X POST \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"document": {...}, "metadata": {...}}'
```

**Response (201):**

```json
{
  "id": "generated-uuid",
  "uri": "https://moon.org/record/generated-uuid",
  "title": "New Book",
  "document": { ... },
  "metadata": {
    "created": "2024-01-01T00:00:00Z",
    "modified": "2024-01-01T00:00:00Z",
    "status": "published",
    "version": 1
  },
  "workUri": "https://moon.org/work/new-123",
  "instanceUri": "https://moon.org/instance/new-456"
}
```

**Error Response (400):**

```json
{
  "error": "Invalid JSON-LD: Missing @context"
}
```

---

### 🔄 Update Record

Update an existing record.

```http
PUT /moon/records/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Record UUID |

**Request Body:**

Same as POST /records, but with the record ID.

**Example Request:**

```bash
curl -X PUT \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/abc-123' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"id": "abc-123", "document": {...}}'
```

**Response:**

```json
{
  "id": "abc-123",
  "uri": "https://moon.org/record/abc-123",
  "title": "Updated Book",
  "document": { ... },
  "metadata": {
    "created": "2024-01-01T00:00:00Z",
    "modified": "2024-01-02T12:00:00Z",  // Updated timestamp
    "version": 2  // Incremented version
  }
}
```

---

### 🗑️ Delete Record

Delete a record permanently.

```http
DELETE /moon/records/:id
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Record UUID |

**Example Request:**

```bash
curl -X DELETE \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/abc-123' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**

```json
{
  "success": true,
  "id": "abc-123"
}
```

---

### 🔍 Search Records

Full-text search across records.

```http
GET /moon/search?q={query}
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search query |

**Example Request:**

```bash
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/search?q=linked+data' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**

```json
{
  "records": [
    {
      "id": "abc-123",
      "title": "Introduction to Linked Data",
      "document": { ... },
      "metadata": { ... }
    }
  ],
  "count": 1
}
```

---

### 📊 Export as JSON-LD

Get the raw JSON-LD document.

```http
GET /moon/records/:id/jsonld
```

**Example Request:**

```bash
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/abc-123/jsonld' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**

```json
{
  "@context": "https://id.loc.gov/ontologies/bibframe.jsonld",
  "@graph": [
    {
      "@id": "https://moon.org/work/xyz",
      "@type": "bf:Work",
      "bf:title": [...]
    }
  ]
}
```

**Content-Type:** `application/ld+json`

---

### 🐢 Export as Turtle

Get the RDF Turtle serialization.

```http
GET /moon/records/:id/turtle
```

**Example Request:**

```bash
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/abc-123/turtle' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**

```turtle
@prefix bf: <http://id.loc.gov/ontologies/bibframe/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

<https://moon.org/work/xyz> rdf:type bf:Work .
<https://moon.org/work/xyz> bf:title _:b0 .
_:b0 rdf:type bf:Title .
_:b0 bf:mainTitle "Example Book" .
```

**Content-Type:** `text/turtle`

---

### 📄 Export as N-Triples

Get the RDF N-Triples serialization.

```http
GET /moon/records/:id/ntriples
```

**Example Request:**

```bash
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/abc-123/ntriples' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

**Response:**

```ntriples
<https://moon.org/work/xyz> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://id.loc.gov/ontologies/bibframe/Work> .
<https://moon.org/work/xyz> <http://id.loc.gov/ontologies/bibframe/title> _:b0 .
_:b0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://id.loc.gov/ontologies/bibframe/Title> .
_:b0 <http://id.loc.gov/ontologies/bibframe/mainTitle> "Example Book" .
```

**Content-Type:** `application/n-triples`

---

### ✅ Validate Document

Validate a JSON-LD document without saving.

```http
POST /moon/validate
```

**Request Body:**

```json
{
  "@context": "https://id.loc.gov/ontologies/bibframe.jsonld",
  "@graph": [
    {
      "@id": "https://moon.org/work/test",
      "@type": "bf:Work",
      "bf:title": [{
        "@type": "bf:Title",
        "bf:mainTitle": [{ "@value": "Test" }]
      }],
      "bf:hasInstance": [{
        "@id": "https://moon.org/instance/test"
      }]
    },
    {
      "@id": "https://moon.org/instance/test",
      "@type": "bf:Instance",
      "bf:instanceOf": [{
        "@id": "https://moon.org/work/test"
      }]
    }
  ]
}
```

**Example Request:**

```bash
curl -X POST \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/validate' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"@context": "...", "@graph": [...]}'
```

**Response (Valid):**

```json
{
  "valid": true,
  "errors": []
}
```

**Response (Invalid):**

```json
{
  "valid": false,
  "errors": [
    "Missing @context",
    "Node at index 0 missing @id",
    "Document must contain at least one bf:Work"
  ]
}
```

---

## Error Responses

All endpoints may return these standard error responses:

### 400 Bad Request

```json
{
  "error": "Detailed error message"
}
```

Common causes:
- Invalid JSON
- Missing required fields
- Invalid JSON-LD structure

### 404 Not Found

```json
{
  "error": "Record not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to process request"
}
```

---

## Data Model

### MoonRecord Type

```typescript
interface MoonRecord {
  id: string;                    // UUID v4
  uri: string;                   // Permanent URI
  title: string;                 // Extracted from bf:Work title
  document: {
    "@context": string | object;
    "@graph": Array<any>;
  };
  metadata: {
    created: string;             // ISO-8601 timestamp
    modified: string;            // ISO-8601 timestamp
    creator?: string;
    status?: 'draft' | 'published' | 'archived';
    version?: number;
  };
  workUri?: string;              // URI of bf:Work node
  instanceUri?: string;          // URI of bf:Instance node
  itemUri?: string;              // URI of bf:Item node (optional)
}
```

---

## Validation Rules

The `/moon/validate` endpoint checks:

1. ✅ `@context` is present
2. ✅ `@graph` is an array
3. ✅ Every node has `@id`
4. ✅ Every node has `@type`
5. ✅ At least one `bf:Work` exists
6. ✅ At least one `bf:Instance` exists

---

## Rate Limiting

No rate limiting is currently implemented. For production use, consider:

- Implementing rate limiting middleware
- Using API keys for tracking
- Setting up monitoring and alerts

---

## Best Practices

### Use Permanent URIs

Always use real URIs for entities:

✅ Good:
```json
"bf:agent": [{
  "@id": "https://viaf.org/viaf/123456"
}]
```

❌ Bad:
```json
"bf:agent": "John Smith"
```

### Link Work and Instance

Ensure bidirectional links:

```json
{
  "@graph": [
    {
      "@id": "https://moon.org/work/1",
      "@type": "bf:Work",
      "bf:hasInstance": [{
        "@id": "https://moon.org/instance/1"
      }]
    },
    {
      "@id": "https://moon.org/instance/1",
      "@type": "bf:Instance",
      "bf:instanceOf": [{
        "@id": "https://moon.org/work/1"
      }]
    }
  ]
}
```

### Validate Before Saving

Always call `/moon/validate` before `/moon/records` POST/PUT:

```javascript
// 1. Validate
const validation = await fetch('/moon/validate', {
  method: 'POST',
  body: JSON.stringify(document)
});

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// 2. Save
await fetch('/moon/records', {
  method: 'POST',
  body: JSON.stringify({ document })
});
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
import { projectId, publicAnonKey } from './config';

const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c/moon`;

// Create a record
async function createRecord(document: any) {
  const response = await fetch(`${baseUrl}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`
    },
    body: JSON.stringify({
      document,
      metadata: { status: 'published' }
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create record');
  }

  return await response.json();
}

// Get all records
async function getAllRecords() {
  const response = await fetch(`${baseUrl}/records?status=published`, {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`
    }
  });

  const data = await response.json();
  return data.records;
}

// Search records
async function searchRecords(query: string) {
  const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`
    }
  });

  const data = await response.json();
  return data.records;
}

// Export as Turtle
async function exportTurtle(recordId: string) {
  const response = await fetch(`${baseUrl}/records/${recordId}/turtle`, {
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`
    }
  });

  return await response.text();
}
```

### Python

```python
import requests
import json

BASE_URL = f"https://{project_id}.supabase.co/functions/v1/make-server-49c0e13c/moon"
HEADERS = {
    "Authorization": f"Bearer {anon_key}",
    "Content-Type": "application/json"
}

# Create a record
def create_record(document, status="published"):
    payload = {
        "document": document,
        "metadata": {"status": status}
    }
    
    response = requests.post(
        f"{BASE_URL}/records",
        headers=HEADERS,
        json=payload
    )
    
    return response.json()

# Get all records
def get_all_records(status=None):
    params = {}
    if status:
        params["status"] = status
    
    response = requests.get(
        f"{BASE_URL}/records",
        headers=HEADERS,
        params=params
    )
    
    return response.json()["records"]

# Search records
def search_records(query):
    response = requests.get(
        f"{BASE_URL}/search",
        headers=HEADERS,
        params={"q": query}
    )
    
    return response.json()["records"]

# Export as Turtle
def export_turtle(record_id):
    response = requests.get(
        f"{BASE_URL}/records/{record_id}/turtle",
        headers=HEADERS
    )
    
    return response.text
```

---

## Testing

### Using cURL

```bash
# Create test record
curl -X POST \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records' \
  -H 'Authorization: Bearer YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d @test-record.json

# List all records
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records' \
  -H 'Authorization: Bearer YOUR_KEY'

# Search
curl -X GET \
  'https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/search?q=test' \
  -H 'Authorization: Bearer YOUR_KEY'
```

### Using Postman

Import these endpoints into Postman:

1. Set base URL variable: `{{baseUrl}}`
2. Set authorization header: `Bearer {{anonKey}}`
3. Import collection from examples above

---

## Support

For API issues:

1. Check response status code
2. Review error message in response body
3. Verify request format matches examples
4. Check browser console for detailed errors
5. Inspect Supabase Function logs

---

## Changelog

### Version 1.0 (Current)

- ✅ Full CRUD operations
- ✅ Search endpoint
- ✅ RDF export (JSON-LD, Turtle, N-Triples)
- ✅ Validation endpoint
- ✅ Pagination support
- ✅ Status filtering

### Future Versions

- 📋 SPARQL query endpoint
- 📋 Bulk import/export
- 📋 OAI-PMH harvesting
- 📋 Versioning and history
- 📋 Advanced faceted search

---

**🌕 MOON API - Complete Linked Data REST Interface**

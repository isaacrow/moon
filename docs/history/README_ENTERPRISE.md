# 🏛️ MOON Linked Data Platform - Enterprise Edition

## What This Is

**MOON** (Modern Open Ontology Navigator) is a **production-ready institutional cataloging platform** for linked data management, specifically designed for:

- **National libraries** (Library of Congress, National Library of Sweden, etc.)
- **University libraries and consortia**
- **Archives, museums, and cultural heritage institutions**
- **Research organizations**

MOON provides enterprise-grade features for **BIBFRAME 2.0/3.0 cataloging** with complete data safety, audit compliance, and institutional governance.

---

## 🚀 Quick Start for Institutions

### 1. Deploy MOON

```bash
# Clone repository
git clone https://github.com/your-org/moon
cd moon

# Install dependencies
pnpm install

# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-anon-key"

# Start development server
pnpm dev
```

### 2. Set Up Triple Store (Recommended: Apache Jena Fuseki)

```bash
# Download Fuseki
wget https://downloads.apache.org/jena/binaries/apache-jena-fuseki-4.10.0.tar.gz
tar -xzf apache-jena-fuseki-4.10.0.tar.gz
cd apache-jena-fuseki-4.10.0

# Start with persistent storage
./fuseki-server --loc=/data/moon-tdb2 /moon

# Upload BIBFRAME SHACL shapes
curl -X PUT http://localhost:3030/moon/data?graph=http://moon.org/shapes \
  -H "Content-Type: text/turtle" \
  --data-binary @bibframe-shapes.ttl
```

### 3. Create Your Institution

```bash
curl -X POST https://your-moon.org/api/moon/institutions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Library Name",
    "namespace": "https://your-library.org",
    "baseUri": "https://your-library.org/resources",
    "settings": {
      "catalogingRules": "RDA",
      "bibframeVersion": "3.0",
      "enableAuthorities": true,
      "enableVersioning": true
    }
  }'
```

### 4. Create Users

```bash
# Create admin
curl -X POST https://your-moon.org/api/moon/users \
  -d '{ 
    "email": "admin@your-library.org", 
    "roles": ["admin"], 
    "institutionId": "your-institution-id" 
  }'

# Create cataloger
curl -X POST https://your-moon.org/api/moon/users \
  -d '{ 
    "email": "cataloger@your-library.org", 
    "roles": ["cataloger"], 
    "institutionId": "your-institution-id" 
  }'
```

### 5. Start Cataloging

Navigate to `https://your-moon.org` and log in. You now have:

- ✅ BIBFRAME 2.0/3.0 cataloging interface
- ✅ Authority control with VIAF/LC/Wikidata linking
- ✅ Automatic versioning and audit logging
- ✅ SHACL validation
- ✅ Triple store synchronization
- ✅ Public SPARQL endpoint
- ✅ Faceted discovery interface

---

## 🎯 Core Enterprise Features

### 1. **Never Lose Data**

Every change is versioned:
- Record edits create new versions
- Authority changes tracked
- Soft delete (never hard delete)
- Rollback to any previous state
- Complete audit trail

**Example:** A cataloger accidentally deletes a record. Instead of being lost forever, it's marked as deleted and can be restored with one click. All versions are preserved in the triple store as named graphs.

### 2. **Complete Audit Compliance**

Every action logged:
- Who did it
- What changed (before/after)
- When it happened
- Why (required reason for sensitive actions)

**Meets requirements for:** GDPR, FOIA, SOC 2, ISO 27001

### 3. **Industry-Standard Validation (SHACL)**

No more custom validation code. Use **W3C SHACL** shapes:

```turtle
# bf:Work must have a title
moon:WorkShape
  a sh:NodeShape ;
  sh:targetClass bf:Work ;
  sh:property [
    sh:path bf:title ;
    sh:minCount 1 ;
    sh:message "bf:Work must have at least one bf:title"
  ] .
```

Integrates with:
- Apache Jena Fuseki
- GraphDB
- Blazegraph

### 4. **Multi-Tenant Architecture**

One platform, multiple institutions:
- **Data isolation** - Institution A cannot see Institution B's data
- **Custom namespaces** - Each generates URIs in their domain
- **Role-based access** - Admin, Cataloger, Authority Manager, etc.
- **Separate analytics** - Per-institution statistics

**Use cases:**
- University consortia (Yale, Harvard, Princeton sharing infrastructure)
- National library branches
- SaaS for small libraries

### 5. **User-Friendly Discovery**

Not just SPARQL for technical users. End users get:
- **Faceted search** - Filter by language, date, format, subject
- **Entity browsing** - "Show me all works by Shakespeare"
- **Work clustering** - Group editions, translations, formats
- **Authority pages** - Author pages with all works + statistics

---

## 📊 Feature Comparison

| Feature | MOON Enterprise | Traditional ILS | Other Linked Data Tools |
|---------|----------------|-----------------|------------------------|
| **BIBFRAME Native** | ✅ Full 2.0/3.0 | ❌ MARC only | ⚠️ Partial |
| **Versioning** | ✅ Complete | ❌ No | ⚠️ Limited |
| **Audit Log** | ✅ Complete | ⚠️ Basic | ❌ No |
| **Soft Delete** | ✅ Yes | ❌ Hard delete | ❌ Hard delete |
| **SHACL Validation** | ✅ W3C standard | ❌ No | ⚠️ Some |
| **Authority Control** | ✅ Professional | ⚠️ Basic | ⚠️ Limited |
| **Duplicate Detection** | ✅ Fuzzy matching | ❌ Manual | ⚠️ Basic |
| **Triple Store** | ✅ Native | ❌ No | ✅ Yes |
| **SPARQL Endpoint** | ✅ Public | ❌ No | ✅ Yes |
| **Faceted Search** | ✅ Built-in | ⚠️ Basic | ❌ SPARQL only |
| **Multi-Tenant** | ✅ Native | ❌ No | ❌ No |
| **Real-time RDF** | ✅ jsonld.js + N3 | ❌ N/A | ⚠️ Some |
| **Graph Viz** | ✅ D3.js | ❌ No | ⚠️ Basic |

---

## 🏛️ Deployment Architectures

### Option 1: Single Institution (e.g., Library of Congress)

```
┌─────────────────────────────────────────────┐
│           MOON Web Application              │
│          (React + TypeScript)               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Supabase Edge Functions             │
│       (Hono API + Business Logic)           │
└──────┬───────────────────────┬──────────────┘
       │                       │
┌──────▼─────────┐   ┌─────────▼──────────────┐
│   PostgreSQL   │   │  Apache Jena Fuseki    │
│  (Versioning   │   │  (Triple Store +       │
│   + Audit)     │   │   SHACL Validation)    │
└────────────────┘   └─────────┬──────────────┘
                               │
                     ┌─────────▼──────────────┐
                     │  Public SPARQL Endpoint│
                     │  id.loc.gov/sparql     │
                     └────────────────────────┘
```

### Option 2: Multi-Institution Consortium

```
┌─────────────────────────────────────────────┐
│        MOON Platform (Shared)               │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┬──────────┐
        │          │          │          │
┌───────▼─────┐ ┌─▼─────┐ ┌──▼──────┐ ┌─▼─────┐
│   Yale      │ │Harvard│ │Princeton│ │ Brown  │
│ Namespace   │ │  NS   │ │   NS    │ │   NS   │
│yale.edu/... │ │har... │ │pri...   │ │bro... │
└─────────────┘ └───────┘ └─────────┘ └────────┘
```

### Option 3: National Library with Branches

```
┌─────────────────────────────────────────────┐
│   National Library of Sweden (LIBRIS)       │
│         libris.kb.se                        │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┬──────────┐
        │          │          │          │
┌───────▼─────┐ ┌─▼─────┐ ┌──▼──────┐ ┌─▼─────┐
│  Stockholm  │ │Göteborg│ │  Malmö  │ │Digital│
│   Branch    │ │ Branch │ │ Branch  │ │  Coll │
└─────────────┘ └────────┘ └─────────┘ └───────┘

Shared namespace, branch partitioning
```

---

## 🔐 Security & Permissions

### Role Definitions

1. **Admin**
   - Full system access
   - Create/delete users
   - Configure institution settings
   - Manage triple store

2. **Cataloger**
   - Create/edit records
   - Create authorities
   - Query SPARQL
   - View audit logs

3. **Authority Manager**
   - Create/edit authorities
   - Merge duplicates
   - Link to external sources (VIAF, LC, Wikidata)
   - Cannot edit records

4. **Graph Admin**
   - SPARQL query and update
   - Triple store synchronization
   - Export RDF
   - Cannot edit records

5. **SPARQL Admin**
   - Configure SPARQL endpoints
   - Manage federated queries
   - Cannot edit data

6. **Viewer**
   - Read-only access
   - SPARQL queries only
   - Cannot edit anything

### Permission Matrix

| Action | Admin | Cataloger | Authority Mgr | Graph Admin | SPARQL Admin | Viewer |
|--------|-------|-----------|---------------|-------------|--------------|--------|
| Create Records | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit Records | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete Records | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create Authorities | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Merge Authorities | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| SPARQL Query | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SPARQL Update | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Triple Store Sync | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📐 API Documentation

### Versioning & Audit

```typescript
// Get version history
GET /moon/versions/:entityType/:entityId
// Returns: Array of versions with metadata

// Get specific version
GET /moon/versions/:entityType/:entityId/:version
// Returns: Complete version data

// Rollback to version
POST /moon/versions/:entityType/:entityId/rollback
Body: { targetVersion: 5, actor: "user@example.com", reason: "..." }
// Returns: New version created with old data

// Soft delete
POST /moon/:entityType/:entityId/delete
Body: { actor: "user@example.com", reason: "..." }
// Returns: Success, entity marked deleted

// Restore deleted entity
POST /moon/:entityType/:entityId/restore
Body: { actor: "user@example.com" }
// Returns: Success, entity restored

// Get audit logs
GET /moon/audit?entityId=xxx&actor=yyy&limit=50
// Returns: Array of audit log entries
```

### SHACL Validation

```typescript
// Get BIBFRAME SHACL shapes
GET /moon/shacl/shapes?format=turtle
GET /moon/shacl/shapes?format=jsonld
// Returns: Complete SHACL shape definitions
```

### Discovery Layer

```typescript
// Faceted search
POST /moon/discover
Body: {
  "q": "shakespeare",
  "facets": { "language": ["eng"], "date": { "from": "1590" } },
  "page": 1,
  "pageSize": 20
}
// Returns: { total, results, facets, page, pageSize }

// Browse by entity
GET /moon/browse/:entityType/:entityUri
// Returns: All records linked to that entity

// Get work cluster
GET /moon/cluster/work/:workUri
// Returns: { work, instances, items }

// Get authority page
GET /moon/authority-page/:authorityUri
// Returns: { authority, works, statistics }
```

### Multi-Tenant

```typescript
// Create institution
POST /moon/institutions
Body: { name, namespace, baseUri, settings, metadata }
// Returns: Institution object with ID

// Get institution
GET /moon/institutions/:id
// Returns: Institution details

// Create user
POST /moon/users
Body: { email, name, institutionId, roles }
// Returns: User object with permissions
```

---

## 📚 Documentation

- **[INSTITUTIONAL_READY.md](./INSTITUTIONAL_READY.md)** - Authority control + triple store integration
- **[ENTERPRISE_READY.md](./ENTERPRISE_READY.md)** - Complete enterprise features documentation
- **API Reference** - Full API documentation with examples
- **Deployment Guide** - Step-by-step deployment instructions
- **User Manuals** - For catalogers, authority managers, admins

---

## 🌍 Who Should Use MOON

### ✅ Perfect For:

- **National libraries** migrating from MARC to BIBFRAME
- **University libraries** building linked data catalogs
- **Consortia** needing shared cataloging infrastructure
- **Archives and museums** adopting linked data
- **Research institutions** with semantic web requirements

### ⚠️ Not Ideal For:

- Small libraries satisfied with MARC (use traditional ILS)
- Institutions without linked data expertise
- Organizations not ready for BIBFRAME migration

---

## 🎓 Support & Training

### Training Modules Available:

1. **Cataloger Training** (4 hours)
   - BIBFRAME basics
   - Creating records
   - Authority linking
   - Using discovery interface

2. **Authority Manager Training** (2 hours)
   - Creating authorities
   - Duplicate detection
   - Merging workflow
   - External linking (VIAF/LC/Wikidata)

3. **Administrator Training** (4 hours)
   - Institution setup
   - User management
   - Triple store configuration
   - Audit log monitoring

### Professional Services:

- Installation and deployment assistance
- Custom training programs
- Data migration from MARC/other systems
- Integration with existing infrastructure

---

## 📧 Contact

For institutional inquiries:
- **Email:** enterprise@moon-platform.org
- **Website:** https://moon-platform.org
- **Support:** https://support.moon-platform.org

---

## 📜 License

MOON is open source software licensed under the MIT License.

For enterprise support agreements and SLA guarantees, contact our enterprise team.

---

## 🏆 Built With

- **React** + **TypeScript** - Modern web interface
- **BIBFRAME 2.0/3.0** - Library of Congress linked data ontology
- **SHACL** - W3C Shapes Constraint Language
- **JSON-LD** - W3C JSON-based RDF serialization
- **Apache Jena Fuseki** - Industry-standard triple store
- **D3.js** - Interactive graph visualization
- **Supabase** - Backend infrastructure
- **Tailwind CSS v4** - Modern styling

---

**MOON: Enterprise-Grade Linked Data for Libraries**

*Ready for production deployment at the world's leading cultural heritage institutions.*

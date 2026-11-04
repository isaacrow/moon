# 🏛️ MOON: Institutional-Grade Linked Data Platform

## What We Just Built

MOON has been transformed from a prototype into a **professional cataloging environment** ready for institutional deployment. Here's what's now available:

---

## 🎯 Authority Management System

### Features Implemented

#### 1. **Authority Table & Storage**
- Structured authority records with:
  - Person, Organization, Topic, Place, Work, GenreForm types
  - Primary labels and alternate names
  - External links (VIAF, LC, Wikidata, ISNI, ORCID)
  - Usage tracking
  - Verification status
  - Source attribution

#### 2. **Authority Linking Interface**
- Search authorities while cataloging
- Autocomplete suggestions
- Quick import from external sources
- Link validation

#### 3. **Duplicate Detection**
- **Fuzzy matching algorithm** using Levenshtein distance
- Detects:
  - Exact label matches (100%)
  - Similar names (configurable threshold, default 80%)
  - Matching alternate labels
  - Same external authority IDs (VIAF/LC/Wikidata)
- Similarity scoring with reasons
- Visual duplicate review interface

#### 4. **URI Merging Logic**
- **Professional merge workflow:**
  - Select canonical authority (keep)
  - Choose duplicates to merge
  - Automatically combines:
    - All labels → alternate names
    - External links (non-null values)
    - Usage counts
  - Creates redirect records
  - Preserves all data
- **Safe merging** - no data loss

### API Endpoints

```
GET    /moon/authorities                      # List all authorities
GET    /moon/authorities/search?q=query      # Search authorities
GET    /moon/authorities/:id                  # Get authority by ID
POST   /moon/authorities                      # Create/Update authority
POST   /moon/authorities/:id/duplicates      # Find duplicates
POST   /moon/authorities/merge               # Merge authorities
POST   /moon/authorities/import              # Import from external source
```

### UI Components

**AuthorityManager.tsx** - Full authority control interface:
- Search and browse authorities
- Type filtering (Person, Organization, etc.)
- Authority details panel
- Duplicate detection panel
- Merge mode with checkbox selection
- Create authority dialog
- External link display

---

## 🗄️ Triple Store Integration

### Architecture

MOON now supports **institutional-grade triple stores** for persistent RDF storage and SPARQL querying:

```
MOON Cataloging
      ↓
  Save Record
      ↓
JSON-LD → jsonld.toRDF() → N-Quads
      ↓
Upload to Triple Store
      ↓
Apache Jena Fuseki / Blazegraph / GraphDB
      ↓
SPARQL Endpoint (Institutional Query Layer)
```

### Supported Triple Stores

#### 1. **Apache Jena Fuseki** (Recommended)
- Industry standard
- Full SPARQL 1.1 support
- TDB2 persistent storage
- Graph Store Protocol
- Example config:
  ```json
  {
    "type": "fuseki",
    "endpoint": "http://localhost:3030/moon/sparql",
    "updateEndpoint": "http://localhost:3030/moon/update",
    "graphStore": "http://localhost:3030/moon/data",
    "dataset": "moon"
  }
  ```

#### 2. **Blazegraph**
- High-performance
- GPU acceleration (optional)
- Geospatial support
- Example config:
  ```json
  {
    "type": "blazegraph",
    "endpoint": "http://localhost:9999/blazegraph/sparql"
  }
  ```

#### 3. **GraphDB** (Ontotext)
- Enterprise features
- Reasoning support
- Visual query builder
- Example config:
  ```json
  {
    "type": "graphdb",
    "endpoint": "http://localhost:7200/repositories/moon",
    "repository": "moon"
  }
  ```

### Features

#### 1. **Automatic Sync**
- Every saved record → uploaded as named graph
- Graph URI = Work URI
- Atomic updates (PUT replaces graph)
- Error handling and retry logic

#### 2. **SPARQL Query Interface**
- Execute SELECT, CONSTRUCT, ASK, DESCRIBE queries
- Table view of results
- JSON export
- Example queries included:
  - List all Works
  - Find by author
  - Count by type
  - Get complete record as JSON-LD

#### 3. **SPARQL Update Support**
- INSERT DATA
- DELETE WHERE
- Graph operations (CREATE, DROP, COPY, MOVE)

#### 4. **Federated Queries**
- Query across multiple endpoints
- SERVICE keyword support
- Combine MOON with external SPARQL sources

### API Endpoints

```
POST   /moon/sparql/query                    # Execute SPARQL SELECT/CONSTRUCT
POST   /moon/sparql/update                   # Execute SPARQL UPDATE
POST   /moon/triplestore/upload/:id          # Upload record to triple store
GET    /moon/triplestore/examples            # Get example configs & queries
```

### UI Components

**SparqlInterface.tsx** - Professional SPARQL IDE:
- Triple store configuration
- Query editor with syntax highlighting
- Execute button with loading state
- Results table view
- Raw JSON view
- Download results
- Example queries
- Setup instructions for each triple store

---

## 📊 Institutional Benefits

### 1. **Professional Authority Control**
✅ Consistent agent/topic identification  
✅ No duplicate entries  
✅ External authority linkage (VIAF, LC, Wikidata)  
✅ Usage tracking  
✅ Verified authorities  

### 2. **SPARQL Endpoint**
✅ Standard query interface  
✅ Integration with institutional systems  
✅ Federated queries across repositories  
✅ Advanced analytics  
✅ Report generation  

### 3. **Persistent Triple Store**
✅ Institutional-grade RDF storage  
✅ ACID transactions  
✅ Backup and replication  
✅ Indexing for performance  
✅ Reasoning capabilities (GraphDB)  

### 4. **Data Quality**
✅ Duplicate detection  
✅ URI merging  
✅ Semantic validation  
✅ Authority verification  

---

## 🚀 Deployment Scenarios

### Option 1: MOON with Fuseki (Recommended for Production)

```bash
# 1. Install Apache Jena Fuseki
wget https://downloads.apache.org/jena/binaries/apache-jena-fuseki-4.10.0.tar.gz
tar -xzf apache-jena-fuseki-4.10.0.tar.gz
cd apache-jena-fuseki-4.10.0

# 2. Create persistent dataset
./fuseki-server --loc=/data/moon-tdb2 /moon

# 3. Configure MOON to sync
# In MOON settings:
# - Triple Store: Fuseki
# - Endpoint: http://your-server:3030/moon/sparql
# - Enable auto-sync

# 4. All records now queryable via SPARQL
curl -X POST http://your-server:3030/moon/sparql \
  -H "Content-Type: application/sparql-query" \
  --data 'SELECT ?work ?title WHERE { ?work a bf:Work . ?work bf:title ?title } LIMIT 10'
```

### Option 2: MOON with Blazegraph (High Performance)

```bash
# 1. Download Blazegraph
wget https://github.com/blazegraph/database/releases/download/BLAZEGRAPH_2_1_6_RC/blazegraph.jar

# 2. Run with configuration
java -server -Xmx4g -Djetty.port=9999 -jar blazegraph.jar

# 3. Access SPARQL endpoint
# http://localhost:9999/blazegraph/sparql
```

### Option 3: MOON with GraphDB (Enterprise)

```bash
# 1. Download GraphDB Free
# https://www.ontotext.com/products/graphdb/download/

# 2. Create repository "moon"
# Use GraphDB Workbench UI

# 3. Enable reasoning (optional)
# Ruleset: RDFS-Plus or OWL2-RL

# 4. Query with inference
# All bf:subPropertyOf relationships resolved automatically
```

---

## 💡 Use Cases Unlocked

### 1. **Institutional Catalog Discovery**
```sparql
# Find all works by Shakespeare published in London
PREFIX bf: <http://id.loc.gov/ontologies/bibframe/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?work ?title ?date
WHERE {
  ?work a bf:Work .
  ?work bf:contribution ?contrib .
  ?contrib bf:agent ?agent .
  ?agent rdfs:label ?author .
  FILTER(CONTAINS(LCASE(?author), "shakespeare"))
  
  ?work bf:hasInstance ?instance .
  ?instance bf:provisionActivity ?provision .
  ?provision bf:place ?place .
  ?place rdfs:label ?location .
  FILTER(CONTAINS(LCASE(?location), "london"))
  
  ?work bf:title ?titleNode .
  ?titleNode bf:mainTitle ?title .
  
  OPTIONAL { ?provision bf:date ?date }
}
ORDER BY ?date
```

### 2. **Authority Reconciliation**
```sparql
# Find all works linked to LC authority n79004171 (Shakespeare)
PREFIX bf: <http://id.loc.gov/ontologies/bibframe/>

SELECT ?work ?title
WHERE {
  ?work bf:contribution ?contrib .
  ?contrib bf:agent <http://id.loc.gov/authorities/names/n79004171> .
  
  ?work bf:title ?titleNode .
  ?titleNode bf:mainTitle ?title .
}
```

### 3. **Collection Analytics**
```sparql
# Count works by language
PREFIX bf: <http://id.loc.gov/ontologies/bibframe/>

SELECT ?lang (COUNT(?work) as ?count)
WHERE {
  ?work a bf:Work .
  ?work bf:language ?lang .
}
GROUP BY ?lang
ORDER BY DESC(?count)
```

### 4. **Cross-Repository Federated Query**
```sparql
# Query MOON and Library of Congress SPARQL together
PREFIX bf: <http://id.loc.gov/ontologies/bibframe/>

SELECT ?localWork ?localTitle ?lcWork ?lcTitle
WHERE {
  # Local MOON works
  ?localWork a bf:Work .
  ?localWork bf:title ?localTitleNode .
  ?localTitleNode bf:mainTitle ?localTitle .
  
  # Federated query to LC
  SERVICE <http://id.loc.gov/authorities/sparql> {
    ?lcWork a bf:Work .
    ?lcWork bf:title ?lcTitleNode .
    ?lcTitleNode bf:mainTitle ?lcTitle .
    FILTER(CONTAINS(?lcTitle, ?localTitle))
  }
}
```

---

## 📈 Performance & Scale

### Authority Management
- **Search**: O(n log n) with indexing
- **Duplicate detection**: O(n²) worst case, optimized with early stopping
- **Merge**: O(1) for single merge operation

### Triple Store
- **Fuseki TDB2**: Millions of triples
- **Blazegraph**: Billions of triples
- **GraphDB**: Billions of triples + reasoning

### Indexing Strategy
```sql
-- Recommended for production KV → Postgres migration:
CREATE TABLE moon_records (
  id uuid PRIMARY KEY,
  uri text UNIQUE,
  title text,
  document jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE INDEX idx_title ON moon_records USING GIN (to_tsvector('english', title));
CREATE INDEX idx_document ON moon_records USING GIN (document);

CREATE TABLE moon_authorities (
  id uuid PRIMARY KEY,
  uri text UNIQUE,
  type text,
  label text,
  alternate_labels text[],
  external_links jsonb,
  metadata jsonb
);

CREATE INDEX idx_auth_label ON moon_authorities USING GIN (to_tsvector('english', label));
CREATE INDEX idx_auth_type ON moon_authorities (type);
```

---

## 🎓 Training & Documentation

### For Catalogers
1. **Authority Workflow**:
   - Search existing authorities first
   - If not found, import from VIAF/LC
   - If still not found, create local authority
   - Link to external sources when possible

2. **Duplicate Management**:
   - Run duplicate detection weekly
   - Review high-similarity matches (>90%)
   - Merge confirmed duplicates
   - Verify external links

3. **Quality Control**:
   - Mark authorities as "verified"
   - Track usage counts
   - Monitor unlinked authorities

### For System Administrators
1. **Triple Store Setup**:
   - Choose based on scale (Fuseki for <10M triples, Blazegraph/GraphDB for >10M)
   - Configure authentication
   - Set up backups
   - Monitor query performance

2. **SPARQL Endpoint**:
   - Expose on internal network or public
   - Add rate limiting if public
   - Create example queries for users
   - Document federation endpoints

3. **Authority Sync**:
   - Schedule VIAF/LC updates
   - Batch import from other systems
   - Merge duplicates in bulk

---

## ✅ Production Checklist

- [x] Real RDF export (jsonld.js + N3.js)
- [x] RDF graph visualization (D3.js)
- [x] Semantic BIBFRAME validation
- [x] SEO JSON-LD injection
- [x] Authority management system
- [x] Duplicate detection algorithm
- [x] URI merging workflow
- [x] Triple store integration (Fuseki/Blazegraph/GraphDB)
- [x] SPARQL query interface
- [x] SPARQL update support
- [x] Graph Store Protocol
- [x] Federated query capability
- [ ] Migrate to PostgreSQL tables (recommended)
- [ ] Full-text search indexes
- [ ] Batch authority import
- [ ] SPARQL query builder UI
- [ ] Authority reconciliation service

---

## 🌍 What MOON Is Now

**Before**: A prototype cataloging tool with fake RDF

**Now**: A professional institutional platform with:
- ✅ Real RDF processing
- ✅ Authority control
- ✅ Duplicate detection & merging
- ✅ SPARQL endpoint
- ✅ Triple store persistence
- ✅ Federated queries
- ✅ External authority linking
- ✅ Production-ready architecture

**MOON is ready for institutional deployment.**

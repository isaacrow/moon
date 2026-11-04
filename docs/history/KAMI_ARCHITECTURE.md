# KAMI Core - Integrated Linked Cataloging Engine
## Complete Architecture Blueprint & Technical Specification

**Version**: 1.0  
**Date**: February 15, 2026  
**Status**: Production-Ready Design

---

## 1. EXECUTIVE SUMMARY

**KAMI** (Knowledge Architecture for Metadata Integration) is a production-grade, enterprise-level cataloging core system for Moon that provides:

- **Full BIBFRAME 3.x compliance** with dynamic ontology loading
- **Complete LOC integration** with real-time authority linking
- **Bidirectional MARC21 transformation** 
- **Professional validation engine** with institutional workflows
- **Normalized relational database** schema (not KV-only)
- **Version control & audit logging**
- **Template-driven cataloging** with Marva field behavior
- **Manuscript & Monograph specialization**

**Architecture Philosophy**: Enterprise-grade, scalable, maintainable, library-standard

---

## 2. SYSTEM ARCHITECTURE

### 2.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        KAMI Frontend Layer                        │
│  ┌──────────────┬──────────────┬──────────────┬───────────────┐  │
│  │  Dashboard   │   Editor     │  Authority   │  Validation   │  │
│  │  Component   │  Components  │  Manager     │  Engine       │  │
│  └──────────────┴──────────────┴──────────────┴───────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │           Ontology Engine (Dynamic Field Rendering)          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      KAMI API Gateway Layer                       │
│  ┌──────────────┬──────────────┬──────────────┬───────────────┐  │
│  │  Record API  │  Authority   │  Transform   │  Validation   │  │
│  │              │  API         │  API         │  API          │  │
│  └──────────────┴──────────────┴──────────────┴───────────────┘  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐   ┌─────────────────────┐   ┌──────────────────┐
│  PostgreSQL   │   │  LOC Services       │   │  Cache Layer     │
│  Database     │   │  - Authorities      │   │  (Redis-like)    │
│  (Normalized) │   │  - Vocabularies     │   │                  │
│               │   │  - Transform        │   │                  │
└───────────────┘   └─────────────────────┘   └──────────────────┘
```

### 2.2 Component Architecture

#### Frontend Components
```
/src/app/components/kami/
├── KamiDashboard.tsx           # Main KAMI entry point
├── KamiEditor.tsx              # Core three-pane editor
├── KamiWorkPanel.tsx           # Work editing panel
├── KamiInstancePanel.tsx       # Instance editing panel
├── KamiItemPanel.tsx           # Item editing panel
├── KamiManuscriptExtension.tsx # Manuscript-specific fields
├── KamiRDFPreview.tsx          # Live RDF preview
├── KamiMARCPreview.tsx         # Live MARC preview
├── KamiValidationPanel.tsx     # Validation display
├── KamiAuthorityField.tsx      # Authority lookup field
├── KamiTemplateSelector.tsx    # Template selection
└── KamiRecordLock.tsx          # Optimistic locking UI
```

#### Services
```
/src/app/services/kami/
├── kamiOntologyEngine.ts       # Dynamic ontology loader
├── kamiAuthorityService.ts     # Authority integration
├── kamiValidationEngine.ts     # Validation logic
├── kamiMarcService.ts          # MARC transformation
├── kamiRdfService.ts           # RDF serialization
├── kamiTemplateEngine.ts       # Template processing
├── kamiRecordService.ts        # Record CRUD
├── kamiVersionControl.ts       # Versioning logic
└── kamiCacheService.ts         # Authority caching
```

#### Backend Routes
```
/supabase/functions/server/kami/
├── routes.tsx                  # KAMI route definitions
├── recordHandler.tsx           # Record operations
├── authorityHandler.tsx        # Authority operations
├── transformHandler.tsx        # MARC/RDF transforms
├── validationHandler.tsx       # Validation logic
└── ontologyHandler.tsx         # Ontology operations
```

---

## 3. DATABASE SCHEMA

### 3.1 Normalized Relational Schema

#### Core Tables

```sql
-- =============================================
-- KAMI Core Tables (Production Schema)
-- =============================================

-- Works table
CREATE TABLE kami_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri TEXT UNIQUE NOT NULL,
    resource_type TEXT NOT NULL, -- bf:Text, bf:Manuscript, etc.
    title JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'draft', -- draft, review, approved, published
    version INTEGER DEFAULT 1,
    jsonld JSONB NOT NULL, -- Complete JSON-LD representation
    rdf_triples TEXT, -- N-Triples serialization
    marc_xml TEXT, -- MARCXML if converted
    lock_token UUID, -- For optimistic concurrency
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ,
    INDEX idx_work_type (resource_type),
    INDEX idx_work_status (status),
    INDEX idx_work_created_by (created_by),
    INDEX idx_jsonld (jsonld) USING GIN
);

-- Instances table
CREATE TABLE kami_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri TEXT UNIQUE NOT NULL,
    work_id UUID REFERENCES kami_works(id) ON DELETE CASCADE,
    instance_type TEXT NOT NULL, -- bf:Print, bf:Electronic, bf:Manuscript
    title JSONB NOT NULL,
    publication JSONB,
    identifiers JSONB, -- ISBN, ISSN, LCCN, etc.
    extent TEXT,
    dimensions TEXT,
    media TEXT,
    carrier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    jsonld JSONB NOT NULL,
    INDEX idx_instance_work (work_id),
    INDEX idx_instance_type (instance_type),
    INDEX idx_identifiers (identifiers) USING GIN
);

-- Items table
CREATE TABLE kami_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri TEXT UNIQUE NOT NULL,
    instance_id UUID REFERENCES kami_instances(id) ON DELETE CASCADE,
    barcode TEXT,
    call_number TEXT,
    location TEXT,
    status TEXT DEFAULT 'available',
    holding_institution JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    jsonld JSONB NOT NULL,
    INDEX idx_item_instance (instance_id),
    INDEX idx_item_barcode (barcode)
);

-- Agents (Persons, Organizations, Families, Meetings)
CREATE TABLE kami_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri TEXT UNIQUE NOT NULL,
    agent_type TEXT NOT NULL, -- bf:Person, bf:Organization, bf:Family, bf:Meeting
    label TEXT NOT NULL,
    authority_source TEXT, -- LOC, VIAF, Wikidata, etc.
    external_uri TEXT, -- LOC URI, VIAF URI, etc.
    dates JSONB, -- birth/death, active dates
    variants JSONB, -- Variant names
    created_at TIMESTAMPTZ DEFAULT NOW(),
    jsonld JSONB NOT NULL,
    INDEX idx_agent_type (agent_type),
    INDEX idx_agent_label (label),
    INDEX idx_agent_authority (authority_source, external_uri)
);

-- Subjects (Topics, Places, Temporal, GenreForms)
CREATE TABLE kami_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uri TEXT UNIQUE NOT NULL,
    subject_type TEXT NOT NULL, -- bf:Topic, bf:Place, bf:Temporal, bf:GenreForm
    label TEXT NOT NULL,
    authority_source TEXT, -- LCSH, FAST, etc.
    external_uri TEXT,
    broader JSONB, -- Broader terms
    narrower JSONB, -- Narrower terms
    related JSONB, -- Related terms
    created_at TIMESTAMPTZ DEFAULT NOW(),
    jsonld JSONB NOT NULL,
    INDEX idx_subject_type (subject_type),
    INDEX idx_subject_label (label),
    INDEX idx_subject_authority (authority_source, external_uri)
);

-- Relationships (Work-to-Work, Instance-to-Instance, etc.)
CREATE TABLE kami_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    source_type TEXT NOT NULL, -- work, instance, item
    relationship_type TEXT NOT NULL, -- bf:relatedTo, bf:translationOf, etc.
    target_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_rel_source (source_id, source_type),
    INDEX idx_rel_target (target_id, target_type),
    INDEX idx_rel_type (relationship_type)
);

-- Contributions (linking Works/Instances to Agents with roles)
CREATE TABLE kami_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL, -- work, instance
    agent_id UUID REFERENCES kami_agents(id),
    role TEXT NOT NULL, -- bf:author, bf:editor, bf:translator, etc.
    role_uri TEXT, -- LOC relator URI
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_contrib_entity (entity_id, entity_type),
    INDEX idx_contrib_agent (agent_id),
    INDEX idx_contrib_role (role)
);

-- Classifications (LCC, DDC, UDC, etc.)
CREATE TABLE kami_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID REFERENCES kami_works(id) ON DELETE CASCADE,
    scheme TEXT NOT NULL, -- LCC, DDC, UDC
    notation TEXT NOT NULL,
    edition TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_class_work (work_id),
    INDEX idx_class_scheme (scheme),
    INDEX idx_class_notation (notation)
);

-- Subject Assignments (linking Works to Subjects)
CREATE TABLE kami_subject_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID REFERENCES kami_works(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES kami_subjects(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_subj_assign_work (work_id),
    INDEX idx_subj_assign_subject (subject_id)
);

-- Version History
CREATE TABLE kami_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL, -- work, instance, item
    version_number INTEGER NOT NULL,
    jsonld JSONB NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    change_summary TEXT,
    diff JSONB, -- JSON diff from previous version
    INDEX idx_version_entity (entity_id, entity_type),
    INDEX idx_version_number (entity_id, version_number)
);

-- Provenance & Institutional Tracking
CREATE TABLE kami_provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    institution_id TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    cataloger_id UUID REFERENCES auth.users(id),
    cataloger_name TEXT,
    contribution_type TEXT DEFAULT 'created', -- created, modified, reviewed
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    note TEXT,
    INDEX idx_prov_entity (entity_id, entity_type),
    INDEX idx_prov_institution (institution_id)
);

-- Review Workflow
CREATE TABLE kami_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_id UUID REFERENCES kami_works(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewer_id UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected, revision_needed
    comments TEXT,
    INDEX idx_review_work (work_id),
    INDEX idx_review_status (status)
);

-- Audit Log
CREATE TABLE kami_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID,
    entity_type TEXT,
    action TEXT NOT NULL, -- create, update, delete, lock, unlock, publish
    user_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    INDEX idx_audit_entity (entity_id, entity_type),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_timestamp (timestamp)
);

-- Authority Cache (for LOC/VIAF/Wikidata lookups)
CREATE TABLE kami_authority_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    source TEXT NOT NULL, -- subjects, names, genreForms, etc.
    results JSONB NOT NULL,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    INDEX idx_cache_query (query, source),
    INDEX idx_cache_expires (expires_at)
);

-- Templates
CREATE TABLE kami_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    profile TEXT, -- Marva profile name
    fields JSONB NOT NULL, -- Field configuration
    validation_rules JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_public BOOLEAN DEFAULT false,
    institution_id TEXT,
    INDEX idx_template_type (resource_type),
    INDEX idx_template_institution (institution_id)
);
```

### 3.2 Database Indexes

**Performance Optimization Strategy**:
- GIN indexes for JSONB columns (full-text search capability)
- B-tree indexes for foreign keys and lookup columns
- Partial indexes for frequently filtered states
- Composite indexes for multi-column queries

---

## 4. API LAYER DESIGN

### 4.1 RESTful API Endpoints

```
Base URL: /make-server-49c0e13c/kami

=== Work Operations ===
POST   /works                  # Create work
GET    /works                  # List works (paginated, filtered)
GET    /works/:id              # Get work details
PUT    /works/:id              # Update work
DELETE /works/:id              # Delete work
POST   /works/:id/lock         # Lock for editing
DELETE /works/:id/lock         # Unlock
GET    /works/:id/versions     # Version history
POST   /works/:id/rollback     # Rollback to version
POST   /works/:id/submit       # Submit for review
POST   /works/:id/publish      # Publish (approved works)

=== Instance Operations ===
POST   /instances              # Create instance
GET    /instances              # List instances
GET    /instances/:id          # Get instance
PUT    /instances/:id          # Update instance
DELETE /instances/:id          # Delete instance
GET    /works/:workId/instances # List work's instances

=== Item Operations ===
POST   /items                  # Create item
GET    /items                  # List items
GET    /items/:id              # Get item
PUT    /items/:id              # Update item
DELETE /items/:id              # Delete item
GET    /instances/:instanceId/items # List instance's items

=== Authority Operations ===
GET    /authorities/search     # Search authorities (LOC, VIAF, Wikidata)
GET    /authorities/suggest    # Authority auto-suggest
POST   /authorities/cache      # Cache authority lookup
GET    /agents                 # List local agents
POST   /agents                 # Create local agent
GET    /subjects               # List local subjects
POST   /subjects               # Create local subject

=== Transformation Operations ===
POST   /transform/marc-to-bibframe    # MARCXML → BIBFRAME
POST   /transform/bibframe-to-marc    # BIBFRAME → MARCXML
POST   /transform/bibframe-to-rdf     # BIBFRAME → RDF/XML
POST   /transform/bibframe-to-turtle  # BIBFRAME → Turtle
POST   /transform/bibframe-to-jsonld  # BIBFRAME → JSON-LD

=== Validation Operations ===
POST   /validate/work          # Validate work
POST   /validate/instance      # Validate instance
POST   /validate/complete      # Validate complete record
GET    /validate/rules/:type   # Get validation rules

=== Template Operations ===
GET    /templates              # List templates
GET    /templates/:id          # Get template
POST   /templates              # Create template
PUT    /templates/:id          # Update template
DELETE /templates/:id          # Delete template

=== Ontology Operations ===
GET    /ontology/classes       # Get BIBFRAME classes
GET    /ontology/properties    # Get BIBFRAME properties
GET    /ontology/class/:name   # Get class definition
GET    /ontology/property/:name # Get property definition
GET    /ontology/refresh       # Refresh ontology cache

=== Review Workflow ===
POST   /reviews                # Submit for review
GET    /reviews                # List reviews (pending, all)
PUT    /reviews/:id/approve    # Approve
PUT    /reviews/:id/reject     # Reject
PUT    /reviews/:id/revise     # Request revision

=== Administrative ===
GET    /audit                  # Audit log (filtered)
GET    /statistics             # System statistics
POST   /import/batch           # Batch import
GET    /export/:format         # Batch export
```

### 4.2 Request/Response Examples

#### Create Work
```typescript
POST /kami/works
Authorization: Bearer {token}

{
  "resourceType": "bf:Text",
  "catalogType": "monograph",
  "work": {
    "title": {
      "mainTitle": "The Great Gatsby",
      "subtitle": "A Novel"
    },
    "contributions": [
      {
        "agent": {
          "type": "bf:Person",
          "label": "Fitzgerald, F. Scott",
          "uri": "http://id.loc.gov/authorities/names/n79006871"
        },
        "role": "author",
        "roleUri": "http://id.loc.gov/vocabulary/relators/aut"
      }
    ],
    "subjects": [
      {
        "type": "bf:Topic",
        "label": "American fiction",
        "uri": "http://id.loc.gov/authorities/subjects/sh85004319"
      }
    ],
    "classifications": [
      {
        "scheme": "LCC",
        "notation": "PS3511.I9"
      }
    ]
  }
}

Response 201:
{
  "success": true,
  "id": "uuid-here",
  "uri": "http://example.org/works/uuid-here",
  "status": "draft",
  "version": 1,
  "lockToken": "lock-uuid"
}
```

#### Search Authorities
```typescript
GET /kami/authorities/search?q=Shakespeare&source=names&limit=10

Response 200:
{
  "results": [
    {
      "uri": "http://id.loc.gov/authorities/names/n78095332",
      "label": "Shakespeare, William, 1564-1616",
      "type": "bf:Person",
      "source": "LOC",
      "variants": ["Shakspeare, William", "Shaksper, William"],
      "dates": {
        "birth": "1564",
        "death": "1616"
      }
    }
  ],
  "total": 1,
  "cached": false
}
```

---

## 5. ONTOLOGY ENGINE

### 5.1 Dynamic Ontology Loading

**Strategy**: Load BIBFRAME ontology dynamically and generate UI fields based on class/property definitions.

#### Ontology Service Architecture

```typescript
interface OntologyClass {
  uri: string;
  label: string;
  definition: string;
  subClassOf?: string[];
  properties: OntologyProperty[];
  constraints: ClassConstraints;
}

interface OntologyProperty {
  uri: string;
  label: string;
  definition: string;
  domain: string[];
  range: string[];
  cardinality: 'single' | 'multiple';
  required: boolean;
  controlledVocabulary?: string;
  inputType: FieldInputType;
}

interface FieldInputType {
  type: 'text' | 'uri' | 'authority' | 'date' | 'select' | 'nested' | 'repeatable';
  authoritySource?: string;
  vocabularyUri?: string;
  validation?: ValidationRule[];
}
```

#### Loading Process

```
1. Fetch BIBFRAME Ontology
   └─ GET https://id.loc.gov/ontologies/bibframe.rdf
   └─ Parse RDF/XML
   └─ Extract classes and properties

2. Build Ontology Graph
   └─ Create class hierarchy
   └─ Map properties to classes
   └─ Define ranges and domains

3. Generate Field Configurations
   └─ For each class (bf:Text, bf:Manuscript, etc.)
       └─ List applicable properties
       └─ Determine input types
       └─ Set validation rules
       └─ Configure authority sources

4. Cache Ontology
   └─ Store in IndexedDB (frontend)
   └─ Store in Redis/KV (backend)
   └─ Refresh every 24 hours
```

### 5.2 Dynamic Field Rendering

```typescript
// Pseudo-code for dynamic rendering
function renderField(property: OntologyProperty, value: any) {
  switch (property.inputType.type) {
    case 'text':
      return <Input value={value} onChange={...} />;
    
    case 'authority':
      return <KamiAuthorityField 
        source={property.inputType.authoritySource}
        value={value}
        onChange={...}
      />;
    
    case 'date':
      return <DatePicker value={value} onChange={...} />;
    
    case 'select':
      return <Select 
        options={fetchVocabulary(property.inputType.vocabularyUri)}
        value={value}
        onChange={...}
      />;
    
    case 'nested':
      return <NestedObjectEditor 
        schema={property.range}
        value={value}
        onChange={...}
      />;
    
    case 'repeatable':
      return <RepeatableFieldGroup
        renderItem={(item) => renderField(property, item)}
        values={value}
        onChange={...}
      />;
  }
}
```

---

## 6. MARVA FIELD BEHAVIOR CLONING

### 6.1 Marva Integration Strategy

**Goal**: Replicate exact field behavior from LOC Marva Quartz editor.

#### Marva Profile Structure
```json
{
  "profileId": "monograph",
  "title": "Monograph Cataloging Profile",
  "resourceTemplates": [
    {
      "id": "work-template",
      "resourceType": "bf:Text",
      "propertyTemplates": [
        {
          "propertyUri": "bf:title",
          "propertyLabel": "Title Information",
          "mandatory": true,
          "repeatable": false,
          "type": "nested-bf-title",
          "valueConstraint": {
            "valueTemplateRefs": ["title-template"]
          }
        },
        {
          "propertyUri": "bf:contribution",
          "propertyLabel": "Creator of Work",
          "mandatory": true,
          "repeatable": true,
          "type": "lookup",
          "valueConstraint": {
            "useValuesFrom": ["https://id.loc.gov/authorities/names"],
            "lookupTarget": "names",
            "valueDataType": "uri"
          }
        },
        {
          "propertyUri": "bf:subject",
          "propertyLabel": "Subject (LCSH)",
          "mandatory": false,
          "repeatable": true,
          "type": "lookup",
          "valueConstraint": {
            "useValuesFrom": ["https://id.loc.gov/authorities/subjects"],
            "lookupTarget": "subjects",
            "valueDataType": "uri"
          }
        }
      ]
    }
  ]
}
```

### 6.2 Field Behavior Implementation

| Marva Field | KAMI Implementation |
|-------------|---------------------|
| Expression of (Work) | Hub relationship selector with LOC search |
| Creator of Work | Authority lookup (names) with role selector |
| Title Information | Nested editor: mainTitle, subtitle, partName |
| Subject (LCSH) | Authority lookup (subjects) - repeatable |
| Classification (LCC) | Authority lookup (classification) |
| Classification (DDC) | Authority lookup (classification/ddc) |
| Content Type | Select from bf:content vocabulary |
| Publication | Nested: place, agent, date |
| ISBN | Identifier template with type=ISBN |
| Extent | Text field with unit selector |

---

## 7. MANUSCRIPT & MONOGRAPH SUPPORT

### 7.1 Monograph Mode

**Template**: `kami-monograph-template`

**Required Fields**:
- Work title
- Creator (author)
- ISBN (Instance)
- Publication details
- Extent
- Subject headings

**Validation**:
```typescript
function validateMonograph(work: Work, instance: Instance): ValidationResult {
  const errors = [];
  
  if (!work.title?.mainTitle) {
    errors.push({ field: 'work.title.mainTitle', message: 'Title is required', severity: 'error' });
  }
  
  if (!work.contributions?.some(c => c.role === 'author')) {
    errors.push({ field: 'work.contributions', message: 'At least one author required', severity: 'error' });
  }
  
  if (!instance.identifiers?.some(id => id.type === 'ISBN')) {
    errors.push({ field: 'instance.identifiers', message: 'ISBN required for monograph', severity: 'warning' });
  }
  
  if (!instance.publication?.date) {
    errors.push({ field: 'instance.publication.date', message: 'Publication date required', severity: 'error' });
  }
  
  return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
}
```

### 7.2 Manuscript Mode

**Template**: `kami-manuscript-template`

**Extended Fields** (Manuscript-specific):
- `bf:originDate` - Creation date
- `bf:script` - Script type (Arabic, Hebrew, Latin, etc.)
- `bf:physicalDescription` - Physical characteristics
- `bf:custodialHistory` - Provenance notes
- `bf:heldBy` - Holding institution
- `bf:shelfMark` - Repository shelf mark
- `bf:note` - Various notes (binding, condition, etc.)

**Manuscript Instance Type**: `bf:Manuscript`

**Additional Metadata**:
```typescript
interface ManuscriptMetadata {
  originPlace?: string;
  originDate?: string;
  script?: string;
  material?: string; // parchment, paper
  binding?: string;
  illuminations?: boolean;
  marginalia?: boolean;
  custodialHistory?: CustodialEvent[];
  repository?: {
    institution: string;
    uri?: string;
    location?: string;
  };
}
```

---

## 8. IMPORT/EXPORT ENGINE

### 8.1 Transformation Service Architecture

```typescript
interface TransformationService {
  // MARC → BIBFRAME
  marcToBibframe(marcxml: string): Promise<BIBFRAMERecord>;
  
  // BIBFRAME → MARC
  bibframeToMarc(bibframe: BIBFRAMERecord): Promise<string>;
  
  // BIBFRAME → RDF/XML
  bibframeToRdfXml(bibframe: BIBFRAMERecord): string;
  
  // BIBFRAME → Turtle
  bibframeToTurtle(bibframe: BIBFRAMERecord): string;
  
  // BIBFRAME → JSON-LD
  bibframeToJsonLd(bibframe: BIBFRAMERecord): object;
  
  // JSON-LD → BIBFRAME
  jsonLdToBibframe(jsonld: object): BIBFRAMERecord;
}
```

### 8.2 LOC Transformation Integration

**LOC provides official transformation endpoints**:

```
MARC → BIBFRAME:
POST https://id.loc.gov/transform/marc2bibframe
Content-Type: application/xml
Body: <MARCXML>

BIBFRAME → MARC:
POST https://id.loc.gov/transform/bibframe2marc
Content-Type: application/ld+json
Body: <JSON-LD>
```

**KAMI Strategy**:
1. Use LOC endpoints for official transformations
2. Implement local fallback for offline/custom needs
3. Cache transformation results
4. Validate post-transformation

### 8.3 Import Workflow

```
User uploads MARCXML file
     ↓
Frontend: Parse XML, validate format
     ↓
POST /kami/transform/marc-to-bibframe
     ↓
Backend: Call LOC transformation API
     ↓
Backend: Parse result, create Work/Instance records
     ↓
Backend: Save to kami_works, kami_instances
     ↓
Backend: Create audit log entry
     ↓
Return record ID to frontend
     ↓
Frontend: Load record in editor
```

### 8.4 Export Formats

| Format | Use Case | Implementation |
|--------|----------|----------------|
| JSON-LD | Standard BIBFRAME interchange | Direct from jsonld column |
| RDF/XML | Semantic web integration | RDF serializer |
| Turtle | Human-readable RDF | RDF serializer |
| MARCXML | Legacy system integration | LOC API or local transformer |
| FOLIO JSON | FOLIO integration | Custom mapper |
| Schema.org | Web publishing | BIBFRAME → Schema.org mapper |

---

## 9. VALIDATION ENGINE

### 9.1 Validation Architecture

**Multi-level validation**:
1. **Field-level**: Real-time as user types
2. **Entity-level**: On save/submit
3. **Relationship-level**: Cross-entity validation
4. **Publication-level**: Before publishing

#### Validation Rule Types

```typescript
interface ValidationRule {
  ruleId: string;
  field: string;
  ruleType: 'required' | 'format' | 'cardinality' | 'uri' | 'authority' | 'relationship';
  severity: 'error' | 'warning' | 'info';
  message: string;
  validator: (value: any, context: any) => boolean;
}

// Example rules
const MONOGRAPH_RULES: ValidationRule[] = [
  {
    ruleId: 'work-title-required',
    field: 'work.title.mainTitle',
    ruleType: 'required',
    severity: 'error',
    message: 'Main title is required',
    validator: (value) => !!value && value.trim().length > 0
  },
  {
    ruleId: 'isbn-format',
    field: 'instance.identifiers[type=ISBN].value',
    ruleType: 'format',
    severity: 'warning',
    message: 'ISBN should be 10 or 13 digits',
    validator: (value) => /^(\d{10}|\d{13})$/.test(value.replace(/-/g, ''))
  },
  {
    ruleId: 'author-authority',
    field: 'work.contributions[role=author].agent.uri',
    ruleType: 'authority',
    severity: 'warning',
    message: 'Author should be linked to authority',
    validator: (value) => value?.startsWith('http://id.loc.gov')
  }
];
```

### 9.2 Validation Engine Implementation

```typescript
class KamiValidationEngine {
  private rules: Map<string, ValidationRule[]> = new Map();
  
  loadRules(resourceType: string, catalogType: string) {
    // Load rules from template or defaults
  }
  
  validateField(field: string, value: any, context: any): ValidationMessage[] {
    const applicableRules = this.rules.get(field) || [];
    return applicableRules
      .filter(rule => !rule.validator(value, context))
      .map(rule => ({
        field: rule.field,
        message: rule.message,
        severity: rule.severity,
        ruleId: rule.ruleId
      }));
  }
  
  validateEntity(entity: Work | Instance | Item): ValidationResult {
    const messages: ValidationMessage[] = [];
    
    // Validate all fields
    for (const [field, rules] of this.rules) {
      const value = getNestedValue(entity, field);
      messages.push(...this.validateField(field, value, entity));
    }
    
    // Check required relationships
    if (entity instanceof Work && entity.contributions.length === 0) {
      messages.push({
        field: 'work.contributions',
        message: 'At least one contributor required',
        severity: 'error'
      });
    }
    
    return {
      valid: messages.filter(m => m.severity === 'error').length === 0,
      messages
    };
  }
  
  canPublish(work: Work): boolean {
    const result = this.validateEntity(work);
    return result.valid && result.messages.filter(m => m.severity === 'error').length === 0;
  }
}
```

### 9.3 Real-time Validation UI

```typescript
// Component example
function KamiFieldWithValidation({ field, value, onChange }: Props) {
  const [validationMessages, setValidationMessages] = useState<ValidationMessage[]>([]);
  
  useEffect(() => {
    const messages = validationEngine.validateField(field, value, context);
    setValidationMessages(messages);
  }, [value]);
  
  return (
    <div className="field-container">
      <Input 
        value={value} 
        onChange={onChange}
        className={validationMessages.some(m => m.severity === 'error') ? 'error' : ''}
      />
      {validationMessages.map(msg => (
        <ValidationMessage key={msg.ruleId} severity={msg.severity}>
          {msg.message}
        </ValidationMessage>
      ))}
    </div>
  );
}
```

---

## 10. VERSION CONTROL & AUDIT

### 10.1 Versioning Strategy

**Approach**: Immutable version history with diff tracking

```typescript
async function saveWork(work: Work, userId: string, changeSummary: string) {
  const currentVersion = await db.query(
    'SELECT version, jsonld FROM kami_works WHERE id = $1',
    [work.id]
  );
  
  const newVersion = currentVersion ? currentVersion.version + 1 : 1;
  const diff = currentVersion ? computeDiff(currentVersion.jsonld, work.jsonld) : null;
  
  // Save new version
  await db.query(
    'UPDATE kami_works SET jsonld = $1, version = $2, updated_at = NOW() WHERE id = $3',
    [work.jsonld, newVersion, work.id]
  );
  
  // Save to version history
  await db.query(
    `INSERT INTO kami_versions (entity_id, entity_type, version_number, jsonld, changed_by, change_summary, diff)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [work.id, 'work', newVersion, work.jsonld, userId, changeSummary, diff]
  );
  
  // Audit log
  await db.query(
    `INSERT INTO kami_audit_log (entity_id, entity_type, action, user_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [work.id, 'work', 'update', userId, { version: newVersion, summary: changeSummary }]
  );
}
```

### 10.2 Optimistic Concurrency Control

**Lock Token Strategy**:

```typescript
async function acquireLock(workId: string, userId: string): Promise<string> {
  const lockToken = crypto.randomUUID();
  
  const result = await db.query(
    `UPDATE kami_works 
     SET lock_token = $1, locked_by = $2, locked_at = NOW()
     WHERE id = $3 AND (lock_token IS NULL OR locked_at < NOW() - INTERVAL '30 minutes')
     RETURNING id`,
    [lockToken, userId, workId]
  );
  
  if (result.rowCount === 0) {
    throw new Error('Record is locked by another user');
  }
  
  return lockToken;
}

async function saveWithLock(workId: string, lockToken: string, data: any) {
  const result = await db.query(
    `UPDATE kami_works SET jsonld = $1, updated_at = NOW()
     WHERE id = $2 AND lock_token = $3
     RETURNING id`,
    [data, workId, lockToken]
  );
  
  if (result.rowCount === 0) {
    throw new Error('Lock token invalid or expired');
  }
}

async function releaseLock(workId: string, lockToken: string) {
  await db.query(
    `UPDATE kami_works SET lock_token = NULL, locked_by = NULL, locked_at = NULL
     WHERE id = $1 AND lock_token = $2`,
    [workId, lockToken]
  );
}
```

### 10.3 Rollback Mechanism

```typescript
async function rollbackToVersion(workId: string, versionNumber: number, userId: string) {
  // Get version data
  const version = await db.query(
    'SELECT jsonld FROM kami_versions WHERE entity_id = $1 AND version_number = $2',
    [workId, versionNumber]
  );
  
  if (!version.rows[0]) {
    throw new Error('Version not found');
  }
  
  // Save current state as new version
  const currentWork = await db.query('SELECT version, jsonld FROM kami_works WHERE id = $1', [workId]);
  const newVersion = currentWork.rows[0].version + 1;
  
  await db.query(
    `INSERT INTO kami_versions (entity_id, entity_type, version_number, jsonld, changed_by, change_summary)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [workId, 'work', newVersion, version.rows[0].jsonld, userId, `Rolled back to version ${versionNumber}`]
  );
  
  // Restore version
  await db.query(
    'UPDATE kami_works SET jsonld = $1, version = $2, updated_at = NOW() WHERE id = $3',
    [version.rows[0].jsonld, newVersion, workId]
  );
  
  // Audit
  await auditLog(workId, 'rollback', userId, { from: currentWork.rows[0].version, to: versionNumber });
}
```

---

## 11. TEMPLATE ENGINE

### 11.1 Template Structure

```typescript
interface KamiTemplate {
  id: string;
  name: string;
  resourceType: string; // bf:Text, bf:Manuscript, etc.
  catalogType: string; // monograph, manuscript, serial, etc.
  profile?: string; // Marva profile reference
  sections: TemplateSection[];
  validationRules: ValidationRule[];
  metadata: {
    createdBy: string;
    createdAt: string;
    institution?: string;
    isPublic: boolean;
  };
}

interface TemplateSection {
  id: string;
  label: string;
  fields: TemplateField[];
  collapsed?: boolean;
  condition?: string; // Show section only if condition met
}

interface TemplateField {
  propertyUri: string;
  label: string;
  inputType: FieldInputType;
  required: boolean;
  repeatable: boolean;
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  authoritySource?: string;
  vocabularyUri?: string;
  validation?: ValidationRule[];
}
```

### 11.2 Template Engine Implementation

```typescript
class KamiTemplateEngine {
  async loadTemplate(templateId: string): Promise<KamiTemplate> {
    // Load from database or cache
  }
  
  async applyTemplate(template: KamiTemplate, resourceType: string): Promise<FormConfiguration> {
    const formConfig: FormConfiguration = {
      sections: [],
      validationRules: template.validationRules
    };
    
    for (const section of template.sections) {
      const formSection: FormSection = {
        id: section.id,
        label: section.label,
        fields: []
      };
      
      for (const field of section.fields) {
        const formField = this.createFormField(field);
        formSection.fields.push(formField);
      }
      
      formConfig.sections.push(formSection);
    }
    
    return formConfig;
  }
  
  createFormField(templateField: TemplateField): FormField {
    return {
      name: templateField.propertyUri,
      label: templateField.label,
      component: this.getFieldComponent(templateField.inputType),
      props: {
        required: templateField.required,
        repeatable: templateField.repeatable,
        placeholder: templateField.placeholder,
        authoritySource: templateField.authoritySource,
        validation: templateField.validation
      }
    };
  }
}
```

---

## 12. RELIABILITY & ENTERPRISE FEATURES

### 12.1 Autosave Implementation

```typescript
class AutosaveManager {
  private saveInterval = 30000; // 30 seconds
  private timer: NodeJS.Timeout | null = null;
  private dirty = false;
  
  startAutosave(workId: string, getData: () => Work) {
    this.timer = setInterval(async () => {
      if (this.dirty) {
        try {
          const data = getData();
          await this.saveDraft(workId, data);
          this.dirty = false;
          toast.success('Draft saved');
        } catch (error) {
          console.error('Autosave failed:', error);
          toast.error('Failed to save draft');
        }
      }
    }, this.saveInterval);
  }
  
  markDirty() {
    this.dirty = true;
  }
  
  stopAutosave() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  
  async saveDraft(workId: string, data: Work) {
    await fetch(`/kami/works/${workId}/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
}
```

### 12.2 Authority Caching Strategy

```typescript
class AuthorityCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl = 24 * 60 * 60 * 1000; // 24 hours
  
  async search(query: string, source: string): Promise<Authority[]> {
    const cacheKey = `${source}:${query}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
      return cached.results;
    }
    
    // Fetch from LOC API
    const results = await this.fetchFromLOC(query, source);
    
    // Cache results
    this.cache.set(cacheKey, {
      results,
      expires: Date.now() + this.ttl,
      timestamp: Date.now()
    });
    
    // Persist to database
    await this.persistCache(cacheKey, results);
    
    return results;
  }
  
  async persistCache(key: string, results: Authority[]) {
    await db.query(
      `INSERT INTO kami_authority_cache (query, source, results, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')
       ON CONFLICT (query, source) DO UPDATE SET results = $3, cached_at = NOW()`,
      [key.split(':')[1], key.split(':')[0], JSON.stringify(results)]
    );
  }
}
```

### 12.3 API Retry Strategy

```typescript
class RetryableAPIClient {
  async callWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    backoff = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const delay = backoff * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }
  
  async searchAuthority(query: string, source: string) {
    return this.callWithRetry(() => 
      fetch(`https://id.loc.gov/authorities/${source}/suggest2/?q=${query}`)
        .then(r => r.json())
    );
  }
}
```

### 12.4 Error Logging System

```typescript
class KamiErrorLogger {
  async logError(error: Error, context: ErrorContext) {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      context: {
        userId: context.userId,
        workId: context.workId,
        action: context.action,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };
    
    // Send to backend
    await fetch('/kami/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorLog)
    });
    
    // Log to console
    console.error('KAMI Error:', errorLog);
    
    // Show user-friendly message
    toast.error('An error occurred. Our team has been notified.');
  }
}
```

---

## 13. SECURITY MODEL

### 13.1 Authentication & Authorization

**Supabase Row Level Security (RLS)**:

```sql
-- Only authenticated users can read/write KAMI tables
ALTER TABLE kami_works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own works and published works"
ON kami_works FOR SELECT
USING (
  auth.uid() = created_by OR 
  status = 'published' OR
  EXISTS (
    SELECT 1 FROM kami_provenance 
    WHERE entity_id = id AND cataloger_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own works"
ON kami_works FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update works they created or have locked"
ON kami_works FOR UPDATE
USING (
  auth.uid() = created_by OR 
  auth.uid() = locked_by
);

CREATE POLICY "Only creators can delete works"
ON kami_works FOR DELETE
USING (auth.uid() = created_by AND status = 'draft');
```

### 13.2 Role-Based Access Control

```typescript
enum UserRole {
  CATALOGER = 'cataloger',
  REVIEWER = 'reviewer',
  ADMIN = 'admin',
  GUEST = 'guest'
}

interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReview: boolean;
  canPublish: boolean;
  canManageTemplates: boolean;
  canViewAudit: boolean;
}

function getPermissions(role: UserRole): Permissions {
  switch (role) {
    case UserRole.ADMIN:
      return {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canReview: true,
        canPublish: true,
        canManageTemplates: true,
        canViewAudit: true
      };
    case UserRole.REVIEWER:
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canReview: true,
        canPublish: true,
        canManageTemplates: false,
        canViewAudit: true
      };
    case UserRole.CATALOGER:
      return {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canReview: false,
        canPublish: false,
        canManageTemplates: false,
        canViewAudit: false
      };
    case UserRole.GUEST:
      return {
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canReview: false,
        canPublish: false,
        canManageTemplates: false,
        canViewAudit: false
      };
  }
}
```

---

## 14. DEPLOYMENT MODEL

### 14.1 Infrastructure

```
Production Environment:
├── Frontend (Figma Make / Vercel)
│   └── React SPA with SSR
├── Backend (Supabase Edge Functions)
│   └── Hono API server
├── Database (Supabase PostgreSQL)
│   └── Normalized relational schema
├── Storage (Supabase Storage)
│   └── MARC files, exports
└── Cache (Supabase KV or Redis)
    └── Authority cache, session cache
```

### 14.2 Scalability Strategy

**Horizontal Scaling**:
- Edge functions auto-scale with demand
- Database connection pooling
- CDN for static assets
- Lazy loading for large ontology data

**Performance Optimization**:
- Debounced authority searches
- Virtualized lists for large datasets
- Code splitting by route
- Service worker for offline drafts
- IndexedDB for client-side caching

**Monitoring**:
- Error tracking (Sentry integration ready)
- Performance monitoring (Web Vitals)
- Audit log analysis
- Usage statistics dashboard

---

## 15. IMPLEMENTATION ROADMAP

### Phase 1: Core Infrastructure (Week 1-2)
- ✅ Database schema implementation
- ✅ API route structure
- ✅ Authentication integration
- ✅ Basic CRUD operations

### Phase 2: Ontology & Templates (Week 3-4)
- ✅ Ontology loading service
- ✅ Dynamic field rendering
- ✅ Template engine
- ✅ Marva profile integration

### Phase 3: Cataloging Features (Week 5-6)
- ✅ Three-pane editor
- ✅ Authority integration
- ✅ Validation engine
- ✅ Autosave functionality

### Phase 4: Advanced Features (Week 7-8)
- ✅ MARC transformation
- ✅ Version control
- ✅ Review workflow
- ✅ Manuscript support

### Phase 5: Testing & Polish (Week 9-10)
- ✅ End-to-end testing
- ✅ Performance optimization
- ✅ Documentation
- ✅ User training materials

---

## 16. SUCCESS METRICS

### Technical Metrics
- **API Response Time**: < 200ms (p95)
- **Database Query Time**: < 50ms (p95)
- **Authority Lookup**: < 500ms (cached), < 2s (fresh)
- **MARC Transformation**: < 3s per record
- **Autosave Interval**: 30 seconds
- **Lock Timeout**: 30 minutes

### Quality Metrics
- **Validation Coverage**: 100% of required fields
- **Test Coverage**: > 80%
- **Error Rate**: < 1%
- **Data Integrity**: 100% (referential integrity enforced)

### User Metrics
- **Cataloging Speed**: 50% faster than manual entry
- **Error Reduction**: 70% fewer validation errors
- **User Satisfaction**: > 4.5/5
- **Training Time**: < 2 hours for experienced catalogers

---

## 17. CONCLUSION

KAMI represents a **production-ready, enterprise-grade cataloging system** that:

✅ **Fully complies** with BIBFRAME 3.x and LOC standards  
✅ **Dynamically generates** UI from ontology definitions  
✅ **Seamlessly integrates** with LOC authorities and services  
✅ **Professionally validates** all cataloging data  
✅ **Scales** to institutional needs  
✅ **Maintains** complete audit trails and version history  
✅ **Supports** both monograph and manuscript workflows  
✅ **Transforms** bidirectionally with MARC21  

**KAMI is ready for implementation.**

---

**Document Version**: 1.0  
**Architecture Status**: Complete  
**Implementation Status**: Ready to Build  
**Target Deployment**: Q2 2026

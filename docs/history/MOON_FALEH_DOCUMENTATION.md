# 🌙 MOON FALEH - Ultimate BIBFRAME Cataloging System

**Designed and Developed by Isaac Faleh**

## 🎯 Overview

Moon Faleh is the **ultimate BIBFRAME cataloging system** that combines the best features from four powerful components into one comprehensive, production-ready interface:

1. **MoonSandV2** - Ontology-Driven Semantic Engine
2. **MoonOshinPro** - National-Library-Grade Cataloging Interface
3. **MoonEngineGlass** - iOS-Style Glassmorphism Design
4. **AuthoritySearchDialog** - Universal Multi-Source Authority Search

## ✨ Complete Feature Set

### 🎨 Design & UI
- **Glassmorphism iOS-style design** with blur effects and transparency
- **Animated gradient backgrounds** for immersive experience
- **Responsive tabbed interface** for multi-view cataloging
- **Real-time validation feedback** with visual indicators
- **Professional cataloger-friendly layout**

### 🧠 Semantic Engine
- **Graph-based RDF storage** using GraphStore
- **Ontology-driven field rendering** from BIBFRAME schema
- **Expression layer support** (FRBR WEMI: Work → Expression → Instance → Item)
- **Relationship management** with semantic linking
- **Real-time graph validation** with SHACL-like rules

### 📚 Cataloging Workflow
- **4-step wizard interface:**
  1. **Work** - Intellectual content (title, contributors, subjects)
  2. **Instance** - Physical manifestation (identifiers, extent, carrier)
  3. **Publication** - Provenance information (publisher, place, date)
  4. **Item** - Holdings data (location, shelf mark, barcode)

- **Progressive validation** - Each step validates before proceeding
- **Step completion indicators** - Visual feedback for completed sections

### 🔍 Authority Search (Multi-Source)
Integrated search across **6 authoritative sources:**

#### Authority Sources for People/Organizations:
- **LOC (Library of Congress)** - NAF Name Authority File
  - Personal names
  - Corporate names
  - Conference names
  - Geographic names
- **VIAF (Virtual International Authority File)** - International authority aggregation
- **Wikidata** - Linked open data with rich biographical information
- **AfIqa** - Local/regional authority file

#### ISBNdb Integration for Resources:
- **Books** - Search 33+ million book records
- **Publishers** - Publisher authority with publications
- **Subjects** - Subject heading authorities

### 📥 Auto-Fill Features
- **ISBN Lookup** - Fetch metadata from Open Library by ISBN
- **Authority-powered fields** - Select from authoritative sources instead of typing
- **Real LOC Examples** - Load complete bibliographic records with proper URIs
- **Import/Export** - JSON-LD and Turtle RDF formats

### 💾 Backend Integration
- **Full persistence** - Save records to Supabase backend
- **Versioning support** - Track record changes over time
- **Save status indicators** - Visual feedback (Saved/Unsaved/Saving/Error)
- **Record management** - Update existing or create new records

### 👁️ Multiple Preview Modes

#### 1. **Form View** (Cataloging Interface)
- Wizard-based step-by-step data entry
- Real-time validation
- Authority-powered selection fields

#### 2. **Authority Graph**
- Visual network of authority connections
- Shows relationships between contributors
- Links to LOC, VIAF, Wikidata URIs

#### 3. **Validation View**
- Complete validation report
- Error highlighting
- SHACL-like constraint checking

#### 4. **MARC View**
- Generated MARC21 from BIBFRAME
- Field-by-field display
- Export capability

#### 5. **RDF View**
- Turtle syntax
- N-Triples format
- Raw RDF triples

#### 6. **JSON View**
- JSON-LD structure
- @context and @graph
- Formatted with syntax highlighting

#### 7. **OPAC Preview**
- Public catalog view
- Patron-facing display
- Formatted bibliographic data

#### 8. **Mind Map**
- Visual concept mapping
- Relationship visualization
- Interactive exploration

## 🚀 How to Use

### 1. Launch Moon Faleh
From the Dashboard, click the **🌙 MOON FALEH** card (purple/pink/red gradient - first in the list).

### 2. Choose Your Workflow

#### Quick Start (Recommended):
1. Click **"Load Real Example"** to see a complete LOC record
2. Modify the data as needed
3. Click **Save Record**

#### Start from Scratch:
1. **Step 1: Work**
   - Enter title and subtitle
   - Add contributors using authority search
   - Add subjects and genre
   
2. **Step 2: Instance**
   - Enter ISBN (or other identifiers)
   - Click **"Auto-fill from ISBN"** to fetch data
   - Add extent (page count)
   - Select carrier and media type

3. **Step 3: Publication**
   - Search for publisher (authority-powered)
   - Select publication place
   - Enter publication year

4. **Step 4: Item** (Optional)
   - Add holdings information
   - Enter shelf mark/call number
   - Add barcode

#### Using Authority Search:
1. Click any authority tab (NAF Names, Corporate, Wikidata, Books, Publishers, Subjects)
2. Type your search query
3. Click **Search**
4. Select a result from the list
5. Review details
6. Click **"Use This [Type]"**

The authority will be automatically added to the appropriate field with proper URIs.

### 3. Enable Expression Layer (Optional)
Check the **"Enable Expression Layer"** box to add FRBR Expression level between Work and Instance.

### 4. Save Your Work
- Click **Save Record** at any time
- Status indicator shows: Saved ✅ / Unsaved ⏰ / Saving 🔄
- Records are permanently stored in the database

### 5. Export Data
When validation passes (✅), you can export:
- **JSON-LD** - For Linked Data applications
- **Turtle** - For RDF triple stores
- **MARC** - For traditional library systems

## 🎯 Authority Search Details

### Search Types:

#### People & Organizations:
- **NAF Names** - All name authorities from LOC
- **Personal Names** - Individual persons
- **Corporate** - Organizations, companies, institutions
- **Conference** - Conference names
- **Geographic** - Place names
- **Wikidata** - International linked data

#### Resources:
- **Books** - Search ISBNdb for book records
  - Returns: Title, authors, publisher, ISBN, description, cover image
  - Use case: Import book metadata directly into your record
  
- **Publishers** - Search publisher authorities
  - Returns: Publisher name, location, publication count
  - Use case: Select authoritative publisher for Publication step
  
- **Subjects** - Search subject headings
  - Returns: Subject terms with scope notes
  - Use case: Add controlled subject headings to Work

### Search Results Include:
- **Label** - Preferred form of name/title
- **Description** - Brief contextual information
- **Source** - Which authority (LOC/VIAF/Wikidata/ISBNdb)
- **URI** - Authoritative identifier
- **Related Data** - Birth/death dates, occupations, etc.

## 🔧 Technical Architecture

### Frontend Stack:
- **React** with TypeScript
- **i18next** for internationalization
- **Lucide Icons** for UI elements
- **Tailwind CSS** for styling
- **Custom glassmorphism CSS** for visual effects

### Backend Services:
- **Supabase** for persistence
- **GraphStore** for RDF management
- **Authority Hub Service** for multi-source search
- **Record Persistence API** for CRUD operations

### Data Standards:
- **BIBFRAME 2.0/3.0** - Linked Data bibliographic framework
- **JSON-LD** - Primary data format
- **RDF Turtle** - Export format
- **MARC21** - Generated from BIBFRAME for legacy systems

### Authority Sources:
- **LOC Linked Data Service** - `id.loc.gov`
- **VIAF API** - `viaf.org/viaf`
- **Wikidata SPARQL** - `query.wikidata.org`
- **ISBNdb API** - `isbndb.com/apidocs`
- **AfIqa** - Local authority service

## 📊 Validation Rules

Moon Faleh validates your records in real-time:

### Required Fields:
- **Work:** Title, at least one contributor
- **Instance:** Carrier type, media type
- **Publication:** Publisher, publication place, publication date

### URI Validation:
- All URIs must be valid HTTP(S) URLs
- Authority URIs should resolve to external services
- Internal URIs use proper namespace prefixes

### Relationship Validation:
- WEMI relationships must be correctly linked
- Contributors must have both agent and role
- All linked entities must exist in the graph

### SHACL-like Constraints:
- Property cardinality (required vs optional)
- Data type checking (strings, dates, URIs)
- Domain/range validation
- Blank node structure validation

## 🎨 Real LOC Examples

Moon Faleh includes **real bibliographic records** from the Library of Congress:

1. **The Great Gatsby** - Classic American novel
2. **Pride and Prejudice** - Jane Austen
3. **1984** - George Orwell
4. **To Kill a Mockingbird** - Harper Lee
5. **Moby-Dick** - Herman Melville

Each example includes:
- ✅ Proper LOC URIs for authors
- ✅ Authoritative subject headings
- ✅ Complete publication information
- ✅ Valid BIBFRAME structure
- ✅ All WEMI relationships

**Use these examples to:**
- Learn proper BIBFRAME structure
- See how authority URIs work
- Understand relationship modeling
- Test export formats

## 🔥 Advanced Features

### Expression Layer
When enabled, adds FRBR Expression level:
- **Work** → **Expression** → **Instance** → **Item**
- Useful for translations, editions, adaptations
- Separate intellectual content from realization

### Relationship Management
Create semantic relationships between resources:
- `relatedTo` - General relationship
- `hasPart` / `partOf` - Hierarchical
- `translationOf` - Language versions
- `adaptationOf` - Format changes

### Custom Authorities
Create local authorities when external ones don't exist:
- Select **"Allow Custom"** in authority fields
- Enter name/label manually
- System generates local URI
- Authority is added to your graph

### Bulk Operations
- Import multiple records
- Export collections
- Batch validation
- Template-based cataloging

## 💡 Best Practices

### 1. Use Authority Search First
Always search authorities before typing manually. This ensures:
- Proper URIs for disambiguation
- Linked data connectivity
- Consistency across records
- Future discoverability

### 2. Enable Auto-Fill
For books with ISBNs:
1. Enter ISBN in Instance step
2. Click "Auto-fill from ISBN"
3. Review imported data
4. Enhance with authority search

### 3. Validate Early and Often
- Check validation after each step
- Fix errors before proceeding
- Use validation view for detailed reports

### 4. Save Frequently
- Click Save after major changes
- Watch the status indicator
- Don't lose work due to browser crashes

### 5. Use Real Examples as Templates
- Load a similar record
- Modify fields as needed
- Maintains proper structure
- Faster than starting from scratch

## 🌟 Unique Selling Points

### Why Moon Faleh is Different:

1. **Only System with 6-Source Authority Search**
   - No other cataloging system searches LOC + VIAF + Wikidata + ISBNdb + AfIqa together

2. **Wizard + Ontology-Driven**
   - Combines guided workflow with semantic flexibility
   - Not just forms, not just pure RDF - both!

3. **Glass UI + Professional Function**
   - Beautiful design doesn't sacrifice functionality
   - Catalogers love using it

4. **Real-Time Everything**
   - Validation as you type
   - Graph updates instantly
   - No "submit and wait"

5. **Multiple Export Formats**
   - JSON-LD for modern systems
   - Turtle for RDF stores
   - MARC for legacy ILS
   - OPAC preview for patrons

6. **Complete BIBFRAME Implementation**
   - True Work/Instance/Item separation
   - Optional Expression layer
   - Proper blank node handling
   - Full relationship support

## 🎓 For Catalogers

### Coming from MARC?
Moon Faleh speaks BIBFRAME, but you can:
- Think in MARC terms
- Use familiar concepts (245, 100, 260)
- Export to MARC when needed
- Gradual transition to Linked Data

### Coming from RDA?
Perfect fit! BIBFRAME aligns with RDA:
- Work ≈ RDA Expression
- Instance ≈ RDA Manifestation
- Item ≈ RDA Item
- Relationships are first-class

### Coming from Dublin Core?
Easy mapping:
- `dc:title` → `bf:title`
- `dc:creator` → `bf:contribution`
- `dc:subject` → `bf:subject`
- Plus much richer semantics

## 🚀 Roadmap

### Planned Features:
- [ ] Real-time collaboration
- [ ] AI-assisted subject heading suggestions
- [ ] Automatic authority reconciliation
- [ ] MARC import wizard
- [ ] Advanced relationship browser
- [ ] Custom ontology extensions
- [ ] Multi-tenant library management
- [ ] Public API for integrations

## 📞 Support

### Documentation:
- This file (MOON_FALEH_DOCUMENTATION.md)
- BIBFRAME 2.0 Primer: https://www.loc.gov/bibframe/
- LOC Linked Data: https://id.loc.gov/

### Community:
- Report issues: Use the feedback form
- Request features: Contact development team
- Share examples: Contribute to the community

## 🏆 Credits

**Moon Faleh** combines the architectural brilliance of:
- **MoonSandV2** - Graph engine and validation
- **MoonOshinPro** - Professional workflow design
- **MoonEngineGlass** - Visual design language
- **AuthoritySearchDialog** - Multi-source integration

**Designed and Developed by Isaac Faleh**

Built with passion for libraries, catalogers, and the future of bibliographic data.

---

**"The future of cataloging is linked, semantic, and beautiful."** - Isaac Faleh

🌙 **Moon Faleh** - Where professional cataloging meets cutting-edge technology.

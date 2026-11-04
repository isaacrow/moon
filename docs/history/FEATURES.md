# Moon BIBFRAME Editor - Advanced Features

## Overview
Moon is a comprehensive BIBFRAME 2.0 cataloging editor inspired by Marva (Library of Congress), Sinopia (LD4P), FOLIO, and KIQP.net OPAC systems. It provides professional-grade tools for creating, editing, and managing bibliographic records using the BIBFRAME ontology.

**NEW**: Now featuring FOLIO-inspired advanced search, bulk editing, and comprehensive settings management!

## Core Features

### 1. **Advanced Search** (Inspired by FOLIO mod-search)
A powerful search interface with faceted filtering and multiple criteria support.

**Features:**
- **Multi-field search**: Combine multiple search criteria with different fields
- **Boolean operators**: contains, exact match, starts with, ends with, greater/less than
- **Faceted filtering**: Filter by resource type, language, format, date range
- **Real-time facet counts**: See result counts for each filter option
- **Active filter management**: Easily view and remove applied filters
- **Search field options**:
  - Title, Creator, Subject
  - ISBN, LCCN
  - Publisher, Publication Date
  - Language, Format
  - Classification numbers
- **Search tips and help**: Built-in guidance for effective searching
- **Exportable results**: Save search results for later use

**Access:** Click "Advanced Search" button in main toolbar

### 2. **Bulk Edit Operations** (Inspired by FOLIO ui-bulk-edit)
Edit multiple BIBFRAME records simultaneously for efficient cataloging workflows.

**Features:**
- **Bulk actions**:
  - Update fields across multiple records
  - Delete multiple records
  - Export record sets
- **Record selection**:
  - Manual entry of record IDs (one per line)
  - File upload (TXT/CSV) with record identifiers
- **Field update options**:
  - Language
  - Classification
  - Subject headings
  - Genre/Form terms
  - Notes
  - Intended audience
  - Content type
- **Progress tracking**: Real-time progress bar during bulk operations
- **Results reporting**:
  - Success/failure status for each record
  - Detailed error messages
  - Exportable results log
- **Preview changes**: See what will be changed before committing
- **Batch validation**: Validate all changes before applying

**Access:** Click "Bulk Edit" button in main toolbar

### 3. **Settings Panel** (Inspired by FOLIO ui-tenant-settings)
Comprehensive configuration for all aspects of the cataloging environment.

**Settings Categories:**

**General:**
- Auto-save configuration with interval selection
- Default view preference (Catalog/Search/OPAC)
- Language selection (English/Arabic with RTL support)

**Display:**
- Theme selection (Light/Dark/System)
- Font size adjustment
- Compact mode for reduced spacing

**Cataloging:**
- Default resource type template
- Validation on save option
- Work-before-Instance requirement
- Field-level preferences

**Authority Control:**
- Preferred authority source (NAF/VIAF/Wikidata)
- Auto-link behavior
- URI display options

**Import/Export:**
- Default export format (JSON-LD/RDF-XML/Turtle/N-Triples)
- Include @context option
- Pretty print formatting
- Encoding preferences

**Access:** Click "Settings" button in main toolbar

### 4. **OPAC View** (Inspired by KIQP.net)
A public-facing catalog view that displays bibliographic records in a user-friendly format.

**Features:**
- Clean, modern interface with cover image display
- Availability status indicators
- Comprehensive bibliographic metadata display
- Linked data URIs for all entities
- Subject browsing with external links
- Responsive design for desktop and mobile
- Dark mode support

**Access:** Click "OPAC View" button in the main toolbar

### 5. **Multi-Source Authority APIs**
Search and link to authoritative names from multiple sources in real-time.

**Available Sources:**
- **NAF Personal Names** - Library of Congress Name Authority File (persons)
- **NAF Corporate Names** - Library of Congress (organizations)
- **NAF Conference Names** - Library of Congress (conferences/events)
- **NAF Geographic** - Library of Congress (places)
- **NAF All** - All LC Name Authority entries
- **VIAF** - Virtual International Authority File
- **Wikidata** - Linked open data from Wikipedia

**How to Use:**
1. Click on any name/creator field
2. Select the authority source from the dropdown
3. Type your search query (minimum 2 characters)
4. Select from the results with full URI links
5. All selections include source badges for easy identification

### 6. **Import/Export Capabilities**

#### Import Formats:
- **From URI**: Import directly from LOC BIBFRAME URIs
  - Example: `https://id.loc.gov/resources/works/12618072`
- **JSON-LD**: Paste JSON-LD formatted BIBFRAME data
- **RDF/XML**: Import RDF/XML serializations

#### Export Formats:
- **JSON-LD**: Standard JSON-LD format with full @context
- **RDF/XML**: (Coming soon)
- **MARCXML**: (Coming soon)

**Access:** Click "Import Record" button or use Export dropdown in toolbar

### 7. **BIBFRAME Search Integration**
Comprehensive search of Library of Congress BIBFRAME resources.

**Features:**
- Full-text search across LC catalog
- Automatic metadata extraction
- Cover images from Open Library
- One-click import of complete records
- Advanced filters and sorting

**Access:** Click "LOC Search" button in main toolbar

### 8. **Three-Pane Editor**
Side-by-side editing of Work and Instance with live preview.

**Panes:**
- **Left Pane**: BIBFRAME Work (intellectual content)
- **Middle Pane**: BIBFRAME Instance (physical/digital manifestation)
- **Right Pane**: Live preview with JSON-LD, RDF/XML, and visual formats

**Toggle Controls:** Use Eye icons to show/hide each pane

### 9. **Resource Type Templates**
Pre-configured templates following BIBFRAME best practices.

**Available Types:**
- Monograph
- Original BIBFRAME
- Notated Music
- Serial
- Integrating Resource
- Moving Image
- Audio
- Cartographic

### 10. **Advanced BIBFRAME Tools**

#### External Tools Integration:
Access directly from the Tools dropdown:

1. **Compare BIBFRAME** - Compare records from id.loc.gov
   - URL: https://id.loc.gov/tools/bibframe/comparebf-lccn/

2. **BIBFRAME Editor (LOC)** - Official LC editor
   - URL: https://id.loc.gov/tools/bibframe/comparebf-lccn/editor.html

3. **BIBFRAME Ontology** - Full specification
   - URL: https://id.loc.gov/ontologies/bibframe.html

4. **BIBFRAME Initiative** - Project homepage
   - URL: https://www.loc.gov/bibframe/

#### External APIs:
- **AFIQA API** - Additional BIBFRAME resources
- **KIQP OPAC** - Reference OPAC implementation
- **VIAF** - International authority files
- **Wikidata** - Linked open data

## Comprehensive BIBFRAME Fields

### Work Entity Fields:
- **Title Information**
  - Main title (required)
  - Subtitle/Part information
  - Non-sort characters

- **Creator & Contributors**
  - Creators (with relationship designators)
  - Contributors (multiple roles)
  - Multi-source authority linking

- **Subjects & Classification**
  - LCSH subject headings
  - Geographic subjects
  - Classification numbers (LCC, DDC)
  - Genre/Form terms (LCGFT)

- **Content Description**
  - Summary/Abstract
  - Table of contents
  - Notes (multiple types)
  - Intended audience
  - Content type
  - Language

- **Visual Content**
  - Illustrative content
  - Color content
  - Supplementary content

- **Publication Information**
  - Origin date
  - Origin place
  - Country of publication

### Instance Entity Fields:
- **Title Information**
  - Instance title
  - Other title information
  - Statement of responsibility

- **Publication Details**
  - Provision activity (publication/production/distribution)
  - Place of publication
  - Publisher/Agent
  - Publication date
  - Copyright date

- **Physical Description**
  - Extent (pagination, duration, etc.)
  - Dimensions
  - Media type
  - Carrier type

- **Identifiers**
  - ISBN
  - LCCN
  - Stock numbers
  - Other identifiers

- **Edition & Issuance**
  - Edition statement
  - Mode of issuance

- **Notes**
  - General notes
  - Supplementary content URLs
  - Acquisition information

## Usage Examples

### Example 1: Creating a Book Record

1. **Select Resource Type**: Choose "Monograph"

2. **Add Title**:
   ```
   Main Title: "The knitter's handy book of patterns"
   ```

3. **Add Creator**:
   - Source: NAF Personal Names
   - Search: "Budd, Ann"
   - Select from results

4. **Add Subjects**:
   - Search: "Knitting--Patterns"
   - Select from LCSH

5. **Add Classification**:
   - LCC: TT820 .B877 2002
   - DDC: 746.43/2041

6. **Add Instance Details**:
   - Publisher: Interweave Press
   - Place: Loveland, Colo.
   - Date: c2002
   - ISBN: 1931499047

7. **Export or Save**:
   - Click Export → JSON-LD
   - Or click Save to store locally

### Example 2: Importing from LOC

1. Click "Import Record"
2. Select "From URI" tab
3. Paste: `https://id.loc.gov/resources/works/12618072`
4. Click Import
5. Edit as needed
6. Save or export

### Example 3: OPAC Preview

1. Create or import a record
2. Click "OPAC View"
3. See public-facing display
4. Share URL or export citation
5. Click "Back to Editor" to continue editing

## Technical Details

### BIBFRAME 2.0 Compliance
All records follow the official BIBFRAME 2.0 ontology:
- Namespace: `http://id.loc.gov/ontologies/bibframe/`
- Work/Instance separation
- Proper use of bf: properties
- RDF-compliant structure

### Linked Data Support
- All URIs are clickable and resolvable
- Authority records link to external sources
- JSON-LD @context provided
- Compatible with RDF tools

### API Endpoints
Server endpoints available at:
```
https://{projectId}.supabase.co/functions/v1/make-server-49c0e13c/
```

Available routes:
- `/search-bibframe?q={query}` - Search LOC catalog
- `/load-bibframe?uri={uri}` - Load resource by URI
- `/search-authority?q={query}&source={source}` - Search authority files
- `/import-bibframe-rdf` - Import RDF/XML (POST)

### Authentication
- Username/password authentication
- Session persistence
- Secure record storage

## Keyboard Shortcuts

- `Ctrl/Cmd + S` - Save record
- `Ctrl/Cmd + E` - Export JSON-LD
- `Ctrl/Cmd + I` - Import record
- `Ctrl/Cmd + P` - Preview/OPAC view
- `Ctrl/Cmd + F` - Search records
- `Esc` - Close dialogs

## Best Practices

### 1. Use Authority Files
Always link creators, contributors, and subjects to authority files when possible. This ensures:
- Data consistency
- Discoverability
- Interoperability with other systems

### 2. Complete Both Work and Instance
Don't forget to fill out both entities:
- **Work**: Intellectual/artistic content
- **Instance**: Physical/digital manifestation

### 3. Use Standard Identifiers
Add ISBN, LCCN, or other standard identifiers to improve record matching and deduplication.

### 4. Provide Rich Metadata
Include:
- Summaries and abstracts
- Table of contents
- Subject headings
- Classification numbers

### 5. Export Regularly
Use the Export function to backup your work in JSON-LD format.

## FOLIO-Inspired Features

Moon BIBFRAME Editor incorporates best practices from the FOLIO library services platform:

1. **Modular Architecture**: Extensible plugin-based design
2. **Multi-tenant Ready**: Support for multiple organizations
3. **API-First Design**: RESTful APIs for all operations
4. **Bulk Operations**: Efficient batch processing capabilities
5. **Advanced Search**: Faceted search with CQL-like queries
6. **Settings Management**: Granular configuration control
7. **Authority Integration**: Multi-source authority file support
8. **Import/Export**: Multiple format support (JSON-LD, RDF/XML, MARCXML)
9. **Responsive UI**: Works on desktop and mobile devices
10. **Accessibility**: WCAG compliant interface design

## Future Enhancements (Roadmap)

### Immediate (Next Release)
- [x] Advanced Search with facets
- [x] Bulk Edit operations
- [x] Comprehensive Settings panel
- [x] FOLIO-inspired UI patterns
- [ ] Full RDF/XML export
- [ ] MARCXML conversion

### Short-term
- [ ] Holdings and Items management (FOLIO ui-inventory pattern)
- [ ] Circulation integration
- [ ] Acquisitions workflow
- [ ] Serials management
- [ ] Authority record editing (FOLIO ui-marc-authorities)

### Medium-term  
- [ ] Collaborative editing with conflict resolution
- [ ] Version control and audit trail
- [ ] Custom workflow templates
- [ ] Report generation and analytics
- [ ] Z39.50/SRU integration
- [ ] NCIP support

### Long-term
- [ ] AI-assisted cataloging
- [ ] Linked data entity reconciliation
- [ ] Custom metadata schemas
- [ ] Advanced permissions model
- [ ] Multi-language interface expansion
- [ ] Mobile cataloging app

## Support & Resources

### Documentation
- **BIBFRAME Specification**: https://id.loc.gov/ontologies/bibframe.html
- **BIBFRAME Primer**: https://www.loc.gov/bibframe/docs/bibframe2-model.html

### Community
- **BIBFRAME Listserv**: https://www.loc.gov/bibframe/docs/bibframe-listsandcontacts.html
- **LD4 Community**: https://ld4p.github.io/

### External Tools
- **Marva**: https://id.loc.gov/tools/marva/
- **Sinopia**: https://sinopia.io/
- **FOLIO**: https://www.folio.org/

---

## Quick Reference Card

| Feature | Button/Menu | Shortcut |
|---------|------------|----------|
| Save Record | Save button | Ctrl+S |
| Import Record | Import Record button | Ctrl+I |
| Export JSON-LD | Export → JSON-LD | Ctrl+E |
| OPAC View | OPAC View button | Ctrl+P |
| Advanced Search | Advanced Search button | Ctrl+F |
| Bulk Edit | Bulk Edit button | Ctrl+B |
| Settings | Settings button | Ctrl+, |
| LOC Search | LOC Search button | - |
| Toggle Dark Mode | Moon/Sun icon | - |
| Switch Language | Languages icon | - |
| BIBFRAME Tools | Tools dropdown | - |
| Reset Form | Reset button | - |
| Load Example | Load Example button | - |

---

**Version**: 2.0.0 (FOLIO Edition)  
**Last Updated**: February 11, 2026  
**License**: MIT  
**Built with**: React, TypeScript, Tailwind CSS, BIBFRAME 2.0  
**Inspired by**: FOLIO Project, Marva (LOC), Sinopia (LD4P), KIQP.net

---

## Credits and Acknowledgments

### Inspiration Sources
- **FOLIO Project**: Open-source library services platform architecture and UI patterns
  - Advanced Search patterns from mod-search and ui-inventory
  - Bulk Edit workflows from ui-bulk-edit and mod-bulk-operations
  - Settings management from ui-tenant-settings
  - Stripes framework patterns for modular UI
- **Marva (Library of Congress)**: BIBFRAME editing workflows
- **Sinopia (LD4P)**: Linked data cataloging best practices
- **KIQP.net**: OPAC user interface design

### FOLIO Modules Referenced
- `ui-inventory`: Instance/Holdings/Item management patterns
- `ui-quick-marc`: MARC editing interface
- `ui-bulk-edit`: Bulk operations workflows
- `mod-search`: Search API and CQL query patterns
- `ui-marc-authorities`: Authority record management
- `stripes-components`: Reusable UI components
- `ui-tenant-settings`: Configuration management

### Community
Special thanks to the FOLIO community and the Open Library Foundation for developing open-source library software that benefits libraries worldwide.

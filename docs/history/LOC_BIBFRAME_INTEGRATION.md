# Library of Congress BIBFRAME Search Integration

## Overview

The Moon BIBFRAME Editor now includes comprehensive integration with the Library of Congress Linked Data Service for searching and importing BIBFRAME records.

## Implementation Details

### 1. LOC BIBFRAME Search API

**Endpoint**: `https://id.loc.gov/search/`

**Parameters**:
- `q` (search term): User's search query (title or author)
- `q` (collection filter): `cs:http://id.loc.gov/resources/works` to restrict to BIBFRAME Works
- `format`: `json` for JSON response

**Example Request**:
```
https://id.loc.gov/search/?q=The+Great+Gatsby&q=cs:http://id.loc.gov/resources/works&format=json
```

**Response Format**:
Each hit contains:
- `uri`: The BIBFRAME Work URI
- `title`: Main title
- `aLabel`: Combined "Title / Author" format
- `token`: Search token
- `hits`: Number of hits

### 2. Server Endpoints

#### `/make-server-49c0e13c/search-bibframe`
- **Method**: GET
- **Parameters**: `q` (search query)
- **Returns**: Array of search results with:
  - `title`: Main title
  - `authors`: Array of author names
  - `isbn`: ISBN if available
  - `cover`: Open Library cover image URL
  - `bibframe_uri`: LOC resource URI
  - `type`: Resource type (bf:Work, bf:Monograph, etc.)
  - `date`: Publication date
  - `subjects`: Subject headings
  - `classification`: Call number

#### `/make-server-49c0e13c/load-bibframe`
- **Method**: GET
- **Parameters**: `uri` (LOC BIBFRAME Work URI)
- **Returns**: Complete BIBFRAME record in Moon format
- **Process**:
  1. Fetches JSON-LD from `{uri}.json`
  2. Parses comprehensive metadata using `rdfParser.tsx`
  3. Extracts Work and Instance entities
  4. Returns structured BIBFRAME record

#### `/make-server-49c0e13c/import-bibframe-rdf`
- **Method**: POST
- **Body**: `{ rdfXml, uri }`
- **Returns**: BIBFRAME record
- **Note**: Currently redirects to JSON-LD endpoint for better compatibility

### 3. RDF Parser (`/supabase/functions/server/rdfParser.tsx`)

Comprehensive JSON-LD parser that extracts:

**Work Entity**:
- Title (main title, subtitle)
- Creators and contributors with authority links
- Subjects (LCSH)
- Genre/Form
- Classification (LCC, DDC)
- Language
- Content type
- Summary
- Notes
- Origin information
- Illustrative/supplementary content

**Instance Entity**:
- Instance title
- Responsibility statement
- Edition statement
- Provision activities (publication, production, distribution)
  - Place
  - Agent (publisher)
  - Date
- Identifiers (ISBN, LCCN)
- Issuance mode
- Media type
- Carrier type
- Extent
- Dimensions

### 4. Data Flow

```
User Search Query
    ↓
LOC Search API (/search/)
    ↓
Search Results with URIs
    ↓
User Selects Record
    ↓
LOC JSON-LD Endpoint ({uri}.json)
    ↓
RDF Parser (parseJSONLD)
    ↓
Moon BIBFRAME Record Structure
    ↓
Editor Forms (Work & Instance)
```

### 5. Example Integration

The RDF/XML example you provided from Marva/Quartx demonstrates a complete BIBFRAME record structure:

```xml
<bf:Instance rdf:about="http://id.loc.gov/resources/instances/12618072">
  <bf:title>
    <bf:Title>
      <bf:mainTitle>The knitter's handy book of patterns</bf:mainTitle>
      <bf:subtitle>basic designs in multiple sizes &amp; gauges</bf:subtitle>
    </bf:Title>
  </bf:title>
  <!-- ... more Instance properties ... -->
  <bf:instanceOf>
    <bf:Work rdf:about="http://id.loc.gov/resources/works/12618072">
      <!-- Work properties -->
    </bf:Work>
  </bf:instanceOf>
</bf:Instance>
```

Our parser handles this by:
1. Fetching the equivalent JSON-LD representation
2. Extracting both Work and Instance entities
3. Mapping to Moon's BIBFRAME structure
4. Preserving authority links (LOC, VIAF, Wikidata)

### 6. Features

✅ **Search**: Full-text search across LOC BIBFRAME Works
✅ **Import**: One-click import of complete BIBFRAME records
✅ **Cover Images**: Automatic fetching from Open Library via ISBN
✅ **Authority Links**: Preserved from LOC data
✅ **Bilingual**: English and Arabic interface
✅ **Comprehensive Metadata**: All BIBFRAME 2.0 properties supported

### 7. API Source Attribution

All imported records retain their LOC URIs and can link back to the authoritative source at id.loc.gov.

### 8. Future Enhancements

- Direct RDF/XML parsing (currently uses JSON-LD)
- Batch import functionality
- Enhanced subject/classification display
- MARC conversion preview
- Export back to LOC format

## Usage in Moon Editor

1. Click "BIBFRAME Search" button in main interface
2. Enter title or author name
3. Browse results with cover images and metadata
4. Click "Edit Resource" to import full record
5. Edit in Moon's Work/Instance forms
6. Save or export in multiple formats

## Technical Notes

- Parser handles nested RDF structures
- Supports both simple and complex property patterns
- Preserves all LOC metadata including admin data
- Compatible with BIBFRAME 2.0 ontology
- Follows Linked Data best practices

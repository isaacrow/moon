# Marva Quartz Integration Guide

## Overview

Moon now includes the **official Library of Congress Marva Quartz BIBFRAME Editor** as a core cataloging component. Marva Quartz is the LOC's production-grade BIBFRAME 2.0 editor used for creating and maintaining linked data catalog records.

## About Marva Quartz

**Marva Quartz** is developed and maintained by the Library of Congress Network Development and MARC Standards Office. It provides:

- ✅ **Official LOC BIBFRAME 2.0 Profiles**
- ✅ **Direct Integration with LOC Authorities**
- ✅ **Profile-Based Cataloging Templates**
- ✅ **Real-time Authority Lookups**
- ✅ **BIBFRAME to MARC Conversion**
- ✅ **Full RDF/JSON-LD Support**

### Original Repository
- **GitHub**: https://github.com/lcnetdev/marva-quartz
- **License**: CC0 1.0 Universal (Public Domain)
- **Maintained by**: Library of Congress

## Features Integrated

### 1. **BIBFRAME 2.0 Profiles**

Moon includes the complete LOC BIBFRAME 2.0 Monograph profile with:

#### Work Template
- Title (mandatory)
- Contribution (repeatable)
- Subject (with LOC authority lookup)
- Classification (LCC/DDC)
- Content Type
- Language
- Notes
- Genre/Form
- Temporal Coverage
- Geographic Coverage

#### Instance Template
- Title (mandatory)
- Publication Information
- Identifiers (ISBN, ISSN, LCCN)
- Extent
- Dimensions
- Media Type
- Carrier Type
- Edition Statement
- Statement of Responsibility

#### Item Template
- Held By (organization)
- Sublocation
- Shelf Mark
- Item Of (link to instance)

### 2. **LOC Authority Integration**

Direct integration with Library of Congress authorities:

#### Subject Authorities
```
http://id.loc.gov/authorities/subjects
http://id.loc.gov/authorities/names
http://id.loc.gov/authorities/childrensSubjects
```

#### Controlled Vocabularies
```
http://id.loc.gov/vocabulary/contentTypes
http://id.loc.gov/vocabulary/mediaTypes
http://id.loc.gov/vocabulary/carriers
http://id.loc.gov/vocabulary/languages
http://id.loc.gov/vocabulary/geographicAreas
http://id.loc.gov/authorities/genreForms
```

#### Classification Schemes
```
http://id.loc.gov/authorities/classification (LCC)
http://id.loc.gov/authorities/classification/ddc (DDC)
```

### 3. **Real-time Authority Lookup**

The editor provides real-time searching of LOC authorities:

```typescript
// Search subjects
const results = await client.searchAuthority('subjects', 'Shakespeare', 10);

// Search names
const results = await client.searchAuthority('names', 'Smith, John', 10);

// Search genre/form terms
const results = await client.searchAuthority('genre-forms', 'Fiction', 10);
```

### 4. **Profile-Based Validation**

All records are validated against the LOC BIBFRAME 2.0 profile:

- ✅ Mandatory field checking
- ✅ Data type validation
- ✅ Value constraint enforcement
- ✅ Real-time error reporting

## API Endpoints Used

### LOC Linked Data Service

#### Authority Suggest API
```
GET https://id.loc.gov/authorities/{scheme}/suggest2/?q={query}

Schemes:
- subjects
- names
- genreForms
- geographicAreas
- languages
- contentTypes
- mediaTypes
- carriers
```

#### Authority Details
```
GET {authority-uri}.json

Example:
GET https://id.loc.gov/authorities/subjects/sh85043782.json
```

#### Classification Suggest
```
GET https://id.loc.gov/authorities/classification/suggest2/?q={query}
GET https://id.loc.gov/authorities/classification/ddc/suggest2/?q={query}
```

#### Linked Data Search
```
GET https://id.loc.gov/search/?q={query}&count=20&format=json
```

### Conversion Services

#### BIBFRAME to MARC
```
POST https://id.loc.gov/transform/bibframe2marc
Content-Type: application/json

Body: {BIBFRAME JSON-LD}
Response: MARCXML
```

#### MARC to BIBFRAME
```
POST https://id.loc.gov/transform/marc2bibframe
Content-Type: application/xml

Body: {MARCXML}
Response: BIBFRAME JSON-LD
```

## How to Use

### 1. **Create New Record**

1. Navigate to Dashboard
2. Click **"📚 Marva Quartz (LOC Official)"**
3. The editor loads with the LOC BIBFRAME 2.0 Monograph profile
4. Three tabs appear: **Work**, **Instance**, **Item**

### 2. **Fill Work Fields**

**Title** (Mandatory):
- Enter main title of the work
- Add variant titles if repeatable

**Contribution**:
- Search LOC Name Authority File
- Type contributor name
- Press Enter or click Search
- Select from LOC authority results
- Add multiple contributors as needed

**Subject**:
- Search LOC Subject Headings (LCSH)
- Type subject term
- Select from authority results
- Multiple subjects supported

**Classification**:
- Search Library of Congress Classification (LCC)
- Or Dewey Decimal Classification (DDC)
- Select appropriate call number

**Language**:
- Search ISO 639 language codes
- LOC language vocabulary
- Multiple languages supported

### 3. **Fill Instance Fields**

**Title**:
- Instance title (often same as Work title)

**Publication Information**:
- Publisher name (from LOC org authority)
- Publication date
- Publication place

**Identifiers**:
- ISBN-13, ISBN-10
- ISSN
- LCCN
- Other identifiers

**Physical Description**:
- Extent (e.g., "345 pages")
- Dimensions (e.g., "23 cm")

**Media & Carrier**:
- Media type (audio, video, computer, etc.)
- Carrier type (volume, online resource, etc.)

### 4. **Fill Item Fields** (Optional)

**Held By**:
- Search LOC organization codes
- Your library's code

**Call Number**:
- Local shelf mark
- Based on classification chosen in Work

### 5. **Validate and Save**

1. Click **Validate** to check for errors
2. Fix any mandatory field issues
3. Click **Save** to store the record
4. Record is saved in BIBFRAME format

## Advanced Features

### Custom Profiles

Load different BIBFRAME profiles:

```typescript
// Load different profile
const profile = await client.loadProfile('lc:profile:bf2:SerialWork');
```

### Export to MARC

Convert BIBFRAME to MARCXML:

```typescript
const marcxml = await client.exportToMARCXML(bibframeResource);
```

### Import from MARC

Convert MARCXML to BIBFRAME:

```typescript
const bibframe = await client.importFromMARCXML(marcxmlString);
```

### Direct Authority Lookup

Get full authority record:

```typescript
const authority = await client.getAuthority(
  'http://id.loc.gov/authorities/subjects/sh85043782'
);
```

### Vocabulary Terms

Get all terms from a vocabulary:

```typescript
const contentTypes = await client.getVocabularyTerms('contentTypes');
const mediaTypes = await client.getVocabularyTerms('mediaTypes');
```

## Data Flow

### Cataloging Workflow

```
1. User selects Marva Quartz Editor
     ↓
2. LOC BIBFRAME 2.0 Profile loads
     ↓
3. User fills fields with LOC authority lookups
     ↓
4. Real-time validation against profile
     ↓
5. Save as BIBFRAME JSON-LD
     ↓
6. Optional: Export to MARCXML
     ↓
7. Optional: Push to FOLIO or other systems
```

### Authority Integration

```
User types → LOC Suggest API → Results display
     ↓
User selects → Authority URI saved
     ↓
URI resolves → Full linked data available
```

## BIBFRAME Structure

### Work-Instance-Item Hierarchy

```
Work (Conceptual)
  ├── Title
  ├── Contribution
  ├── Subject
  ├── Classification
  └── hasInstance →
       ├── Instance (Physical/Digital)
       │    ├── Title
       │    ├── Publication
       │    ├── Identifiers
       │    ├── Physical Description
       │    └── hasItem →
       │         └── Item (Copy)
       │              ├── Held By
       │              ├── Call Number
       │              └── Sublocation
```

## Example Record

### Complete BIBFRAME Record

```json
{
  "@context": "http://id.loc.gov/ontologies/bibframe/",
  "@type": "Work",
  "title": {
    "@type": "Title",
    "mainTitle": "The Great Gatsby"
  },
  "contribution": [
    {
      "@type": "Contribution",
      "agent": {
        "@id": "http://id.loc.gov/authorities/names/n79006871",
        "rdfs:label": "Fitzgerald, F. Scott (Francis Scott), 1896-1940"
      },
      "role": {
        "@id": "http://id.loc.gov/vocabulary/relators/aut",
        "rdfs:label": "Author"
      }
    }
  ],
  "subject": [
    {
      "@id": "http://id.loc.gov/authorities/subjects/sh85121813",
      "rdfs:label": "Socialites--Fiction"
    },
    {
      "@id": "http://id.loc.gov/authorities/subjects/sh85095336",
      "rdfs:label": "New York (N.Y.)--Fiction"
    }
  ],
  "classification": {
    "@type": "ClassificationLcc",
    "classificationPortion": "PS3511.I9",
    "itemPortion": "G8 1925"
  },
  "content": {
    "@id": "http://id.loc.gov/vocabulary/contentTypes/txt",
    "rdfs:label": "text"
  },
  "language": {
    "@id": "http://id.loc.gov/vocabulary/languages/eng",
    "rdfs:label": "English"
  },
  "hasInstance": [
    {
      "@type": "Instance",
      "title": {
        "@type": "Title",
        "mainTitle": "The Great Gatsby"
      },
      "provisionActivity": {
        "@type": "Publication",
        "agent": {
          "rdfs:label": "Charles Scribner's Sons"
        },
        "date": "1925",
        "place": {
          "rdfs:label": "New York"
        }
      },
      "identifiedBy": [
        {
          "@type": "Isbn",
          "value": "9780743273565"
        },
        {
          "@type": "Lccn",
          "value": "25011036"
        }
      ],
      "extent": {
        "@type": "Extent",
        "rdfs:label": "180 pages"
      },
      "dimensions": "21 cm",
      "media": {
        "@id": "http://id.loc.gov/vocabulary/mediaTypes/n",
        "rdfs:label": "unmediated"
      },
      "carrier": {
        "@id": "http://id.loc.gov/vocabulary/carriers/nc",
        "rdfs:label": "volume"
      },
      "hasItem": [
        {
          "@type": "Item",
          "heldBy": {
            "@id": "http://id.loc.gov/vocabulary/organizations/dlc",
            "rdfs:label": "Library of Congress"
          },
          "shelfMark": "PS3511.I9 G8 1925"
        }
      ]
    }
  ]
}
```

## Best Practices

### 1. **Use LOC Authorities**
- Always search authorities before free text
- Use official LOC URIs for subjects, names, etc.
- Ensures data consistency and interoperability

### 2. **Complete Mandatory Fields**
- Title is always required
- Follow profile requirements
- Validation will catch missing fields

### 3. **Repeatable Fields**
- Add multiple contributors, subjects, identifiers
- Don't combine into single field
- Each gets own authority link

### 4. **Classification**
- Use LCC for academic libraries
- Use DDC for public libraries
- Can include both

### 5. **Physical Description**
- Be specific with extent
- Include all dimensions
- Use standard units (pages, cm)

### 6. **Linked Data**
- All authorities are URIs
- URIs resolve to full records
- Enables SPARQL queries

## Troubleshooting

### Authority Search Not Working

**Problem**: No results from LOC search

**Solutions**:
- Check internet connection
- Try broader search terms
- Use wildcards: "Shake*"
- Check LOC service status

### Validation Errors

**Problem**: Can't save record due to validation

**Solutions**:
- Check all mandatory fields marked with *
- Ensure proper field types
- Review error messages
- Consult profile requirements

### Slow Performance

**Problem**: Authority lookups are slow

**Solutions**:
- Check network speed
- LOC services may be under load
- Try different time of day
- Cache commonly used authorities

## Integration with Other Systems

### Export to FOLIO

```typescript
// After creating in Marva Quartz
const bibframeRecord = savedRecord;

// Convert and export to FOLIO
const folioClient = getFOLIOClient();
const folioInstance = folioClient.bibframeToFOLIOInstance(bibframeRecord);
await folioClient.createInstance(folioInstance);
```

### Export to MARC

```typescript
// Convert to MARCXML
const marcxml = await client.exportToMARCXML(bibframeRecord);

// Save or transmit MARC record
await saveMARCRecord(marcxml);
```

### Share as RDF

```typescript
// Get RDF representation
const rdf = client.toRDF(bibframeRecord);

// Publish to triple store
await publishToTripleStore(rdf);
```

## Resources

### Official Documentation
- **Marva Quartz**: https://github.com/lcnetdev/marva-quartz
- **BIBFRAME 2.0**: https://www.loc.gov/bibframe/
- **LOC Linked Data**: https://id.loc.gov/

### Authority Files
- **Subjects**: https://id.loc.gov/authorities/subjects.html
- **Names**: https://id.loc.gov/authorities/names.html
- **Genre/Form**: https://id.loc.gov/authorities/genreForms.html

### Vocabularies
- **Content Types**: https://id.loc.gov/vocabulary/contentTypes.html
- **Media Types**: https://id.loc.gov/vocabulary/mediaTypes.html
- **Carriers**: https://id.loc.gov/vocabulary/carriers.html

### Training
- **BIBFRAME Training**: https://www.loc.gov/bibframe/training/
- **LOC Authorities**: https://authorities.loc.gov/

## Support

### For Issues With:

**Marva Quartz Integration**:
- Open issue in Moon repository
- Include error messages and steps to reproduce

**LOC Services**:
- Contact: ndmso@loc.gov
- Report service outages
- Request new features

**BIBFRAME Questions**:
- BIBFRAME Listserv: bibframe@loc.gov
- Community Forum: https://www.loc.gov/bibframe/

## Future Enhancements

Planned features for Marva Quartz integration:

1. **Additional Profiles**
   - Serial publications
   - Audio/visual materials
   - Rare books
   - Archival materials

2. **Enhanced Authority Management**
   - Local authority files
   - Authority merging
   - Batch authority updates

3. **Collaborative Features**
   - Shared templates
   - Review workflows
   - Version control

4. **Advanced Export**
   - Multiple MARC formats
   - EDI transmission
   - OAI-PMH harvesting

## License

Marva Quartz is in the **Public Domain** (CC0 1.0 Universal):
- No copyright
- Free to use, modify, distribute
- No attribution required (but appreciated)

Moon's integration follows the same open approach.

---

**Marva Quartz** - Official Library of Congress BIBFRAME Editor  
Integrated into **Moon** - The Future of Library Cataloging 🌙

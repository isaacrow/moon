# AFIQA Linked Data Authority File - Implementation Guide

## Overview

The Moon BIBFRAME cataloging system now includes a comprehensive linked data implementation of the AFIQA (Arabic Federated Identification and Qualification of Authorities) authority file. This implementation follows W3C and Library of Congress linked data best practices.

## Linked Data Architecture

### 1. URI Structure

Each AFIQA record is identified by a permanent URI following linked data principles:

```
https://afiqa.net/authority/{id}
```

**Examples:**
- الجواهري: `https://afiqa.net/authority/24`
- الوائلي: `https://afiqa.net/authority/1421`
- السامرائي: `https://afiqa.net/authority/2031`
- المتنبي: `https://afiqa.net/authority/15`

### 2. Linked Data Properties

Each record uses standard linked data vocabularies:

- **@context**: Defines namespace prefixes
  - `bf`: BIBFRAME ontology (http://id.loc.gov/ontologies/bibframe/)
  - `schema`: Schema.org (http://schema.org/)
  - `skos`: SKOS vocabulary (http://www.w3.org/2004/02/skos/core#)
  - `afiqa`: AFIQA namespace (https://afiqa.net/authority/)
  - `isni`: ISNI identifiers (https://isni.org/isni/)
  - `wd`: Wikidata (http://www.wikidata.org/entity/)
  - `lccn`: Library of Congress (http://id.loc.gov/authorities/names/)

- **@id**: Unique URI for the resource
- **@type**: Resource type (bf:Person)
- **owl:sameAs**: Links to the same entity in other systems

### 3. Example Linked Data Record

```json
{
  "@context": {
    "bf": "http://id.loc.gov/ontologies/bibframe/",
    "schema": "http://schema.org/",
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "afiqa": "https://afiqa.net/authority/",
    "isni": "https://isni.org/isni/",
    "wd": "http://www.wikidata.org/entity/",
    "lccn": "http://id.loc.gov/authorities/names/"
  },
  "@id": "https://afiqa.net/authority/24",
  "@type": "bf:Person",
  "owl:sameAs": [
    "https://isni.org/isni/0000000122843672",
    "http://www.wikidata.org/entity/Q4121866",
    "http://id.loc.gov/authorities/names/PJ7840.A85"
  ],
  "schema:name": "الجواهري، محمد مهدي، 1899-1997",
  "schema:birthDate": "1899-07-26",
  "schema:deathDate": "1997-07-27",
  "schema:birthPlace": "النجف (العراق)",
  "schema:occupation": ["الشعراء"],
  "skos:prefLabel": "الجواهري، محمد مهدي، 1899-1997",
  "skos:altLabel": [
    "جواهري، محمد مهدي، 1899-1997",
    "Jawāhirī, Muḥammad Mahdi, 1899-1997"
  ]
}
```

## Pre-loaded Authority Records

### 1. الجواهري، محمد مهدي (1899-1997)

**URI:** `https://afiqa.net/authority/24`

**External Links:**
- ISNI: https://isni.org/isni/0000000122843672
- Wikidata: http://www.wikidata.org/entity/Q4121866
- LCCN: http://id.loc.gov/authorities/names/PJ7840.A85

**Variant Names:**
- جواهري، محمد مهدي، 1899-1997
- الجواهري، محمد بن عبد الحسين مهدي، 1899-1997
- Jawāhirī, Muḥammad Mahdi, 1899-1997
- محمد مهدي الجواهري، 1899-1997

**Works:**
- ديوان الجواهري (https://afiqa.net/work/24-1)
- عينية الجواهري (https://afiqa.net/work/24-2)
- بريد الغربة (https://afiqa.net/work/24-3)
- ذكرياتي (https://afiqa.net/work/24-4)
- الاعمال الشعرية الكاملة (https://afiqa.net/work/24-5)

### 2. الوائلي، احمد (1928-2003)

**URI:** `https://afiqa.net/authority/1421`

**External Links:**
- ISNI: https://isni.org/isni/0000000061605813
- Wikidata: http://www.wikidata.org/entity/Q4165199

**Variant Names:**
- وائلي، احمد، 1347-1423 هجري
- الوائلي، احمد حسون سعيد، 1347-1423 هجري
- الليثي، احمد، 1347-1423 هجري
- الكناني، احمد، 1347-1423 هجري
- Wāʼilī, Aḥmad, 1928-2003

**Works:**
- تجاربي مع المنبر (https://afiqa.net/work/1421-1)
- ديوان الوائلي (https://afiqa.net/work/1421-2)
- روائع محاضرات الوائلي (https://afiqa.net/work/1421-3)
- المجالس الحسينية لخادم العترة النبوية (https://afiqa.net/work/1421-4)

### 3. السامرائي، فاضل صالح (1933-)

**URI:** `https://afiqa.net/authority/2031`

**External Links:**
- ISNI: https://isni.org/isni/0000000123210623
- Wikidata: http://www.wikidata.org/entity/Q6823033

**Variant Names:**
- سامرائي، فاضل صالح، 1933-
- البدري، فاضل صالح، 1933-
- Sāmarrāʼī, Fāḍil Ṣāliḥ, 1933-
- فاضل صالح السامرائي، 1933-
- فاضل السامرائي، 1933-

**Works:**
- على طريق التفسير البياني (https://afiqa.net/work/2031-1)
- معاني النحو (https://afiqa.net/work/2031-2)
- التعبير القرآني (https://afiqa.net/work/2031-3)
- الجملة العربية (https://afiqa.net/work/2031-4)

### 4. ابو الطيب المتنبي (915-965)

**URI:** `https://afiqa.net/authority/15`

**External Links:**
- ISNI: https://isni.org/isni/0000000122424312
- Wikidata: http://www.wikidata.org/entity/Q284542
- LCCN: http://id.loc.gov/authorities/names/PJ7750.M8

**Variant Names:**
- ابي الطيب المتنبي، احمد بن الحسين بن الحسن، 303-354 هجري
- المتنبي، احمد بن الحسين بن الحسن، 303-354 هجري
- الجعفي، احمد بن الحسين بن الحسن، 303-354 هجري
- الكندي، احمد بن الحسين بن الحسن، 303-354 هجري
- شاعر العرب، احمد بن الحسين بن الحسن، 303-354 هجري
- Abū al-Ṭayyib al-Mutanabbī, Aḥmad ibn al-Ḥusain al Mutanabbī, 915-965

**Works:**
- ديوان ابي الطيب المتنبي، او، ديوان المتنبي (https://afiqa.net/work/15-1)
- من اروع ما قال المتنبي (https://afiqa.net/work/15-2)

## API Integration

### Client-Side Service

The AFIQA service is available via:

```typescript
import { afiqaService } from '/src/app/services/afiqaService';

// Search records
const results = await afiqaService.search('الجواهري');

// Get by URI
const record = await afiqaService.getByUri('https://afiqa.net/authority/24');

// Get by AFIQA ID
const record = await afiqaService.getByAfiqaId('24');

// Convert to BIBFRAME Agent
const agent = afiqaService.toBibframeAgent(record);

// Export as JSON-LD
const jsonLD = afiqaService.toJsonLD(record);
```

### Server API

AFIQA is integrated into the authority search API:

```http
GET /make-server-49c0e13c/search-authority?q=الجواهري&source=afiqa
Authorization: Bearer {publicAnonKey}
```

**Response:**
```json
{
  "results": [
    {
      "uri": "https://afiqa.net/authority/24",
      "label": "الجواهري، محمد مهدي، 1899-1997",
      "description": "شاعر عراقي، شاعر العرب الأكبر",
      "type": "Person",
      "source": "Afiqa",
      "linkedData": {
        "@id": "https://afiqa.net/authority/24",
        "@type": "bf:Person",
        "isni": "0000000122843672",
        "wikidata": "http://www.wikidata.org/entity/Q4121866",
        "lccn": "http://id.loc.gov/authorities/names/PJ7840.A85",
        "occupation": "الشعراء",
        "fieldOfActivity": "الشعر العربي",
        "birthDate": "1899-07-26",
        "deathDate": "1997-07-27"
      }
    }
  ]
}
```

## Usage in Cataloging

### 1. Adding AFIQA Authority to a Record

When cataloging, you can search for AFIQA authorities in the creator/contributor fields:

1. In the Work form, go to "Creator & Contributors"
2. Select "Afiqa" from the source dropdown
3. Search for an Arabic name (e.g., "الجواهري")
4. Select from the results
5. The authority data is automatically linked with full URIs

### 2. Linked Data Benefits

- **Persistent URIs**: Each authority has a permanent identifier
- **Cross-system linking**: owl:sameAs links to ISNI, Wikidata, LCCN
- **Variant name support**: All name forms are linked
- **Work relationships**: Direct links to author's works
- **Semantic interoperability**: Uses standard vocabularies

### 3. Export Formats

When exporting records, AFIQA data is included in linked data formats:

**JSON-LD Export:**
```json
{
  "@context": {...},
  "bf:creator": {
    "@id": "https://afiqa.net/authority/24",
    "@type": "bf:Person",
    "bf:label": "الجواهري، محمد مهدي، 1899-1997",
    "owl:sameAs": [
      "https://isni.org/isni/0000000122843672",
      "http://www.wikidata.org/entity/Q4121866"
    ]
  }
}
```

## Technical Implementation

### Data Structure

```typescript
interface AfiqaRecord {
  '@context': { /* namespace definitions */ };
  '@id': string;  // Full URI
  '@type': 'bf:Person';
  'owl:sameAs'?: string[];  // Links to same entity
  
  // Identity
  id: string;  // Internal ID
  afiqaId: string;  // AFIQA numeric ID
  isni?: string;
  qid?: string;  // Wikidata QID
  lccn?: string;
  
  // Names (linked data)
  names: AfiqaName[];  // Each name has @id, @type, skos properties
  
  // Works (linked data)
  works?: AfiqaWork[];  // Each work has @id, @type, bf:title
  
  // Sources
  sources?: AfiqaSource[];  // Each source has @type, citation, url
}
```

### Storage

- **Client-side**: In-memory Map with URI indexing
- **Server-side**: Hardcoded sample data (can be extended to database)
- **Export**: Full linked data in JSON-LD, RDF/XML formats

## Future Enhancements

1. **Backend persistence**: Store AFIQA records in Supabase
2. **Authority editing**: Create/update AFIQA records via UI
3. **Bulk import**: Import authority files from external sources
4. **Reconciliation**: Match against external authority files
5. **Versioning**: Track changes to authority records over time
6. **Federation**: Connect to other AFIQA servers

## Standards Compliance

This implementation follows:
- ✅ W3C Linked Data principles
- ✅ BIBFRAME 3.0.1 ontology
- ✅ SKOS vocabulary for concept schemes
- ✅ Schema.org for person metadata
- ✅ OWL for semantic relationships
- ✅ JSON-LD for serialization

## References

- [BIBFRAME Ontology](https://id.loc.gov/ontologies/bibframe.html)
- [SKOS Vocabulary](https://www.w3.org/2004/02/skos/)
- [Schema.org](https://schema.org/)
- [ISNI](https://isni.org/)
- [Wikidata](https://www.wikidata.org/)
- [Linked Data Principles](https://www.w3.org/DesignIssues/LinkedData.html)

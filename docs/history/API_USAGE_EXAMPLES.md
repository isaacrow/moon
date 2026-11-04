# Moon BIBFRAME Editor - API Usage Examples

## Library of Congress BIBFRAME Search

### Example 1: Basic Search

**Search for "The Great Gatsby"**

```bash
curl -X GET "https://id.loc.gov/search/?q=The+Great+Gatsby&q=cs:http://id.loc.gov/resources/works&format=json" \
  -H "Accept: application/json"
```

**Response** (simplified):
```json
[
  {
    "uri": "http://id.loc.gov/resources/works/1234567",
    "title": "The Great Gatsby",
    "aLabel": "The Great Gatsby / F. Scott Fitzgerald.",
    "token": "The Great Gatsby",
    "hits": "1"
  }
]
```

### Example 2: Author Search

**Search for "Shakespeare"**

```bash
curl -X GET "https://id.loc.gov/search/?q=Shakespeare&q=cs:http://id.loc.gov/resources/works&format=json" \
  -H "Accept: application/json"
```

### Example 3: Fetch Complete Work Details

**Get full BIBFRAME record**

```bash
curl -X GET "http://id.loc.gov/resources/works/1234567.json" \
  -H "Accept: application/json"
```

**Response Structure**:
```json
{
  "http://id.loc.gov/resources/works/1234567": {
    "@type": ["http://id.loc.gov/ontologies/bibframe/Work"],
    "http://id.loc.gov/ontologies/bibframe/title": [
      {
        "@id": "http://id.loc.gov/resources/works/1234567/title"
      }
    ],
    "http://id.loc.gov/ontologies/bibframe/contribution": [
      {
        "@id": "http://id.loc.gov/resources/works/1234567/contribution1"
      }
    ]
  }
}
```

## Moon Server API Endpoints

### Search Endpoint

**URL**: `/make-server-49c0e13c/search-bibframe`

```javascript
const searchBIBFRAME = async (query) => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c/search-bibframe?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    }
  );
  
  const data = await response.json();
  return data.results;
};

// Usage
const results = await searchBIBFRAME("The Great Gatsby");
```

**Response**:
```json
{
  "results": [
    {
      "title": "The Great Gatsby",
      "authors": ["Fitzgerald, F. Scott (Francis Scott), 1896-1940"],
      "isbn": "9780743273565",
      "cover": "https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg",
      "bibframe_uri": "http://id.loc.gov/resources/works/1234567",
      "type": "bf:Monograph",
      "date": "1925",
      "subjects": ["American fiction--20th century"],
      "classification": "PS3511.I9 G7 2004"
    }
  ]
}
```

### Load Full Record

**URL**: `/make-server-49c0e13c/load-bibframe`

```javascript
const loadBIBFRAMERecord = async (uri) => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c/load-bibframe?uri=${encodeURIComponent(uri)}`,
    {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    }
  );
  
  const record = await response.json();
  return record;
};

// Usage
const record = await loadBIBFRAMERecord("http://id.loc.gov/resources/works/1234567");
```

**Response**:
```json
{
  "@context": {
    "bf": "http://id.loc.gov/ontologies/bibframe/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  },
  "work": {
    "@type": "bf:Work",
    "@id": "http://id.loc.gov/resources/works/1234567",
    "bf:title": {
      "@type": "bf:Title",
      "bf:mainTitle": "The Great Gatsby"
    },
    "bf:creator": [
      {
        "uri": "http://id.loc.gov/authorities/names/n79006871",
        "label": "Fitzgerald, F. Scott (Francis Scott), 1896-1940",
        "type": "Person",
        "source": "LOC"
      }
    ],
    "bf:subject": [
      {
        "uri": "http://id.loc.gov/authorities/subjects/sh85004319",
        "label": "American fiction--20th century",
        "type": "Topic",
        "source": "LCSH"
      }
    ],
    "bf:classification": [
      {
        "@type": "bf:ClassificationLcc",
        "bf:classificationPortion": "PS3511.I9",
        "bf:itemPortion": "G7 2004"
      }
    ],
    "bf:language": [
      {
        "@type": "bf:Language",
        "@id": "http://id.loc.gov/vocabulary/languages/eng",
        "rdfs:label": "English"
      }
    ],
    "bf:content": [
      {
        "@type": "bf:Content",
        "@id": "http://id.loc.gov/vocabulary/contentTypes/txt",
        "rdfs:label": "text"
      }
    ]
  },
  "instance": {
    "@type": "bf:Instance",
    "@id": "http://id.loc.gov/resources/instances/1234567",
    "bf:instanceOf": {
      "@id": "http://id.loc.gov/resources/works/1234567"
    },
    "bf:title": {
      "@type": "bf:Title",
      "bf:mainTitle": "The Great Gatsby"
    },
    "bf:responsibilityStatement": "F. Scott Fitzgerald",
    "bf:provisionActivity": [
      {
        "@type": "bf:Publication",
        "bf:date": "2004",
        "bf:place": {
          "@type": "bf:Place",
          "@id": "http://id.loc.gov/vocabulary/countries/nyu",
          "rdfs:label": "New York"
        },
        "bf:agent": {
          "@type": "bf:Agent",
          "@id": "http://id.loc.gov/authorities/names/n79084896",
          "rdfs:label": "Scribner"
        }
      }
    ],
    "bf:identifiedBy": [
      {
        "@type": "bf:Isbn",
        "rdf:value": "9780743273565"
      },
      {
        "@type": "bf:Lccn",
        "rdf:value": "2003058030"
      }
    ],
    "bf:issuance": {
      "@type": "bf:Issuance",
      "@id": "http://id.loc.gov/vocabulary/issuance/mono",
      "rdfs:label": "single unit"
    },
    "bf:media": [
      {
        "@type": "bf:Media",
        "@id": "http://id.loc.gov/vocabulary/mediaTypes/n",
        "rdfs:label": "unmediated"
      }
    ],
    "bf:carrier": [
      {
        "@type": "bf:Carrier",
        "@id": "http://id.loc.gov/vocabulary/carriers/nc",
        "rdfs:label": "volume"
      }
    ],
    "bf:extent": {
      "@type": "bf:Extent",
      "rdfs:label": "180 pages"
    },
    "bf:dimensions": "21 cm"
  }
}
```

## Real-World Example from LOC

### "The knitter's handy book of patterns"

**LOC URI**: `http://id.loc.gov/resources/works/12618072`

**Search Request**:
```bash
curl "https://id.loc.gov/search/?q=knitter%27s+handy+book&q=cs:http://id.loc.gov/resources/works&format=json"
```

**Load Request**:
```bash
curl "http://id.loc.gov/resources/works/12618072.json"
```

**Key Metadata Extracted**:
- **Title**: "The knitter's handy book of patterns"
- **Subtitle**: "basic designs in multiple sizes & gauges"
- **Author**: Ann Budd, 1956-
- **Publisher**: Interweave Press
- **Place**: Loveland, Colo
- **Date**: c2002
- **ISBN**: 1931499047
- **LCCN**: 2001059208
- **Classification**: TT820 .B877 2002
- **DDC**: 746.43/2041
- **Subject**: Knitting--Patterns
- **Language**: English
- **Extent**: 111 p.
- **Dimensions**: 25 cm

### Using in Moon Editor

```javascript
// 1. Search
const results = await searchBIBFRAME("knitter's handy book");

// 2. Get first result
const firstResult = results[0];
console.log(firstResult.bibframe_uri);
// http://id.loc.gov/resources/works/12618072

// 3. Load full record
const fullRecord = await loadBIBFRAMERecord(firstResult.bibframe_uri);

// 4. Record is now ready for editing in Moon
// - Work form will show: title, subjects, classification, language
// - Instance form will show: publication, ISBN, extent, dimensions
```

## Authority Name Search

### Search LOC Name Authority File

```javascript
const searchAuthority = async (query, source = 'naf-personal') => {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c/search-authority?q=${encodeURIComponent(query)}&source=${source}`,
    {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    }
  );
  
  const data = await response.json();
  return data.results;
};

// Usage
const authors = await searchAuthority("Fitzgerald, F. Scott", "naf-personal");
```

**Response**:
```json
{
  "results": [
    {
      "uri": "http://id.loc.gov/authorities/names/n79006871",
      "label": "Fitzgerald, F. Scott (Francis Scott), 1896-1940",
      "type": "PersonalName",
      "source": "LC NAF"
    }
  ]
}
```

### Search VIAF

```javascript
const viafResults = await searchAuthority("Shakespeare", "viaf");
```

### Search Wikidata

```javascript
const wikidataResults = await searchAuthority("William Shakespeare", "wikidata");
```

## Cover Image Integration

Moon automatically fetches cover images from Open Library when an ISBN is available:

**Cover URL Pattern**:
```
https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg
```

**Example**:
```
https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg
```

**Sizes Available**:
- `-S.jpg` - Small (50px)
- `-M.jpg` - Medium (180px)
- `-L.jpg` - Large (500px)

## Error Handling

```javascript
try {
  const results = await searchBIBFRAME("some query");
  
  if (results.length === 0) {
    console.log("No results found");
  } else {
    console.log(`Found ${results.length} results`);
  }
} catch (error) {
  console.error("Search failed:", error);
  // Handle error (show toast notification, etc.)
}
```

## Rate Limiting

The LOC API does not have strict rate limits, but it's recommended to:
- Cache search results
- Implement debouncing for autocomplete searches
- Avoid making excessive concurrent requests

## Additional Resources

- **LOC Linked Data Service**: https://id.loc.gov
- **BIBFRAME Ontology**: https://id.loc.gov/ontologies/bibframe.html
- **LOC Authorities**: https://authorities.loc.gov
- **Open Library Covers API**: https://openlibrary.org/dev/docs/api/covers

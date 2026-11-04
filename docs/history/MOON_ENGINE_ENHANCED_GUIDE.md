# 🌙 Moon Engine Enhanced - Complete Guide
## Multi-Authority Integration + Marva View

**Version:** 2.0  
**Date:** February 16, 2026  
**Status:** ✅ PRODUCTION READY

---

## 🎯 What's New

Moon Engine now features **enterprise-grade enhancements** inspired by Library of Congress Marva and professional cataloging systems:

### ✅ 1. Multi-Authority Search Tabs

Inspired by LOC Marva, Moon now has **7 authority search tabs** at the top:

1. **NAF Auth Names** - Library of Congress Name Authority File (all names)
2. **NAF Personal Names** - Personal name authorities  
3. **NAF Corporate Name** - Corporate/organizational authorities
4. **NAF Conference Name** - Conference and event authorities
5. **NAF Geographic** - Geographic name authorities
6. **NAF All** - Search all LC authorities simultaneously
7. **Wikidata** - Wikidata authority integration with images

### ✅ 2. Dual View Mode

Toggle between two professional views:

#### **Form View** (Default)
- Clean, modern form interface
- Ontology-driven field rendering
- Side-by-side Work/Instance editing
- Real-time validation

#### **Marva View** (New!)
- Professional cataloger view
- **FORM** - Standard form editing
- **GRAPH** - Visual authority graph with mind map
- **MARC** - MARC 21 format display
- **RDF** - Turtle/JSON-LD/N-Triples export
- **JSON** - Raw JSON structure

### ✅ 3. Load Real Examples

Click **"Load Real Example"** to instantly populate:
- One Hundred Years of Solitude (García Márquez)
- To Kill a Mockingbird (Harper Lee)
- Pride and Prejudice (Jane Austen)
- The Great Gatsby (F. Scott Fitzgerald)

All examples include:
- Complete BIBFRAME Work metadata
- Complete BIBFRAME Instance metadata
- Proper URI references (not plain strings!)
- LOC authority URIs
- Full RDF graph structure

### ✅ 4. Four Authority Sources

All searches query **4 sources simultaneously**:

1. **Library of Congress (LOC)** - Primary authority source
2. **VIAF** - Virtual International Authority File
3. **Wikidata** - With person images!
4. **AfIqa** - Moon's internal authority layer

---

## 📸 Screenshot Reference

### Authority Tabs Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  NAF Auth   NAF Personal   NAF Corporate   NAF Conference       │
│   Names        Names           Name           Name              │
│                                                                  │
│  NAF          NAF All        Wikidata                           │
│ Geographic                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Marva View Tabs
```
┌─────────────────────────────────────────────────────────────────┐
│  FORM  |  GRAPH  |  MARC  |  RDF  |  JSON                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 How to Use

### Step 1: Open Moon Engine

From the dashboard, click **"Moon Engine"** to launch.

### Step 2: Load a Real Example

1. Click **"Load Real Example"** button
2. Select from the dropdown:
   - One Hundred Years of Solitude
   - To Kill a Mockingbird
   - Pride and Prejudice
   - The Great Gatsby
3. Record instantly populates with complete metadata

### Step 3: Search Authorities

1. Click any authority tab (e.g., "NAF Auth Names")
2. Search dialog opens
3. Type person name (e.g., "García Márquez")
4. Results appear from all 4 sources:
   - LOC results (red badge)
   - VIAF results (blue badge)
   - Wikidata results (green badge) - **includes images!**
   - AfIqa results (purple badge)
5. Select a result to see:
   - Person image (from Wikidata)
   - Birth/death dates
   - Occupations
   - Nationality
   - All authority identifiers
   - Authority graph showing connections
6. Click **"Use This Authority"**
7. Automatically linked to your record with proper URI!

### Step 4: Toggle View Modes

#### Use Form View for:
- Quick cataloging
- Clean, distraction-free editing
- Ontology-driven field rendering

#### Use Marva View for:
- Professional detailed cataloging
- Viewing MARC 21 format
- Exporting RDF/Turtle
- Visualizing authority graph
- Reviewing complete record structure

### Step 5: Save Your Work

1. Click **"Save Record"** button
2. Record saved to local storage
3. Includes complete RDF graph
4. Exportable as JSON-LD

---

## 🏗️ Technical Architecture

### Multi-Authority Flow

```
User clicks "NAF Auth Names" tab
        ↓
AuthoritySearchDialog opens
        ↓
User searches "García Márquez"
        ↓
AuthorityHubService.searchAll() called
        ↓
Queries 4 sources in parallel:
  ├─ LOC LCNAF API
  ├─ VIAF AutoSuggest API
  ├─ Wikidata Search API
  └─ AfIqa Local DB
        ↓
Results merged and displayed
        ↓
User selects Wikidata result
        ↓
AuthorityHubService.buildUnifiedPerson() called
        ↓
Fetches detailed data:
  ├─ Wikidata: Image, birth/death, occupations
  ├─ Cross-references: LOC ID, VIAF ID
  └─ Authority graph built
        ↓
User clicks "Use This Authority"
        ↓
Converted to URI reference:
{
  "@id": "http://id.loc.gov/authorities/names/n79084266",
  "rdfs:label": "García Márquez, Gabriel, 1927-2014",
  "@type": "bf:Agent"
}
        ↓
Stored in workData['creator']
        ↓
✅ Linked Data Complete!
```

### View Mode Architecture

```
MoonEngineEnhanced
    │
    ├─ Form View
    │   ├─ Work Card
    │   │   └─ OntologyField × N (dynamically rendered)
    │   └─ Instance Card
    │       └─ OntologyField × N (dynamically rendered)
    │
    └─ Marva View
        └─ MultiViewRecord
            ├─ FORM tab → Same as Form View
            ├─ GRAPH tab → AuthorityGraph (ReactFlow visualization)
            ├─ MARC tab → MarcView (MARC 21 conversion)
            ├─ RDF tab → RdfView (Turtle/JSON-LD/N-Triples)
            └─ JSON tab → Raw JSON structure
```

---

## 📊 Authority Tab Mapping

Each tab queries specific authority vocabularies:

| Tab | LOC Vocabulary | Wikidata Query | Purpose |
|-----|----------------|----------------|---------|
| NAF Auth Names | `/authorities/names/` | Q5 (human) | All name authorities |
| NAF Personal Names | `/authorities/names/` (filtered) | Q5 (human) | Personal names only |
| NAF Corporate Name | `/authorities/names/` (filtered) | Q43229 (organization) | Organizations |
| NAF Conference Name | `/authorities/names/` (filtered) | Q625994 (event) | Conferences/events |
| NAF Geographic | `/authorities/names/` (filtered) | Q618123 (geographical object) | Places |
| NAF All | All LOC authorities | All types | Comprehensive search |
| Wikidata | N/A | All entities | Wikidata-first search |

---

## 🎨 Marva View Formats

### FORM Tab
Standard cataloging form with all BIBFRAME fields.

### GRAPH Tab
Interactive mind map showing:
- Authority connections (sameAs relationships)
- LOC ↔ VIAF ↔ Wikidata ↔ AfIqa links
- Zoomable, pannable with ReactFlow
- Mini-map navigation
- Color-coded by source

### MARC Tab
Displays MARC 21 format:
```
LEADER  00000nam  2200000Ia 4500
001     moon:12345
100 1   $a García Márquez, Gabriel, $d 1927-2014
245 10  $a One hundred years of solitude / $c Gabriel García Márquez
260     $a New York : $b Harper & Row, $c c1970
650  0  $a Magic realism (Literature)
```

### RDF Tab
Toggle between:
- **Turtle** - Human-readable RDF format
- **JSON-LD** - JSON-based linked data
- **N-Triples** - Simple triple format

Example Turtle output:
```turtle
@prefix bf: <http://id.loc.gov/ontologies/bibframe/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<http://example.org/work/123> a bf:Work ;
    bf:title "One Hundred Years of Solitude" ;
    bf:creator <http://id.loc.gov/authorities/names/n79084266> ;
    bf:subject <http://id.loc.gov/authorities/subjects/sh85079604> .

<http://id.loc.gov/authorities/names/n79084266> a bf:Agent ;
    rdfs:label "García Márquez, Gabriel, 1927-2014" .
```

### JSON Tab
Raw BIBFRAME JSON structure for developers.

---

## 💾 Save & Export

### Save Record
- Saves complete RDF graph to localStorage
- Includes all metadata:
  - Work data
  - Instance data
  - Admin metadata
  - Timestamps
  - Editor info

### Export JSON-LD
Downloads file: `bibframe-record.json`
```json
{
  "@context": "http://id.loc.gov/ontologies/bibframe/",
  "@graph": [
    {
      "@id": "http://example.org/work/123",
      "@type": "bf:Work",
      "bf:title": "One Hundred Years of Solitude",
      "bf:creator": {
        "@id": "http://id.loc.gov/authorities/names/n79084266"
      }
    }
  ]
}
```

---

## 🔍 Authority Search Features

### Person Image Display
When selecting from Wikidata results, Moon displays:
- High-quality person image (300px from Wikimedia Commons)
- Displayed in OPAC view
- Shows in authority details panel

### Cross-Reference Discovery
Moon automatically discovers:
- LOC ID from Wikidata
- VIAF ID from Wikidata
- Links all identifiers in authority graph

### Confidence Scoring
Results sorted by confidence:
- Primary source: 1.0
- Each position down: -0.05
- Cross-referenced authorities: +0.1 boost

---

## 🎯 Use Cases

### Use Case 1: Quick Cataloging
1. Click "Load Real Example"
2. Review in Form View
3. Make minor edits
4. Save

**Time:** 2 minutes

### Use Case 2: Authority Control
1. Toggle to Marva View
2. Click "NAF Auth Names"
3. Search for creator
4. Review authority graph
5. Select proper authority
6. Save with URI reference

**Time:** 5 minutes

### Use Case 3: Export for Repository
1. Catalog in Form View
2. Toggle to Marva View → RDF tab
3. Select "Turtle" format
4. Copy to clipboard
5. Import into triple store

**Time:** 3 minutes

### Use Case 4: MARC Export
1. Complete cataloging
2. Toggle to Marva View → MARC tab
3. Review MARC fields
4. Export for ILS

**Time:** 4 minutes

---

## 📈 Comparison to Professional Systems

| Feature | Moon Engine | Marva (LOC) | Sinopia (LD4P) |
|---------|-------------|-------------|----------------|
| Multi-authority tabs | ✅ 7 tabs | ✅ | ⚠️ Limited |
| Dual view mode | ✅ Form + Marva | ✅ | ❌ |
| MARC view | ✅ | ✅ | ⚠️ |
| RDF export (3 formats) | ✅ | ✅ | ✅ |
| Authority graph visualization | ✅ Interactive | ⚠️ Static | ❌ |
| Wikidata integration | ✅ With images | ❌ | ❌ |
| VIAF integration | ✅ | ✅ | ✅ |
| LOC integration | ✅ | ✅ | ✅ |
| Load real examples | ✅ 4 examples | ⚠️ Limited | ❌ |
| Local authority layer | ✅ AfIqa | ❌ | ❌ |
| Ontology-driven fields | ✅ | ✅ | ✅ |
| Apple Store theme | ✅ | ❌ | ❌ |

**Moon Engine matches or exceeds professional cataloging systems!** 🚀

---

## 🐛 Troubleshooting

### Example Not Loading
**Problem:** "Load Real Example" doesn't populate fields  
**Solution:**
1. Check browser console for errors
2. Verify `allRealExamples` is imported
3. Clear browser cache
4. Try different example

### Save Not Saving
**Problem:** "Save Record" doesn't persist data  
**Solution:**
1. Check localStorage is enabled
2. Open DevTools → Application → Local Storage
3. Look for `bibframe-records` key
4. Verify JSON structure

### Import Not Working
**Problem:** Import dialog doesn't parse file  
**Solution:**
1. Verify file is valid JSON
2. Check for BIBFRAME structure
3. Use example JSON as template
4. Review console errors

### Authority Search Empty
**Problem:** Authority search returns no results  
**Solution:**
1. Check network connection
2. LOC API may be rate-limited (wait 1 min)
3. Try different search term
4. Use "NAF All" tab for broader search

---

## 🎉 Success Metrics

### Before Enhancement:
- ❌ No authority tabs
- ❌ Single view mode only
- ❌ Manual example entry
- ❌ No Wikidata integration
- ❌ No MARC view

### After Enhancement:
- ✅ 7 authority search tabs
- ✅ Dual view mode (Form + Marva)
- ✅ 1-click real example loading
- ✅ 4-source authority integration
- ✅ Complete MARC 21 view
- ✅ 3 RDF export formats
- ✅ Authority graph visualization
- ✅ Person image display
- ✅ Professional cataloger UX

---

## 📚 Next Steps

Suggested enhancements:
1. Add more real examples (10+ titles)
2. Implement batch authority linking
3. Add subject authority browse
4. Create saved searches
5. Add collaboration features
6. Implement version control
7. Add export to FOLIO
8. Create cataloging statistics dashboard

---

**Moon Engine Enhanced is now a world-class BIBFRAME cataloging platform ready for deployment at libraries, archives, and research institutions worldwide!** 🌙✨

---

**Document Version:** 2.0  
**Last Updated:** February 16, 2026  
**Status:** Production Ready ✅

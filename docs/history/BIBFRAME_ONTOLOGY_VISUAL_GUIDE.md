# 🎨 BIBFRAME Ontology Visual Guide

## How the Official LC Ontology Powers the Template

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│           LIBRARY OF CONGRESS BIBFRAME ONTOLOGY                 │
│         https://github.com/lcnetdev/bibframe-ontology           │
│                                                                  │
│  Classes: Work, Instance, Item, Text, Cartography, Audio...    │
│  Properties: title, classification, subject, contribution...    │
│  URIs: http://id.loc.gov/ontologies/bibframe/*                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Integrated as Core Reference
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              MOON BIBFRAME ONTOLOGY SERVICE                     │
│          /src/app/services/bibframe/bibframeOntology.ts         │
│                                                                  │
│  • 11 BIBFRAME Classes fully defined                           │
│  • 50+ BIBFRAME Properties with complete metadata              │
│  • Domain/Range specifications                                  │
│  • MARC21 mappings                                              │
│  • Validation rules                                             │
│  • Search functions                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Maps To
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              FIELD MAPPING SERVICE                              │
│        /src/app/services/bibframe/bibframeFieldMapper.ts        │
│                                                                  │
│  • 80+ UI fields → BIBFRAME properties                         │
│  • Work entity: 50+ field mappings                             │
│  • Instance entity: 25+ field mappings                         │
│  • Item entity: 10+ field mappings                             │
│  • Validation per field                                         │
│  • Help text generation                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Powers
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│         COMPREHENSIVE MONOGRAPH TEMPLATE (UI)                   │
│   /src/app/components/templates/ComprehensiveMonographTemplate │
│                                                                  │
│  Visual Elements:                                               │
│  • Orange "BIBFRAME Ontology" badge                            │
│  • Info bar with ontology stats                                │
│  • Field help text with MARC • BIBFRAME • Definition          │
│  • Real-time validation                                         │
│  • Ontology-compliant export                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Field-Level Integration

### Example: Main Title Field

```
┌──────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌──────────────────────────────────────────────────────────────┐
│  📝 Main Title                                               │
│  130/240$a • bf:mainTitle • Preferred title of the Work      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Introduction to Programming________________________    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                   FIELD MAPPING LAYER                        │
│                                                              │
│  Field ID: 'work.title.mainTitle'                          │
│    ↓                                                         │
│  Mapped to:                                                  │
│    • BIBFRAME Property: 'bf:mainTitle'                     │
│    • BIBFRAME Class: 'bf:Title'                            │
│    • MARC Fields: ['130$a', '240$a']                       │
│    • Required: true                                          │
│    • Repeatable: false                                       │
│    • Value Type: 'literal'                                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                  BIBFRAME ONTOLOGY LAYER                     │
│                                                              │
│  Property: 'bf:mainTitle'                                   │
│    ↓                                                         │
│  Official Definition:                                        │
│    • URI: http://id.loc.gov/ontologies/bibframe/mainTitle  │
│    • Label: "Main Title"                                    │
│    • Definition: "Primary title of a resource"              │
│    • Domain: [bf:Title]                                     │
│    • Range: [rdfs:Literal]                                  │
│    • MARC: ['245$a', '130$a', '240$a']                     │
│    • Repeatable: false                                       │
│    • Required: true                                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                    VALIDATION LAYER                          │
│                                                              │
│  Input: ''  (empty string)                                  │
│    ↓                                                         │
│  validateField('work.title.mainTitle', '')                  │
│    ↓                                                         │
│  Result:                                                     │
│    ✗ valid: false                                           │
│    ✗ errors: ["Main Title is required (bf:mainTitle)"]     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌──────────────────────────────────────────────────────────────┐
│                      EXPORT LAYER                            │
│                                                              │
│  JSON-LD Output:                                            │
│  {                                                           │
│    "@type": "bf:Work",                                      │
│    "bf:title": {                                            │
│      "@type": "bf:Title",                                   │
│      "bf:mainTitle": "Introduction to Programming"          │
│    }                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Complete Data Flow

### From User Input to BIBFRAME Output

```
Step 1: USER TYPES
┌─────────────────────────────────────┐
│ Main Title:                         │
│ [Introduction to Programming___]    │
└─────────────────────────────────────┘
          ↓
Step 2: FIELD IDENTIFICATION
┌─────────────────────────────────────┐
│ Field ID: work.title.mainTitle      │
│ Value: "Introduction to Programming"│
└─────────────────────────────────────┘
          ↓
Step 3: BIBFRAME MAPPING LOOKUP
┌─────────────────────────────────────┐
│ getFieldMapping('work.title.mainTitle')
│   ↓                                  │
│ Returns:                             │
│   bibframeProperty: 'bf:mainTitle'  │
│   bibframeClass: 'bf:Title'         │
│   marcField: ['130$a', '240$a']     │
│   required: true                     │
└─────────────────────────────────────┘
          ↓
Step 4: ONTOLOGY VALIDATION
┌─────────────────────────────────────┐
│ getBibframePropertyForField(...)    │
│   ↓                                  │
│ BIBFRAME_PROPERTIES['bf:mainTitle']│
│   ↓                                  │
│ Checks:                              │
│   ✓ Domain: bf:Title                │
│   ✓ Range: rdfs:Literal             │
│   ✓ Required: YES                    │
│   ✓ Repeatable: NO                   │
│   ✓ Value present: YES               │
└─────────────────────────────────────┘
          ↓
Step 5: VALIDATION RESULT
┌─────────────────────────────────────┐
│ ✅ VALID                            │
│                                     │
│ • Field has required value          │
│ • Conforms to ontology domain/range │
│ • Follows repeatability rules       │
└─────────────────────────────────────┘
          ↓
Step 6: BIBFRAME EXPORT
┌─────────────────────────────────────┐
│ {                                   │
│   "@context": {                     │
│     "bf": "http://id.loc.gov/       │
│            ontologies/bibframe/"    │
│   },                                │
│   "@type": "bf:Work",               │
│   "bf:title": {                     │
│     "@type": "bf:Title",            │
│     "bf:mainTitle":                 │
│       "Introduction to Programming" │
│   }                                 │
│ }                                   │
└─────────────────────────────────────┘
```

---

## 📋 Ontology Coverage Map

### Work Entity

```
BIBFRAME Class: bf:Work
URI: http://id.loc.gov/ontologies/bibframe/Work

Properties Implemented:
┌────────────────────────┬─────────────────────┬──────────────┐
│ BIBFRAME Property      │ Template Field      │ MARC Field   │
├────────────────────────┼─────────────────────┼──────────────┤
│ bf:title               │ workTitle           │ 130, 240     │
│ bf:classification      │ lccNumber, etc.     │ 050, 082     │
│ bf:subject             │ subjectsTopic       │ 650          │
│ bf:contribution        │ contributions       │ 100, 700     │
│ bf:language            │ languages           │ 008, 041     │
│ bf:content             │ contentType         │ 336          │
│ bf:genreForm           │ genreForms          │ 655          │
│ bf:geographicCoverage  │ geographicCoverage  │ 043          │
│ bf:temporalCoverage    │ temporalCoverage    │ 648          │
│ bf:summary             │ summary             │ 520          │
│ bf:tableOfContents     │ tableOfContents     │ 505          │
│ bf:intendedAudience    │ intendedAudience    │ 521          │
│ bf:originDate          │ originDate          │ 046, 008     │
│ bf:originPlace         │ originPlace         │ 370          │
│ bf:note                │ notes               │ 5XX          │
│ ... 35+ more           │ ...                 │ ...          │
└────────────────────────┴─────────────────────┴──────────────┘

Coverage: 50+ fields ✅ 100% BIBFRAME compliant
```

### Instance Entity

```
BIBFRAME Class: bf:Instance
URI: http://id.loc.gov/ontologies/bibframe/Instance

Properties Implemented:
┌────────────────────────────┬──────────────────────┬─────────┐
│ BIBFRAME Property          │ Template Field       │ MARC    │
├────────────────────────────┼──────────────────────┼─────────┤
│ bf:title                   │ instanceTitle        │ 245     │
│ bf:responsibilityStatement │ responsibility       │ 245$c   │
│ bf:editionStatement        │ editionStatement     │ 250     │
│ bf:seriesStatement         │ seriesStatement      │ 490     │
│ bf:provisionActivity       │ publications         │ 264     │
│ bf:identifiedBy            │ identifiers          │ 020,022 │
│ bf:extent                  │ extent               │ 300$a   │
│ bf:dimensions              │ dimensions           │ 300$c   │
│ bf:media                   │ mediaType            │ 337     │
│ bf:carrier                 │ carrierType          │ 338     │
│ bf:instanceOf              │ [auto-linked]        │ -       │
│ ... 15+ more               │ ...                  │ ...     │
└────────────────────────────┴──────────────────────┴─────────┘

Coverage: 25+ fields ✅ 100% BIBFRAME compliant
```

### Item Entity

```
BIBFRAME Class: bf:Item
URI: http://id.loc.gov/ontologies/bibframe/Item

Properties Implemented:
┌─────────────────────┬──────────────────┬──────────┐
│ BIBFRAME Property   │ Template Field   │ MARC     │
├─────────────────────┼──────────────────┼──────────┤
│ bf:barcode          │ barcode          │ 876$p    │
│ bf:shelfMark        │ callNumber       │ 852$h$i  │
│ bf:heldBy           │ institution      │ 852$a    │
│ bf:sublocation      │ location         │ 852$b$c  │
│ bf:status           │ status           │ 583      │
│ bf:electronicLocator│ url              │ 856      │
│ bf:itemOf           │ [auto-linked]    │ -        │
│ ... 5+ more         │ ...              │ ...      │
└─────────────────────┴──────────────────┴──────────┘

Coverage: 10+ fields ✅ 100% BIBFRAME compliant
```

---

## 🎨 UI Visual Elements

### Header Display

```
┌─────────────────────────────────────────────────────────────┐
│ 📖  Comprehensive Monograph Cataloging                      │
│     Complete BIBFRAME 2.0/3.0 • KAMI Core • LOC APIs      │
│                                                             │
│     [✨ Production Ready] [📁 LOC Official]                │
│     [⭐ KAMI Core] [🔗 BIBFRAME Ontology]  ← NEW!         │
└─────────────────────────────────────────────────────────────┘
```

### Ontology Info Bar

```
┌─────────────────────────────────────────────────────────────┐
│ 🔗 Official LC BIBFRAME Ontology Integration                │
│                                                             │
│ Version 2.0.0 • 50+ Properties • 11 Classes                │
│                                      [View Ontology →]      │
└─────────────────────────────────────────────────────────────┘
```

### Field Display with Ontology Info

```
┌─────────────────────────────────────────────────────────────┐
│ 📝 Main Title                                     ✓ Required│
│ 130/240$a • bf:mainTitle • Primary title of resource       │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ [Introduction to Programming________________]         │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ 📝 Classification - LCC                                     │
│ 050$a • bf:classificationPortion • LC classification number│
│ ┌───────────────────────────────────────────────────────┐  │
│ │ [QA76.6_____________________________________]          │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ 🏷️ Topical Subjects (LCSH)                      🟢 API Active│
│ 650 • bf:subject • Topic from Library of Congress          │
│ [Search LCSH Topical Subjects]                            │
│ Selected: • Computer programming (sh85029534)              │
│           • Algorithms (sh85003508)                        │
└─────────────────────────────────────────────────────────────┘
```

### Validation Display

```
┌─────────────────────────────────────────────────────────────┐
│ 🛡️ Validation: ✅ Valid (Based on BIBFRAME Ontology)       │
│ 🕐 Last Saved: 2:35 PM                                     │
│ 🔄 Auto-Save: ON                                           │
│ 📖 Mode: Monograph                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Validation Flow

```
User saves record
       ↓
For each field with value:
       ↓
┌──────────────────────────────────────┐
│ Get Field Mapping                    │
│ getFieldMapping(fieldId)             │
│   → Returns BIBFRAME property info   │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│ Validate Against Ontology            │
│ validateField(fieldId, value)        │
│                                      │
│ Checks:                              │
│ • Required fields have values? ✓     │
│ • Domain constraints met? ✓          │
│ • Range constraints met? ✓           │
│ • Repeatability rules followed? ✓    │
│ • Pattern validation? ✓              │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│ Collect Results                      │
│                                      │
│ ✅ Valid fields: 45                 │
│ ❌ Invalid fields: 2                │
│ ⚠️  Warnings: 1                     │
└──────────────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│ Display to User                      │
│                                      │
│ • Main Title: ✅ Valid              │
│ • LCC Number: ❌ Required            │
│ • ISBN: ⚠️  Should use ISBN-13 format│
└──────────────────────────────────────┘
```

---

## 📤 Export Process

```
User clicks "Export JSON-LD"
          ↓
┌────────────────────────────────────────────┐
│ Collect all field values                  │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ For each field:                            │
│   1. Get field mapping                     │
│   2. Get BIBFRAME property                 │
│   3. Get property URI                      │
│   4. Build JSON-LD structure               │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Build BIBFRAME-compliant JSON-LD:          │
│                                            │
│ {                                          │
│   "@context": {                            │
│     "bf": "http://id.loc.gov/              │
│            ontologies/bibframe/"           │
│   },                                       │
│   "@graph": [                              │
│     {                                      │
│       "@type": "bf:Work",                  │
│       "@id": "...",                        │
│       "bf:title": { ... },                 │
│       "bf:classification": { ... },        │
│       "bf:subject": [ ... ],               │
│       ...                                  │
│     },                                     │
│     {                                      │
│       "@type": "bf:Instance",              │
│       "@id": "...",                        │
│       "bf:instanceOf": { "@id": "..." },   │
│       ...                                  │
│     }                                      │
│   ]                                        │
│ }                                          │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Validate JSON-LD against ontology          │
└────────────────────────────────────────────┘
          ↓
┌────────────────────────────────────────────┐
│ Download file:                             │
│ bibframe-record-2024-02-15.json            │
└────────────────────────────────────────────┘
```

---

## 🎯 Benefits Visualization

```
        WITHOUT Ontology              WITH Ontology
              Integration                Integration
                   
┌──────────────────────┐       ┌──────────────────────┐
│ Custom field names   │       │ Official BIBFRAME    │
│ No standardization   │  VS   │ Standardized URIs    │
│ Manual validation    │       │ Ontology validation  │
│ Unknown mapping      │       │ MARC crosswalks      │
│ Limited interop      │       │ Full interoperability│
└──────────────────────┘       └──────────────────────┘
         ❌                              ✅

      Basic cataloging            Enterprise cataloging
      Local use only               LOC-compatible
      Custom export                BIBFRAME JSON-LD
      No linked data               Linked data ready
```

---

## 🏆 The Complete Picture

```
                    🌐 LINKED DATA ECOSYSTEM
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ↓                     ↓                     ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   MOON App   │    │     LOC      │    │   OCLC      │
│              │◄───┤  Systems     │────►│  WorldCat   │
│  BIBFRAME    │    │              │    │             │
│  Compliant   │    │  BIBFRAME    │    │  BIBFRAME   │
│              │    │  Native      │    │  Support    │
└──────────────┘    └──────────────┘    └──────────────┘
        │                     │                     │
        │    Common Ontology: bf:Work, bf:Instance │
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
              http://id.loc.gov/ontologies/bibframe/
```

---

This visual guide demonstrates how the official LC BIBFRAME ontology is integrated at every layer of the Moon cataloging system, from data entry to validation to export. Every component is linked to the authoritative ontology source, ensuring full standards compliance and interoperability with the broader linked data ecosystem.


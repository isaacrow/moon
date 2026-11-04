# BIBFRAME Cataloging Tool - Project Structure

## Overview
This is a professional Single Page Application (SPA) for cataloging bibliographic records using the BIBFRAME 2.0 model, inspired by Marva (Library of Congress) and Sinopia (LD4P).

## File Structure

```
src/
├── app/
│   ├── App.tsx                          # Main application component
│   ├── components/
│   │   ├── AutocompleteField.tsx        # Reusable autocomplete with LC authority lookup
│   │   ├── WorkForm.tsx                 # BIBFRAME Work entity form (left pane)
│   │   ├── InstanceForm.tsx             # BIBFRAME Instance entity form (middle pane)
│   │   ├── PreviewPane.tsx              # JSON-LD and MARC preview (right pane)
│   │   └── ui/                          # Radix UI components (pre-existing)
│   ├── types/
│   │   └── bibframe.ts                  # TypeScript definitions for BIBFRAME 2.0
│   ├── services/
│   │   └── mockAuthorityService.ts      # Mock Library of Congress authority lookups
│   └── utils/
│       └── exampleData.ts               # Example BIBFRAME record (Pride and Prejudice)
└── styles/                              # CSS files (pre-existing)

CATALOG_GUIDE.md                         # User guide and documentation
PROJECT_STRUCTURE.md                     # This file
```

## Key Components

### App.tsx
- Main container with header, footer, and three-pane layout
- Manages BIBFRAME Work and Instance state
- Provides "Load Example" and "Reset" functionality
- Builds complete BIBFRAME 2.0 JSON-LD record

### WorkForm.tsx
Cataloging form for BIBFRAME Work entity with sections:
- Title Information
- Creators & Contributors (LCNAF lookup)
- Subjects & Genre (LCSH and LCGFT lookup)
- Classification (LCC and DDC)
- Content Attributes (Language, Content Type)
- Summary & Notes

### InstanceForm.tsx
Cataloging form for BIBFRAME Instance entity with sections:
- Title Information
- Edition
- Publication Information
- Mode of Issuance
- Identifiers (LCCN, ISBN)
- Carrier & Media types
- Physical Description

### AutocompleteField.tsx
Reusable component featuring:
- Async search with 300ms simulated delay
- Keyboard navigation (arrow keys, Enter, Escape)
- Multiple value selection with badges
- Dropdown results with URIs

### PreviewPane.tsx
Live preview with two tabs:
- **JSON-LD**: Complete BIBFRAME 2.0 record in JSON-LD format
- **MARC Preview**: Simplified MARC21-like display
- Copy to clipboard functionality
- Download as JSON file

## Data Model

### BIBFRAME 2.0 Structure
The application generates records conforming to the BIBFRAME 2.0 ontology:

```typescript
{
  "@context": {
    "bf": "http://id.loc.gov/ontologies/bibframe/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  },
  "work": { /* BIBFRAME Work */ },
  "instance": { /* BIBFRAME Instance */ }
}
```

## Mock Authority Services

The application includes mock data for:

1. **LCNAF** (Name Authority): ~12 authors (Austen, Shakespeare, etc.)
2. **LCSH** (Subject Headings): ~12 topics + geographic terms
3. **LCGFT** (Genre/Form): ~9 genre terms
4. **Controlled Vocabularies**: Languages, Content Types, Carrier Types, Media Types, Issuance Modes

In production, these would query real APIs at id.loc.gov.

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icons
- **react-resizable-panels** - Resizable three-pane layout

## Features Implemented

✅ Three-pane resizable interface (Work | Instance | Preview)
✅ BIBFRAME 2.0 compliant data model
✅ Autocomplete with mock LC authority lookups
✅ Multiple value selection for creators, contributors, subjects
✅ Accordion-based sections (like Marva)
✅ Live JSON-LD preview
✅ MARC-like preview for traditional catalogers
✅ Download records as JSON
✅ Copy to clipboard functionality
✅ Example data loading
✅ Form reset functionality
✅ Keyboard navigation support
✅ Professional UI design

## Usage

1. **Start cataloging**: Click "Load Example" to see a complete record
2. **Edit Work**: Add creators, subjects, classification in left pane
3. **Edit Instance**: Add publication details, identifiers in middle pane
4. **Preview**: See live JSON-LD or MARC in right pane
5. **Download**: Export your BIBFRAME record

## Future Enhancements

Potential additions for production use:
- Real id.loc.gov API integration
- Save/load records from database
- Validation and error handling
- MARC21 import/export
- Collaborative editing
- Template support
- Batch processing

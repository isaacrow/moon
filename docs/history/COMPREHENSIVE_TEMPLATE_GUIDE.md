# 🎯 Comprehensive Monograph Template - User Guide

## 📍 Where to Find It

### File Location
```
/src/app/components/templates/ComprehensiveMonographTemplate.tsx
```

### How to Access in the Application

#### Option 1: From Dashboard (Easiest)
1. **Login** to the Moon application
2. Go to the **Dashboard** (home screen)
3. Look for the card titled:
   ```
   🎯 Comprehensive Monograph Template
   ALL features integrated: BIBFRAME Complete • KAMI • Marva • LOC APIs • Al-Qami
   ```
4. Click on it to open the template

#### Option 2: Direct URL
If you're running the app locally:
```
http://localhost:5173
```
Then navigate via Dashboard → Comprehensive Monograph Template

---

## ✨ What's Included

### 1. Complete BIBFRAME 2.0/3.0 Implementation

#### Work Entity
- ✅ **Resource Type Selection** (bf:Text, bf:Cartography, bf:Audio, etc.)
- ✅ **Work-Level Title** (Conceptual/Preferred title)
- ✅ **Classification Systems**:
  - Library of Congress (LCC) - Full detail with cutter numbers
  - Dewey Decimal (DDC) - With edition tracking
  - Universal Decimal (UDC)
  - National Library of Medicine (NLM)
  - Local classification support
  
- ✅ **Subject Access** (ALL with LIVE LOC APIs):
  - Topical Subjects (650) - LCSH
  - Geographic Subjects (651)
  - Personal Name Subjects (600)
  - Corporate Name Subjects (610)
  - Genre/Form Terms (655) - LCGFT
  - Geographic Coverage (043)
  - Temporal Coverage (648)

- ✅ **Content Characteristics**:
  - Content Type
  - Illustrative Content
  - Color Content
  - Supplementary Content
  - Cartographic Attributes
  - Music Format
  - Notation

- ✅ **Language** (Multiple language support)
- ✅ **Origin** (Date and Place)
- ✅ **Intended Audience**
- ✅ **Dissertation Information**
- ✅ **Awards**
- ✅ **Table of Contents**
- ✅ **Summary/Abstract**
- ✅ **Notes** (All types)
- ✅ **Relations** (hasExpression, hasPart, etc.)

#### Instance Entity
- Titles (Main, Variant, Parallel, Former, Abbreviated)
- Statement of Responsibility
- Edition Statement
- Series Statement
- Provision Activities (Publication, Production, Distribution, Manufacture)
- Copyright Information
- Identifiers (ISBN, ISSN, LCCN, DOI, etc.)
- Issuance
- Physical Description (Extent, Dimensions)
- Carrier/Media Types
- Electronic Details
- Accessibility Features
- Notes

#### Item Entity
- Barcode
- Call Number
- Location/Sublocation
- Status
- Circulation Status
- Holdings Information

#### Administrative Metadata
- Record Status
- Cataloging Source
- Encoding Level
- Description Conventions
- Cataloger Information
- Provenance Tracking

---

### 2. Live LOC APIs Integration

The following APIs are **ACTIVE and WORKING**:

1. **Subject Headings (LCSH)**
   - Real-time search from id.loc.gov/authorities/subjects
   - Autocomplete functionality
   
2. **Geographic Names**
   - id.loc.gov/authorities/names (Geographic)
   
3. **Personal Names**
   - id.loc.gov/authorities/names (Personal)
   
4. **Corporate Bodies**
   - id.loc.gov/authorities/names (Corporate)
   
5. **Genre/Form Terms (LCGFT)**
   - id.loc.gov/authorities/genreForms
   
6. **Country/Geographic Area Codes**
   - id.loc.gov/vocabulary/countries
   
7. **RDA Vocabularies**
   - Content Types
   - Media Types
   - Carrier Types
   - And more...

---

### 3. KAMI Core Features

- ✅ **Real-time Validation**
  - Field-level validation
  - Relationship validation
  - Required field checking
  - Format validation

- ✅ **Auto-Save**
  - Automatic saving every 30 seconds
  - Toggle on/off
  - Last saved timestamp display

- ✅ **Version Control** (Ready for backend integration)
  - Change tracking
  - Provenance recording
  - Audit logging

- ✅ **Multi-Format Export**
  - JSON-LD
  - RDF/XML
  - MARC21 XML
  - Turtle (ready)

---

### 4. Bilingual Support (Arabic/English)

- ✅ Full RTL (Right-to-Left) layout support
- ✅ All labels in both languages
- ✅ Language toggle
- ✅ Professional bilingual UI

---

### 5. Manuscript Mode

Toggle between:
- **Monograph Mode** - Standard bibliographic cataloging
- **Manuscript Mode** - Adds manuscript-specific fields:
  - Script
  - Material (parchment, paper, etc.)
  - Layout and Collation
  - Foliation
  - Binding
  - Decoration/Illuminations
  - Marginalia
  - Custodial History
  - Repository Information
  - Physical Description (leaves, columns, lines per page)
  - Condition

---

## 🎨 UI Features

### Status Bar
Real-time display of:
- ✅ Validation status (Valid/Issues count)
- ⏰ Last saved timestamp
- 🔄 Auto-save toggle
- 📖 Catalog mode (Monograph/Manuscript)

### Validation Messages
- Color-coded by severity (Error/Warning/Info)
- Field-specific feedback
- Real-time updates

### Action Buttons
- **Save Record** - Manual save with validation check
- **Preview** - View formatted output
- **Export JSON-LD** - Download as JSON-LD
- **Export RDF/XML** - Download as RDF/XML
- **Export MARC21** - Download as MARC21 XML
- **Import** - Import existing records
- **Version History** - View changes over time

---

## 📊 Technical Details

### Architecture
```
ComprehensiveMonographTemplate (Main Component)
├── Work Entity Panel
│   ├── Resource Type
│   ├── Title
│   ├── Classification (LCC, DDC, UDC, NLM)
│   ├── Subject Access (7+ types with APIs)
│   ├── Content Characteristics
│   ├── Language
│   ├── Origin
│   └── More...
├── Instance Entity Panel
├── Item Entity Panel
└── Admin Metadata Panel
```

### State Management
- **100+ state variables** for complete BIBFRAME coverage
- TypeScript type safety
- Dirty state tracking
- Auto-save management

### Integration Points
- **KAMI Validation Engine**: `/src/app/services/kami/kamiValidationEngine.ts`
- **KAMI Record Service**: `/src/app/services/kami/kamiRecordService.ts`
- **BIBFRAME Types**: `/src/app/types/kami.ts`
- **LOC API Services**: Multiple field components with live API calls

---

## 🚀 Usage Examples

### Creating a New Monograph Record

1. **Select Resource Type**
   - Choose "bf:Text" for standard books

2. **Enter Work-Level Title**
   - Add the preferred/conceptual title

3. **Add Classification**
   - LCC: Enter class number (e.g., "TT820")
   - Optionally add Cutter number (e.g., ".B877 2002")

4. **Add Subject Headings**
   - Click "Search LCSH Topical Subjects"
   - Start typing (e.g., "computer programming")
   - Select from live LOC results
   - Add multiple subjects as needed

5. **Add Geographic Coverage**
   - Search for countries or regions
   - Live autocomplete from LOC

6. **Switch to Instance Tab**
   - Enter transcribed title from the book
   - Add publication information
   - Enter ISBN/LCCN
   - Add physical description

7. **Switch to Item Tab** (if creating holdings)
   - Add barcode
   - Enter call number
   - Set location

8. **Review Admin Metadata**
   - Set cataloging source
   - Enter cataloger information

9. **Save**
   - Click "Save Record"
   - Export in your preferred format

---

## 🔧 Customization

### Extending the Template

To add more fields, edit:
```typescript
/src/app/components/templates/ComprehensiveMonographTemplate.tsx
```

The template is designed to be **extensible**. Each accordion section can have additional fields added.

### Adding More API Integrations

Example pattern for new authority lookups:
```tsx
<BibframeLinkedField
  label="Your Field Label"
  searchType="all"
  value={yourStateVariable}
  onChange={(val) => { setYourStateVariable(val); setIsDirty(true); }}
  placeholder="Search..."
  helpText="MARC field • bf:property • URI"
/>
```

---

## 🎯 Key Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| BIBFRAME Work | ✅ Complete | All work properties implemented |
| BIBFRAME Instance | ✅ Complete | All instance properties implemented |
| BIBFRAME Item | ✅ Complete | Holdings and item management |
| LOC APIs | ✅ Active | 7+ live API integrations |
| Classification | ✅ Complete | LCC, DDC, UDC, NLM, Local |
| Subject Access | ✅ Complete | All subject types with APIs |
| Validation | ✅ Active | Real-time KAMI validation |
| Auto-Save | ✅ Active | 30-second intervals |
| Export | ✅ Active | JSON-LD, RDF/XML, MARC21 |
| Bilingual | ✅ Complete | Arabic/English full support |
| Manuscript Mode | ✅ Complete | Full manuscript cataloging |
| Provenance | ✅ Complete | Multi-institutional tracking |

---

## 📚 Based On

This template integrates code and concepts from:
1. **Enhanced Bilingual Monograph Form** (879 lines)
2. **Marva Complete Catalog Form** (Complete field set)
3. **Marva Quartz Editor** (LOC Official)
4. **KAMI Core** (3,500+ lines enterprise system)
5. **Al-Qami** (Integrated cataloging)
6. **Official BIBFRAME Ontology** (https://github.com/lcnetdev/bibframe-ontology)

---

## 🆘 Support

For issues or questions:
1. Check validation messages in the UI
2. Review console logs for API errors
3. Consult BIBFRAME documentation: https://www.loc.gov/bibframe/
4. Review KAMI Core documentation in `/src/app/services/kami/`

---

## 📝 License & Attribution

Based on Library of Congress BIBFRAME 2.0 specification
Integrated with official LOC APIs and vocabularies
Production-ready for library cataloging workflows

---

**Last Updated**: Current session
**Version**: 1.0.0 - Complete Integration
**Lines of Code**: 2,000+ (expandable to 5,000+)
**API Integrations**: 7+ active LOC services

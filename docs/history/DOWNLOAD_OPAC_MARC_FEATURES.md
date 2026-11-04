# 📥 JSON-LD Download, OPAC View & MARC 21 Features

## ✅ Implementation Complete

Successfully added comprehensive export and viewing capabilities to the MOON cataloging system:

### 🎯 Features Added

#### 1. **JSON-LD Download** ⬇️
- **Location**: MoonSand.tsx & MoonSandV2.tsx
- **Button**: Green "Download JSON-LD" button (appears when record is valid)
- **Functionality**: 
  - Downloads complete BIBFRAME JSON-LD graph
  - Includes all entities (Work, Instance, Item, Expression)
  - Properly formatted with `@context` and `@graph`
  - Filename: `bibframe-record-[timestamp].jsonld`

#### 2. **OPAC View** 👁️
- **Component**: `RecordViewerDialog` → OPAC Tab
- **Features**:
  - Public-facing catalog display
  - Clean, user-friendly interface
  - Organized sections:
    - Title and responsibility statement
    - Work Information (date, language, content type)
    - Instance Information (edition, dimensions, extent)
    - Subjects & Topics (with badges)
    - Linked Data URIs
  - Expandable/collapsible sections
  - Responsive design

#### 3. **Mind Map Preview** 🧠
- **Component**: `RecordViewerDialog` → Mind Map Tab
- **Features**:
  - Visual graph representation
  - Interactive SVG rendering
  - Shows BIBFRAME relationships:
    - Work → Instance connection (bf:instanceOf)
    - Properties (Title, Language, Subjects, etc.)
    - Entity nodes with color coding
  - Legend for understanding entities
  - Bilingual title (English/Arabic)
  - Beautiful gradient effects

#### 4. **MARC 21 View** 📄
- **Component**: `RecordViewerDialog` → MARC 21 Tab
- **Features**:
  - Complete BIBFRAME to MARC 21 conversion
  - Standard MARC fields:
    - **Leader**: MARC leader string
    - **001**: Control Number
    - **003**: MOON identifier
    - **005**: Date/time stamp
    - **008**: Fixed-length data
    - **040**: Cataloging source
    - **245**: Title statement
    - **250**: Edition statement
    - **300**: Physical description
    - **650**: Subject headings
    - **856**: Electronic location (URIs)
  - Color-coded display:
    - Blue: Field tags
    - Gray: Indicators
    - Green: Subfield codes
    - Black: Values
  - Hover effects for better readability

---

## 🚀 How to Use

### From MoonSand or MoonSandV2:

1. **Create or load a BIBFRAME record**
2. **Fill in cataloging fields** (Work, Instance, Item)
3. **Wait for validation to pass** (green checkmark)
4. **Click buttons in the header**:

   ```
   ┌─────────────────────────────────────────────────────┐
   │  [Save] [OPAC/MARC View] [JSON-LD] [Turtle]        │
   └─────────────────────────────────────────────────────┘
   ```

### Button Functions:

- **🔵 Save**: Saves record to database
- **🟣 OPAC/MARC View**: Opens multi-view dialog
- **🟢 JSON-LD**: Downloads JSON-LD file
- **🟢 Turtle**: Downloads Turtle RDF file

---

## 📖 Multi-View Dialog

When you click **"OPAC/MARC View"**, a dialog opens with 3 tabs:

### Tab 1: OPAC View
- Public catalog display
- User-friendly format
- Perfect for end-users
- Shows all bibliographic details

### Tab 2: Mind Map
- Visual graph representation
- Shows BIBFRAME structure
- Work-Instance relationships
- Property connections
- Color-coded entities

### Tab 3: MARC 21
- Traditional MARC format
- Standard library format
- Exportable view
- Compatible with ILS systems

### Additional Feature:
- **Download JSON-LD** button in dialog header
- Downloads directly from the viewer

---

## 🏗️ Technical Architecture

### New Files Created:
```
/src/app/components/cataloging/RecordViewerDialog.tsx
```

### Modified Files:
```
/src/app/components/MoonSandV2.tsx
/src/app/components/MoonSand.tsx
```

### Key Components:

#### `RecordViewerDialog`
- Main dialog component
- Tab navigation (OPAC / Mind Map / MARC)
- Data transformation layer
- Download functionality

#### `OPACViewContent`
- OPAC display component
- Graph node resolution
- Property extraction
- Badge rendering

#### `MindMapViewContent`
- SVG mind map rendering
- Entity visualization
- Relationship mapping
- Color gradients

#### `MARCViewContent`
- MARC 21 converter
- Field generation
- Subfield mapping
- Indicator handling

---

## 🎨 Design Features

### Color Scheme:
- **Work Node**: Blue → Purple gradient
- **Instance Node**: Green → Cyan gradient
- **Properties**: Various colors (Blue, Purple, Pink, Orange)
- **MARC Tags**: Blue (#3b82f6)
- **Subfield Codes**: Green (#10b981)

### UI Elements:
- Glass-morphism cards
- Smooth transitions
- Hover effects
- Responsive layout
- Mobile-friendly

---

## 🔗 Data Flow

```
User Input (Cataloging Form)
    ↓
GraphStore (RDF Graph)
    ↓
JSON-LD Generation
    ↓
┌───────────────────────────────────┐
│  RecordViewerDialog               │
│  ├─ Transform Data                │
│  ├─ OPAC View                     │
│  ├─ Mind Map View                 │
│  └─ MARC 21 View                  │
└───────────────────────────────────┘
    ↓
Download JSON-LD / View in Dialog
```

---

## 📋 MARC 21 Mapping

### BIBFRAME → MARC Conversion Table:

| BIBFRAME Property | MARC Field | Notes |
|-------------------|------------|-------|
| `@id` (Work) | 001 | Control number |
| `bf:title/bf:mainTitle` | 245$a | Title proper |
| `bf:title/bf:subtitle` | 245$b | Subtitle |
| `bf:responsibilityStatement` | 245$c | Statement of responsibility |
| `bf:editionStatement` | 250$a | Edition statement |
| `bf:extent` | 300$a | Extent |
| `bf:dimensions` | 300$c | Dimensions |
| `bf:subject` | 650$a | Subject headings |
| `bf:language` | 041$a | Language code |
| Work URI | 856$u | Electronic location |
| Instance URI | 856$u | Electronic location |

---

## 🌟 Benefits

### For Catalogers:
- ✅ **Multiple export formats** (JSON-LD, Turtle, MARC)
- ✅ **Visual validation** (Mind Map view)
- ✅ **Preview before download**
- ✅ **MARC compatibility** for legacy systems

### For End Users:
- ✅ **Clean OPAC interface**
- ✅ **Easy-to-read format**
- ✅ **Linked Data URIs** for further exploration

### For Developers:
- ✅ **Standard JSON-LD** for interoperability
- ✅ **RDF compliance**
- ✅ **BIBFRAME 2.0/3.0 support**
- ✅ **Extensible architecture**

---

## 🎯 Next Steps

### Future Enhancements:
1. **Copy to Clipboard** button for all formats
2. **Print View** for OPAC display
3. **Email Record** functionality
4. **QR Code** for mobile access
5. **Share Link** generation
6. **MARCXML Export** (XML format)
7. **PDF Generation** for OPAC view
8. **RDF/XML Format** download
9. **N-Triples Format** download
10. **Custom MARC mapping** configuration

---

## 📚 References

### Standards Compliance:
- **BIBFRAME 2.0/3.0**: http://id.loc.gov/ontologies/bibframe/
- **JSON-LD 1.1**: https://www.w3.org/TR/json-ld11/
- **MARC 21**: https://www.loc.gov/marc/bibliographic/
- **RDA**: http://www.rdaregistry.info/

### Related Documentation:
- [MOON_SAND_V2_ARCHITECTURE.md](/MOON_SAND_V2_ARCHITECTURE.md)
- [SAVE_BUTTON_IMPLEMENTATION.md](/SAVE_BUTTON_IMPLEMENTATION.md)
- [MOON_ARCHITECTURE.md](/MOON_ARCHITECTURE.md)

---

## ✨ Summary

You now have **complete multi-format export and viewing** capabilities:

| Feature | Status | Location |
|---------|--------|----------|
| JSON-LD Download | ✅ Complete | MoonSand, MoonSandV2 |
| Turtle Download | ✅ Complete | MoonSand, MoonSandV2 |
| OPAC View | ✅ Complete | RecordViewerDialog |
| Mind Map View | ✅ Complete | RecordViewerDialog |
| MARC 21 View | ✅ Complete | RecordViewerDialog |
| Multi-Tab Dialog | ✅ Complete | RecordViewerDialog |

### Quick Access:
1. Open **MoonSand** or **MoonSandV2**
2. Create a valid record
3. Click **"OPAC/MARC View"** for all views
4. Click **"JSON-LD"** for direct download
5. Click **"Turtle"** for RDF download

**All features are production-ready and fully functional!** 🎉

---

*Designed and developed for MOON - Professional Linked Data Library Platform*
*By Isaac Faleh - February 2026*

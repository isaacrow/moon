# 🎨 Visual Guide: Export & View Features

## Interactive Visual Documentation

---

## 📱 User Interface Layout

### MoonSand V2 Main Screen

```
┌────────────────────────────────────────────────────────────────────────┐
│  🏖️ [Untitled Record - editable]                    Status Badge      │
│  🧠 Registry-Powered • 🔗 Graph-Based • ✅ SHACL-Validatable          │
│                                                                         │
│  💾 Nodes: 3 | 🔗 Triples: 15 | 📊 Work: 1, Instance: 1, Item: 1     │
│                                                                         │
│  ┌──────────┬──────────────────┬─────────────┬──────────────┐        │
│  │ 🟢 Saved │ [💾 Save]        │ [📖 OPAC/   │ [⬇️ JSON-LD] │        │
│  │          │                  │   MARC View]│ [⬇️ Turtle]  │        │
│  └──────────┴──────────────────┴─────────────┴──────────────┘        │
│                                                                         │
│  ☐ Enable Expression Layer (FRBR Work→Expression→Instance→Item)       │
│                                                                         │
│  ┌─ Validation ───────────────────────────────────────────────┐       │
│  │ ✅ Valid BIBFRAME Record - All required fields present     │       │
│  └─────────────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  View Tabs:                                                             │
│  [Catalog] [Relationships] [Validation] [Graph] [JSON-LD] [Turtle]    │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  📘 bf:Work                                           [▼ Expand]      │
│  http://example.org/work/abc123                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Title                                                         │  │
│  │  ├─ Main Title: [Introduction to Linked Data              ]   │  │
│  │  └─ Subtitle:   [A Practical Guide                        ]   │  │
│  │                                                                │  │
│  │  Language: [English ▼]                                         │  │
│  │  Subject:  [+ Add Subject]                                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  📗 bf:Instance                                       [▼ Expand]      │
│  http://example.org/instance/def456                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Edition Statement: [First Edition                         ]   │  │
│  │  Dimensions:        [24 cm                                 ]   │  │
│  │  Extent:            [xvi, 342 pages                        ]   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  📙 bf:Item                                           [▼ Expand]      │
│  http://example.org/item/ghi789                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Held By: [Your Institution                               ]   │  │
│  │  Barcode: [ABC123456                                       ]   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎭 Button Click Flow

### Click: OPAC/MARC View Button

```
  User Interface
       │
       ├─ Validation Check
       │     │
       │     ├─ ✅ Valid → Enable Button (Purple)
       │     └─ ❌ Invalid → Disable Button (Gray)
       │
       ├─ Click "OPAC/MARC View"
       │     │
       │     └─→ Open RecordViewerDialog
       │              │
       │              ├─ Transform JSON-LD data
       │              ├─ Extract Work/Instance/Item
       │              └─ Render 3 tabs
       │
       └─ Dialog Opens
              │
              ├─ Tab 1: OPAC View
              ├─ Tab 2: Mind Map
              └─ Tab 3: MARC 21
```

---

## 🎨 RecordViewerDialog Layout

### Full Dialog View

```
┌──────────────────────────────────────────────────────────────────────┐
│  Record Viewer                          [⬇️ Download JSON-LD]  [✖]  │
│  Multi-format view: OPAC, Mind Map, and MARC 21                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │  [📖 OPAC View] [🧠 Mind Map] [📄 MARC 21]            │         │
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ╔═══════════════════════════════════════════════════════╗         │
│  ║                                                         ║         │
│  ║  [Tab Content Appears Here]                            ║         │
│  ║                                                         ║         │
│  ║  • OPAC: Catalog cards and metadata                    ║         │
│  ║  • Mind Map: SVG visualization                         ║         │
│  ║  • MARC 21: MARC fields and indicators                 ║         │
│  ║                                                         ║         │
│  ╚═══════════════════════════════════════════════════════╝         │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tab 1: OPAC View Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  📚                                                          │    │
│  │     Introduction to Linked Data                             │    │
│  │     A Practical Guide                                       │    │
│  │     by Jane Smith                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌────────────────────────┐  ┌────────────────────────┐            │
│  │ 📊 Work Information    │  │ 📦 Instance Info       │            │
│  ├────────────────────────┤  ├────────────────────────┤            │
│  │ Date: 2024            │  │ Edition: First Edition  │            │
│  │ Language: English     │  │ Dimensions: 24 cm       │            │
│  │ Content: Text         │  │ Extent: xvi, 342 pages  │            │
│  └────────────────────────┘  └────────────────────────┘            │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🏷️ Subjects & Topics                                       │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ [Linked Data] [Semantic Web] [RDF] [Ontologies]            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 🔗 Linked Data Identifiers                                  │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ Work URI: http://example.org/work/abc123                    │    │
│  │ Instance URI: http://example.org/instance/def456            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tab 2: Mind Map Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│   BIBFRAME Mind Map / خريطة ذهنية                                  │
│                                                                       │
│          📄 Title                    🏷️ Subject                      │
│           ↓                           ↓                              │
│      ┌────────────┐              ┌────────┐                         │
│      │            │              │        │                         │
│      │   🔵       │──────────────│  Topic │                         │
│      │  WORK      │              └────────┘                         │
│      │  (Blue)    │                                                 │
│      │            │──────────────┐                                  │
│      └────────────┘              │                                  │
│            │                     ↓                                  │
│            │              🌍 Language                               │
│            │               (Pink)                                   │
│            │                                                         │
│       bf:instanceOf                                                 │
│            ↓                                                         │
│      ┌────────────┐                                                 │
│      │            │                                                 │
│      │   🟢       │──────────────→ 📏 Dimensions                    │
│      │ INSTANCE   │                                                 │
│      │  (Green)   │──────────────→ 📦 Extent                        │
│      │            │                                                 │
│      └────────────┘──────────────→ 🔢 ISBN                          │
│                                                                       │
│                                                                       │
│   Legend:                                                            │
│   🔵 bf:Work      🟢 bf:Instance      ◯ Properties     ─ Relationships│
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tab 3: MARC 21 Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  MARC 21 View                                                        │
│  Machine-Readable Cataloging                                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  LEADER   00000nam  2200000Ia 4500                                  │
│  ────────────────────────────────────────────────────────────────   │
│  001       abc123                                                    │
│  003       MOON                                                      │
│  005       20260225120000                                           │
│  008       260225s2024    xxu           000 0 eng d                 │
│  ────────────────────────────────────────────────────────────────   │
│  040    ‡a MOON ‡b eng ‡c MOON ‡e rda                              │
│  ────────────────────────────────────────────────────────────────   │
│  245  00 ‡a Introduction to Linked Data :                           │
│          ‡b A Practical Guide                                       │
│          ‡c by Jane Smith                                           │
│  ────────────────────────────────────────────────────────────────   │
│  250    ‡a First Edition                                            │
│  ────────────────────────────────────────────────────────────────   │
│  300    ‡a xvi, 342 pages ‡c 24 cm                                 │
│  ────────────────────────────────────────────────────────────────   │
│  650  0 ‡a Linked Data                                             │
│  650  0 ‡a Semantic Web                                            │
│  ────────────────────────────────────────────────────────────────   │
│  856  40 ‡u http://example.org/work/abc123                          │
│          ‡z BIBFRAME Work URI                                       │
│  856  40 ‡u http://example.org/instance/def456                      │
│          ‡z BIBFRAME Instance URI                                   │
│  ────────────────────────────────────────────────────────────────   │
│                                                                       │
│  Color Legend:                                                       │
│  🔵 Field Tags  ⚫ Indicators  🟢 Subfield Codes  ⚫ Values          │
│                                                                       │
│  Generated from BIBFRAME data • MARC 21 Format for Bibliographic Data│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Transformation Flow

### From GraphStore to Views

```
┌──────────────────────────────────────────────────────────────────┐
│  GraphStore (MoonSand V2)                                         │
│  ────────────────────────────────────────────────────────────    │
│  Nodes:                                                           │
│    • Work     (http://example.org/work/abc123)                   │
│    • Instance (http://example.org/instance/def456)               │
│    • Item     (http://example.org/item/ghi789)                   │
│  Triples:                                                         │
│    • Work bf:title Title1                                         │
│    • Work bf:subject Subject1                                     │
│    • Instance bf:instanceOf Work                                  │
│    • Instance bf:extent Extent1                                   │
│    • Item bf:itemOf Instance                                      │
└──────────────────────────────────────────────────────────────────┘
                        ↓
                   toJsonLd()
                        ↓
┌──────────────────────────────────────────────────────────────────┐
│  JSON-LD Output                                                   │
│  ────────────────────────────────────────────────────────────    │
│  {                                                                │
│    "@context": { ... },                                           │
│    "@graph": [                                                    │
│      { "@id": "work/abc", "@type": "bf:Work", ... },            │
│      { "@id": "inst/def", "@type": "bf:Instance", ... },        │
│      { "@id": "item/ghi", "@type": "bf:Item", ... }             │
│    ]                                                              │
│  }                                                                │
└──────────────────────────────────────────────────────────────────┘
                        ↓
              transformForViews()
                        ↓
┌──────────────────────────────────────────────────────────────────┐
│  Transformed Data                                                 │
│  ────────────────────────────────────────────────────────────    │
│  {                                                                │
│    work: { ... },        // Extracted Work node                  │
│    instance: { ... },    // Extracted Instance node              │
│    item: { ... },        // Extracted Item node                  │
│    admin: { ... }        // Metadata                             │
│  }                                                                │
└──────────────────────────────────────────────────────────────────┘
           ↓              ↓              ↓
      OPAC View      Mind Map       MARC 21
```

---

## 🎨 Color Scheme Reference

### Entity Colors

| Entity | Primary | Secondary | Usage |
|--------|---------|-----------|-------|
| **Work** | `#3b82f6` (Blue) | `#8b5cf6` (Purple) | Gradient fill |
| **Instance** | `#10b981` (Green) | `#06b6d4` (Cyan) | Gradient fill |
| **Item** | `#f59e0b` (Orange) | `#f97316` (Orange-2) | Gradient fill |
| **Expression** | `#8b5cf6` (Purple) | `#a855f7` (Purple-2) | Gradient fill |

### Property Colors

| Property Type | Color | Hex |
|---------------|-------|-----|
| **Title** | Blue | `#3b82f6` |
| **Subject** | Green | `#10b981` |
| **Language** | Pink | `#ec4899` |
| **Classification** | Orange | `#f59e0b` |
| **Identifiers** | Cyan | `#06b6d4` |
| **Extent** | Teal | `#14b8a6` |

### UI Element Colors

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| **Save Button** | Blue | `#2563eb` | Action |
| **OPAC/MARC Button** | Purple | `#7c3aed` | View |
| **Download JSON-LD** | Green | `#16a34a` | Export |
| **Download Turtle** | Green | `#16a34a` | Export |
| **Validation Success** | Green | `#10b981` | Status |
| **Validation Error** | Red | `#ef4444` | Status |

---

## 🔄 State Transitions

### Save Status Badge

```
┌─────────────┐
│  Unsaved    │ ← Initial state
│  (Yellow)   │
└─────────────┘
      ↓ Click Save
┌─────────────┐
│  Saving...  │ ← Saving to DB
│  (Blue)     │
└─────────────┘
      ↓ Success
┌─────────────┐
│  Saved ✅   │ ← Persisted
│  (Green)    │
└─────────────┘
      ↓ Edit field
┌─────────────┐
│  Unsaved    │ ← Back to unsaved
│  (Yellow)   │
└─────────────┘
```

### Validation States

```
Empty Record → Incomplete → Warning → Valid
   (Gray)       (Yellow)    (Orange)  (Green)
     │             │           │         │
     └─ Add data ─→└─ More ──→└─ Fix ──→✅
```

---

## 📱 Responsive Behavior

### Desktop (>1024px)
```
┌────────────────────────────────────────────────────┐
│  Header with buttons (horizontal)                  │
├────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐              │
│  │  Work Info   │  │ Instance Info │              │
│  └──────────────┘  └──────────────┘              │
└────────────────────────────────────────────────────┘
```

### Tablet (768px - 1024px)
```
┌────────────────────────────────────┐
│  Header with wrapped buttons       │
├────────────────────────────────────┤
│  ┌────────────────────────┐       │
│  │  Work Information      │       │
│  └────────────────────────┘       │
│  ┌────────────────────────┐       │
│  │  Instance Information  │       │
│  └────────────────────────┘       │
└────────────────────────────────────┘
```

### Mobile (<768px)
```
┌──────────────────────┐
│  Header (stacked)    │
├──────────────────────┤
│  [Save]              │
│  [OPAC/MARC]        │
│  [JSON-LD]          │
├──────────────────────┤
│  Work Info (full)    │
│  Instance (full)     │
└──────────────────────┘
```

---

## 🎯 Interaction Patterns

### Click Interactions

```
┌─────────────────────────────────────────────────┐
│  Element             │  Action                  │
├─────────────────────────────────────────────────┤
│  Save Button         │  → Save to database      │
│  OPAC/MARC Button    │  → Open dialog           │
│  JSON-LD Button      │  → Download file         │
│  Turtle Button       │  → Download file         │
│  Entity Section      │  → Expand/Collapse       │
│  Dialog Close (X)    │  → Close dialog          │
│  Tab Header          │  → Switch view           │
│  Subject Badge       │  → (Display only)        │
│  URI Link            │  → Open in new tab       │
└─────────────────────────────────────────────────┘
```

### Hover States

```
Button States:
  Normal:   bg-blue-600
  Hover:    bg-blue-700
  Active:   bg-blue-800
  Disabled: bg-gray-400

MARC Field States:
  Normal:   bg-transparent
  Hover:    bg-blue-50

Subject Badge States:
  Normal:   bg-purple-100
  (No hover interaction)
```

---

## ✨ Animation & Transitions

### Dialog Opening
```
Opacity:   0 → 1     (300ms)
Scale:     0.95 → 1  (300ms)
Blur BG:   0 → 8px   (300ms)
```

### Tab Switching
```
Fade Out:  opacity 1 → 0     (150ms)
Fade In:   opacity 0 → 1     (150ms)
Total:     300ms
```

### Button Hover
```
Background: transition (200ms)
Shadow:     0 → 4px (200ms)
```

---

## 🎓 Accessibility Features

### ARIA Labels
```html
<button aria-label="Download JSON-LD">
<button aria-label="View OPAC and MARC 21 formats">
<dialog aria-labelledby="dialog-title">
<tab aria-selected="true">
```

### Keyboard Navigation
```
Tab:        Navigate between buttons
Enter:      Activate button
Escape:     Close dialog
Arrow keys: Switch tabs (when focused)
```

### Screen Reader Announcements
```
"Validation passed, record is valid"
"Downloading JSON-LD file"
"OPAC view tab selected"
"MARC 21 view tab selected"
```

---

## 🎉 Summary Visual

```
┌──────────────────────────────────────────────────────────────┐
│                    MOON SAND V2                               │
│              Comprehensive Export & View System               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  INPUT                                                        │
│  ─────                                                        │
│  📝 Cataloging Form → GraphStore → JSON-LD                   │
│                                                               │
│  VALIDATION                                                   │
│  ──────────                                                   │
│  ✅ SHACL Rules → Required Fields → Entity Structure         │
│                                                               │
│  OUTPUTS                                                      │
│  ───────                                                      │
│  📖 OPAC View      → User-friendly display                   │
│  🧠 Mind Map       → Visual graph                            │
│  📄 MARC 21        → Legacy format                           │
│  ⬇️ JSON-LD       → Linked Data file                        │
│  ⬇️ Turtle        → RDF file                                 │
│                                                               │
│  STORAGE                                                      │
│  ───────                                                      │
│  💾 Database       → Persistent records                      │
│  📊 Versioning     → Change tracking                         │
│  🔄 Export APIs    → External systems                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

*Complete visual reference for MOON export and viewing features*
*Designed for catalogers, developers, and system administrators*

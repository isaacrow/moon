# 🚀 Quick Start: Export & View Features

## 5-Minute Guide to JSON-LD Download, OPAC, Mind Map & MARC 21 Views

---

## Step 1: Access MoonSand V2

Navigate to **MoonSand V2** from the main dashboard:

```
Dashboard → Moon Sand V2
```

Or directly load: `/moon-sand-v2`

---

## Step 2: Create a BIBFRAME Record

### Fill in the cataloging form:

#### **Work Section** (Blue card):
```
✏️ Title
   └─ Main Title: "Introduction to Linked Data"
   └─ Subtitle: "A Practical Guide"

🌍 Language
   └─ Select: English

📚 Subject
   └─ Add: "Linked Data", "Semantic Web"
```

#### **Instance Section** (Green card):
```
📖 Edition Statement: "First Edition"
📏 Dimensions: "24 cm"
📦 Extent: "xvi, 342 pages"
📝 Responsibility Statement: "by Jane Smith"
```

#### **Item Section** (Orange card):
```
📍 Held by: Your Institution
🔢 Barcode: ABC123456
```

---

## Step 3: Validate Your Record

Watch for the validation status:

```
✅ Valid BIBFRAME Record
   ├─ 3 Nodes
   ├─ 15 Triples
   └─ Work: 1, Instance: 1, Item: 1
```

When you see the ✅ green checkmark, your record is ready!

---

## Step 4: Export & View Options

### Option A: Download JSON-LD 📥

**Click the green "JSON-LD" button**

```
┌──────────────────────────────────────┐
│  [💾 Save] [📖 OPAC/MARC] [⬇️ JSON-LD]  │
└──────────────────────────────────────┘
```

**What happens:**
- Instant download
- Filename: `bibframe-record-[timestamp].jsonld`
- Format: Standard JSON-LD with `@context` and `@graph`

**File content example:**
```json
{
  "@context": {
    "bf": "http://id.loc.gov/ontologies/bibframe/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#"
  },
  "@graph": [
    {
      "@id": "http://example.org/work/abc123",
      "@type": "bf:Work",
      "bf:title": {
        "@type": "bf:Title",
        "bf:mainTitle": "Introduction to Linked Data"
      }
    }
  ]
}
```

---

### Option B: View OPAC/Mind Map/MARC 21 👁️

**Click the purple "OPAC/MARC View" button**

```
┌──────────────────────────────────────┐
│  [💾 Save] [📖 OPAC/MARC] [⬇️ JSON-LD]  │
└──────────────────────────────────────┘
              ↑ Click here
```

**A dialog opens with 3 tabs:**

---

## Tab 1: OPAC View 📖

**What you see:**

```
┌─────────────────────────────────────────────┐
│  📚 Introduction to Linked Data             │
│     A Practical Guide                       │
│     by Jane Smith                           │
├─────────────────────────────────────────────┤
│  📊 Work Information                        │
│     Language: English                       │
│     Content Type: Text                      │
├─────────────────────────────────────────────┤
│  📦 Instance Information                    │
│     Edition: First Edition                  │
│     Dimensions: 24 cm                       │
│     Extent: xvi, 342 pages                  │
├─────────────────────────────────────────────┤
│  🏷️ Subjects & Topics                       │
│     [Linked Data] [Semantic Web]            │
├─────────────────────────────────────────────┤
│  🔗 Linked Data Identifiers                 │
│     Work URI: http://example.org/work/...   │
│     Instance URI: http://example.org/inst...│
└─────────────────────────────────────────────┘
```

**Perfect for:**
- Public catalog display
- User-facing interfaces
- Preview before publishing

---

## Tab 2: Mind Map 🧠

**What you see:**

```
       🔵 Work
    (Blue Gradient)
    "Introduction to..."
         ↓
    ┌────┴────┐
   📄        🌍
  Title    Language
          (English)
         ↓
    🟢 Instance
   (Green Gradient)
   "Physical"
         ↓
    ┌────┴────┐
   📏        📦
 Dimensions  Extent
  (24 cm)   (342 p)
```

**Features:**
- Visual graph structure
- Color-coded entities
- Relationship lines
- Property nodes
- Interactive SVG

**Perfect for:**
- Understanding BIBFRAME structure
- Teaching/training
- Quality checking relationships

---

## Tab 3: MARC 21 📄

**What you see:**

```
┌──────────────────────────────────────────────┐
│  MARC 21 View                                │
│  Machine-Readable Cataloging                 │
├──────────────────────────────────────────────┤
│  LEADER   00000nam  2200000Ia 4500           │
│  001       abc123                            │
│  003       MOON                              │
│  005       20260225120000                    │
│  040    ‡a MOON ‡b eng ‡c MOON ‡e rda       │
│  245  00 ‡a Introduction to Linked Data :   │
│          ‡b A Practical Guide               │
│          ‡c by Jane Smith                   │
│  250    ‡a First Edition                    │
│  300    ‡a xvi, 342 pages ‡c 24 cm         │
│  650  0 ‡a Linked Data                     │
│  650  0 ‡a Semantic Web                    │
│  856  40 ‡u http://example.org/work/abc123  │
│          ‡z BIBFRAME Work URI               │
└──────────────────────────────────────────────┘
```

**Features:**
- Complete MARC conversion
- Color-coded fields
- Standard indicators
- Subfield codes
- URIs preserved in 856 fields

**Perfect for:**
- Legacy system compatibility
- ILS integration
- Standard MARC exchange

---

## Bonus: Download from Dialog 🎁

While in the OPAC/MARC dialog, you can also download:

```
┌─────────────────────────────────────────────┐
│  Record Viewer    [⬇️ Download JSON-LD]  [✖]│
│  ────────────────────────────────────────── │
│  [OPAC View] [Mind Map] [MARC 21]           │
└─────────────────────────────────────────────┘
                   ↑ Click to download
```

---

## Step 5: Use Your Exports

### JSON-LD File:
✅ Import into other Linked Data systems
✅ Store in triple stores (Fuseki, GraphDB)
✅ Share with other institutions
✅ Archive in repositories

### OPAC View:
✅ Print for public display
✅ Screenshot for documentation
✅ Use in presentations

### Mind Map:
✅ Training materials
✅ Documentation
✅ Quality assurance

### MARC 21:
✅ Import into ILS systems
✅ Z39.50 exchange
✅ Legacy catalog migration

---

## 🎯 Common Workflows

### Workflow 1: Complete Cataloging Session
```
1. Create record in MoonSand V2
2. Fill all required fields
3. Validate (wait for ✅)
4. Click "OPAC/MARC View" → Preview
5. Click "JSON-LD" → Download for archival
6. Click "Save" → Store in database
```

### Workflow 2: Quick Preview
```
1. Load existing record
2. Click "OPAC/MARC View"
3. Switch between tabs to check quality
4. Close dialog
5. Make edits if needed
```

### Workflow 3: Export for Migration
```
1. Open saved record
2. Click "OPAC/MARC View"
3. Review MARC 21 tab
4. Click "Download JSON-LD" in dialog
5. Use JSON-LD for triple store
```

---

## 🆘 Troubleshooting

### ❓ "Download buttons are disabled"
**Solution:** Validate your record first. Make sure you see the green ✅ checkmark.

### ❓ "OPAC view is empty"
**Solution:** Fill in at least the Title field in the Work section.

### ❓ "Mind Map doesn't show connections"
**Solution:** Make sure you've filled Work AND Instance sections.

### ❓ "MARC 21 is missing fields"
**Solution:** Add more metadata. MARC fields are generated from available data.

---

## 💡 Pro Tips

### Tip 1: Title is Essential
Always fill in **bf:Title → Main Title** - it's used everywhere:
- OPAC header
- Mind map Work node
- MARC 245 field
- File downloads

### Tip 2: Use Auto-Save
MoonSand V2 shows save status:
- 🟢 Saved
- 🟡 Unsaved
- 🔵 Saving...
- 🔴 Error

### Tip 3: Multiple Exports
You can download:
- JSON-LD (green button)
- Turtle RDF (green button)
- Both formats at once!

### Tip 4: Keyboard Shortcuts
- `Ctrl + S`: Quick save (when implemented)
- `Esc`: Close dialog
- `Tab`: Navigate between tabs

---

## 📊 Quick Reference Card

| What | Where | Button Color |
|------|-------|--------------|
| Save to DB | Header | 🔵 Blue |
| OPAC/Mind Map/MARC | Header | 🟣 Purple |
| JSON-LD Download | Header | 🟢 Green |
| Turtle Download | Header | 🟢 Green |
| Dialog JSON-LD | Dialog Header | Outlined |

---

## 🎓 Learning Resources

### Watch For:
- **Validation Panel**: Shows what's missing
- **Graph Stats**: Node/triple count
- **Save Status Badge**: Shows persistence state

### Practice With:
1. Simple monograph (book)
2. Serial publication (journal)
3. Multi-volume work
4. Electronic resource

---

## ✅ Success Checklist

Before considering a record "complete":

- [ ] Title and Subtitle filled
- [ ] At least one subject/topic
- [ ] Language specified
- [ ] Edition statement (if applicable)
- [ ] Physical description (extent, dimensions)
- [ ] Responsibility statement
- [ ] Validation shows ✅
- [ ] OPAC view looks good
- [ ] Mind map shows connections
- [ ] MARC 21 has required fields
- [ ] JSON-LD downloaded
- [ ] Record saved to database

---

## 🎉 You're Ready!

You can now:
✅ **Download** JSON-LD and Turtle files
✅ **View** records in OPAC format
✅ **Visualize** with mind maps
✅ **Convert** to MARC 21
✅ **Export** for any system

**Happy Cataloging!** 📚✨

---

*For more details, see [DOWNLOAD_OPAC_MARC_FEATURES.md](/DOWNLOAD_OPAC_MARC_FEATURES.md)*

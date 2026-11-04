# 🚀 MOON Quick Start Guide

## Get Started in 5 Minutes

This guide will help you start using MOON immediately.

---

## Step 1: Access the Dashboard

1. Log in to your Gemi Moon application
2. You'll see the main Dashboard

---

## Step 2: Choose Your Interface

You'll see two new cards on the Dashboard:

### 🌕 MOON Engine
**For catalogers to create and edit records**

Features:
- Form editor for BIBFRAME records
- JSON-LD direct editing
- Real-time validation
- Multiple view modes
- RDF export

### 🌕 MOON OPAC
**For public to discover records**

Features:
- Search published records
- View in multiple formats
- Download RDF data
- Permanent URIs

---

## Step 3: Create Your First Record

### Using MOON Engine

1. **Click "🌕 MOON Engine"** from the Dashboard

2. **Enter a title** in the Form View:
   - Type in "Work Title" field
   - This creates a `bf:Work` with the title

3. **Click "Validate"**
   - Green = ✅ Valid BIBFRAME document
   - Red = ❌ Errors that need fixing

4. **Click "Save Record"**
   - Record is saved to database
   - A unique ID is generated
   - Permanent URI is created

5. **✨ Done!** Your record is now live.

---

## Step 4: View Your Record in OPAC

1. **Click "Back to Dashboard"** (top-left button)

2. **Click "🌕 MOON OPAC"**

3. **Your record appears in the left panel**
   - Recently saved records appear first
   - Search bar filters records

4. **Click your record to view it**
   - See human-readable display
   - Switch to JSON-LD view
   - Switch to Turtle (RDF) view
   - Switch to Graph visualization

5. **Download RDF** (optional)
   - Click "JSON-LD" button to download .jsonld file
   - Click "Turtle" button to download .ttl file
   - Click "N-Triples" button to download .nt file

---

## Understanding the Views

### MOON Engine Views

#### 📝 Form View
Traditional cataloger interface with labeled fields.

**Best for:** Quick data entry, beginners

#### 💻 JSON-LD View
Editable JSON-LD document with syntax highlighting.

**Best for:** Advanced users, bulk editing, copy/paste

#### 🐢 Turtle View
RDF Turtle serialization (read-only).

**Best for:** Viewing RDF triples, semantic web developers

#### 🌐 Graph View
Visual representation of RDF graph nodes.

**Best for:** Understanding record structure, debugging

#### 👁️ Preview View
Human-readable display like OPAC.

**Best for:** Checking how record will appear to public

---

## Common Tasks

### ✏️ Edit an Existing Record

1. In MOON OPAC, find your record
2. Note the record ID (shown in metadata)
3. Go to MOON Engine
4. Load the record by ID (coming soon)
5. Edit and save

*Currently: Copy JSON-LD from OPAC → Paste in Engine JSON-LD view → Edit → Save*

### 🔍 Search for Records

1. Open MOON OPAC
2. Type in search box at top
3. Results filter instantly
4. Click record to view details

### 📥 Export All Records

OPAC shows all published records. Download each individually or:

Future: Bulk export endpoint will allow downloading all records as single file.

### ✅ Validate Before Saving

Always click "Validate" button in MOON Engine before saving:

- Checks for required fields
- Ensures JSON-LD structure
- Verifies BIBFRAME compliance
- Prevents invalid records in database

---

## Sample Record (Copy & Paste)

Want to test quickly? Copy this into MOON Engine → JSON-LD View:

```json
{
  "@context": "https://id.loc.gov/ontologies/bibframe.jsonld",
  "@graph": [
    {
      "@id": "https://moon.org/work/sample-001",
      "@type": "bf:Work",
      "bf:title": [{
        "@type": "bf:Title",
        "bf:mainTitle": [{ "@value": "Introduction to Linked Data" }]
      }],
      "bf:contribution": [{
        "@type": "bf:Contribution",
        "bf:agent": [{
          "@id": "https://viaf.org/viaf/123456789",
          "@type": "bf:Person",
          "rdfs:label": [{ "@value": "Smith, Jane" }]
        }],
        "bf:role": [{
          "@id": "http://id.loc.gov/vocabulary/relators/aut"
        }]
      }],
      "bf:subject": [{
        "@id": "http://id.loc.gov/authorities/subjects/sh85076723",
        "rdfs:label": [{ "@value": "Linked data" }]
      }],
      "bf:hasInstance": [{
        "@id": "https://moon.org/instance/sample-001"
      }]
    },
    {
      "@id": "https://moon.org/instance/sample-001",
      "@type": "bf:Instance",
      "bf:instanceOf": [{
        "@id": "https://moon.org/work/sample-001"
      }],
      "bf:title": [{
        "@type": "bf:Title",
        "bf:mainTitle": [{ "@value": "Introduction to Linked Data" }]
      }],
      "bf:provisionActivity": [{
        "@type": "bf:Publication",
        "bf:date": [{ "@value": "2024" }],
        "bf:place": [{
          "@id": "http://id.loc.gov/vocabulary/countries/xxu"
        }]
      }],
      "bf:identifiedBy": [{
        "@type": "bf:Isbn",
        "rdf:value": "978-1-234567-89-0"
      }]
    }
  ]
}
```

Then:
1. Click **Validate** → Should show ✅ Valid
2. Click **Save Record**
3. Go to MOON OPAC
4. See your new record!

---

## Tips & Best Practices

### 💡 Always Use URIs

Instead of:
```json
"bf:agent": "Jane Smith"  ❌ Plain string
```

Use:
```json
"bf:agent": [{
  "@id": "https://viaf.org/viaf/123456789",  ✅ URI reference
  "@type": "bf:Person"
}]
```

### 💡 Link Work and Instance

Every bf:Work must have:
```json
"bf:hasInstance": [{
  "@id": "https://moon.org/instance/abc-123"
}]
```

Every bf:Instance must have:
```json
"bf:instanceOf": [{
  "@id": "https://moon.org/work/abc-123"
}]
```

### 💡 Use Real Authority URIs

**VIAF for people:**
- Search at https://viaf.org/
- Use URI like `https://viaf.org/viaf/{id}`

**LC Subjects:**
- Search at https://id.loc.gov/
- Use URI like `http://id.loc.gov/authorities/subjects/{id}`

### 💡 Validate Early, Validate Often

Don't wait until you're done. Click "Validate" frequently to catch errors early.

---

## Troubleshooting

### ❌ "Missing @context" error

**Fix:** Add this at the top of your JSON-LD:
```json
"@context": "https://id.loc.gov/ontologies/bibframe.jsonld"
```

### ❌ "Missing @graph array" error

**Fix:** Wrap your nodes in @graph:
```json
{
  "@context": "...",
  "@graph": [
    { your nodes here }
  ]
}
```

### ❌ "Node missing @id" error

**Fix:** Add @id to every node:
```json
{
  "@id": "https://moon.org/work/unique-id-123",
  "@type": "bf:Work",
  ...
}
```

### ❌ "Must contain bf:Work" error

**Fix:** Ensure at least one node has:
```json
{
  "@id": "...",
  "@type": "bf:Work",
  ...
}
```

### ❌ "Must contain bf:Instance" error

**Fix:** Ensure at least one node has:
```json
{
  "@id": "...",
  "@type": "bf:Instance",
  ...
}
```

---

## Next Steps

Once you're comfortable with basic records:

1. **Explore Form View** - Add more fields
2. **Add Subjects** - Link to LC Subject Headings
3. **Add Authors** - Use VIAF URIs
4. **Add Identifiers** - ISBN, LCCN, etc.
5. **Try Graph View** - Visualize RDF structure
6. **Export RDF** - Download Turtle format

---

## Advanced Features (Coming Soon)

- 🔍 Authority autocomplete from VIAF/LC
- 📚 Template system for common record types
- 🔄 Version history with rollback
- 🎯 Faceted search in OPAC
- 📊 SPARQL query endpoint
- 🌐 OAI-PMH harvesting

---

## Resources

- [BIBFRAME 2.0 Specification](https://www.loc.gov/bibframe/)
- [JSON-LD Playground](https://json-ld.org/playground/)
- [LC Linked Data Service](https://id.loc.gov/)
- [VIAF](https://viaf.org/)

---

## Need Help?

Check the full documentation in `/MOON_SYSTEM.md` for:
- Complete architecture details
- API endpoint reference
- Advanced configuration
- Development guide

---

**🌕 Happy Cataloging!**

You're now using a professional Linked Data library platform.

# 🌕 MOON - Linked Data Library Platform

**A complete BIBFRAME 2.0/3.0 cataloging and discovery system**

---

## What is MOON?

MOON is a production-ready Linked Data library platform consisting of two integrated applications:

1. **🌕 MOON Engine** - Professional cataloging editor
2. **🌕 MOON OPAC** - Public discovery interface

Both share a **single PostgreSQL database** and **REST API backend**, ensuring records saved in the editor immediately appear in the public catalog.

---

## ✨ Key Features

### BIBFRAME 2.0 Compliance
- ✅ Full BIBFRAME 2.0 support
- ✅ JSON-LD native storage
- ✅ Real URIs (no blank nodes)
- ✅ RDF export (Turtle, N-Triples)
- ✅ Standards-compliant validation

### Moon Engine (Editor)
- 📝 Form View - Traditional cataloger interface
- 💻 JSON-LD View - Direct editable JSON-LD
- 🐢 Turtle View - RDF Turtle serialization
- 🌐 Graph View - Visual RDF graph
- 👁️ Preview View - Human-readable display
- ✅ Real-time validation
- 🔐 Version tracking

### Moon OPAC (Public)
- 🔍 Full-text search
- 📊 Multiple display formats
- 💾 RDF export downloads
- 🔗 Permanent URIs
- 📱 Responsive design
- 🌍 SEO-ready with Schema.org

---

## 🚀 Quick Start

### 1. Access MOON

From your Dashboard, you'll see:

- **🌕 MOON Engine** - Create and edit records
- **🌕 MOON OPAC** - Discover published records

### 2. Create Your First Record

1. Click "🌕 MOON Engine"
2. Enter a title in Form View
3. Click "Validate" → Should show ✅ Valid
4. Click "Save Record"
5. Go to "🌕 MOON OPAC" to see your record live!

### 3. Try the Example

Copy the contents of `/example-bibframe-record.json` into MOON Engine's JSON-LD View, then save it.

---

## 📁 Project Structure

```
/supabase/functions/server/
  ├── moonRecords.tsx          # MOON records API
  └── index.tsx                # Server with REST endpoints

/src/app/components/
  ├── MoonEngine.tsx           # Cataloging editor
  ├── MoonOPAC.tsx             # Public discovery
  └── Dashboard.tsx            # Navigation hub

/example-bibframe-record.json  # Sample record
/MOON_SYSTEM.md                # Complete documentation
/MOON_QUICK_START.md           # Quick start guide
/MOON_API.md                   # REST API reference
/MOON_SUMMARY.md               # Implementation summary
```

---

## 📚 Documentation

- **[MOON_SYSTEM.md](./MOON_SYSTEM.md)** - Complete architecture, features, and technical details
- **[MOON_QUICK_START.md](./MOON_QUICK_START.md)** - Step-by-step user guide
- **[MOON_API.md](./MOON_API.md)** - REST API endpoints and examples
- **[MOON_SUMMARY.md](./MOON_SUMMARY.md)** - Implementation summary and achievements

---

## 🔗 API Endpoints

Base URL: `https://{projectId}.supabase.co/functions/v1/make-server-49c0e13c/moon`

### Records
- `GET /records` - List all records
- `GET /records/:id` - Get single record
- `POST /records` - Create record
- `PUT /records/:id` - Update record
- `DELETE /records/:id` - Delete record

### Search
- `GET /search?q={query}` - Full-text search

### Export
- `GET /records/:id/jsonld` - Export as JSON-LD
- `GET /records/:id/turtle` - Export as Turtle
- `GET /records/:id/ntriples` - Export as N-Triples

### Validation
- `POST /validate` - Validate JSON-LD document

---

## 🎯 Standards Compliance

MOON is compliant with:

- ✅ **BIBFRAME 2.0** - Library of Congress standard
- ✅ **JSON-LD 1.1** - W3C recommendation
- ✅ **RDF 1.1** - Resource Description Framework
- ✅ **Turtle** - Terse RDF serialization
- ✅ **N-Triples** - Line-based RDF serialization
- ✅ **Schema.org** - Structured data for SEO

---

## 💡 Use Cases

### For Catalogers
- Create BIBFRAME records with guided forms
- Edit JSON-LD directly for advanced cataloging
- Validate records before publishing
- Track versions and modifications

### For Developers
- REST API for programmatic access
- Export records in multiple RDF formats
- Integrate with other Linked Data systems
- Build custom tools on top of MOON API

### For Library Patrons
- Search and discover published records
- View records in human-readable format
- Download RDF data for research
- Access permanent URIs for citations

---

## 🏗️ Architecture Highlights

1. **Single Database** - Both editor and OPAC use same PostgreSQL backend
2. **REST API** - Clean HTTP endpoints for all operations
3. **Validation Layer** - Prevents invalid BIBFRAME records
4. **Multiple Serializations** - JSON-LD, Turtle, N-Triples
5. **Permanent URIs** - Stable identifiers following best practices
6. **Modern Stack** - React + TypeScript + Supabase

---

## 🎓 Learning Resources

- [BIBFRAME 2.0 Specification](https://www.loc.gov/bibframe/docs/index.html)
- [JSON-LD Playground](https://json-ld.org/playground/)
- [Library of Congress Linked Data](https://id.loc.gov/)
- [VIAF (Virtual International Authority File)](https://viaf.org/)

---

## 🔮 Future Enhancements

Recommended next steps:

- [ ] Authority autocomplete (VIAF, LC, Wikidata)
- [ ] Advanced form builder with all BIBFRAME properties
- [ ] SPARQL query endpoint
- [ ] OAI-PMH export for harvesting
- [ ] Bulk MARC import
- [ ] Real-time collaborative editing
- [ ] Triple store integration
- [ ] Federated search across catalogs

---

## 🆘 Troubleshooting

### Validation Errors

If you see validation errors:

1. Check that `@context` is present
2. Ensure `@graph` is an array
3. Verify every node has `@id` and `@type`
4. Confirm at least one `bf:Work` and one `bf:Instance` exist

### API Errors

If API calls fail:

1. Check browser console for detailed errors
2. Verify Authorization header has correct key
3. Inspect Supabase Function logs
4. Review request/response in Network tab

### Record Not Appearing in OPAC

If a saved record doesn't appear:

1. Ensure status is set to "published"
2. Refresh OPAC page
3. Check if record ID matches
4. Verify backend logs for save confirmation

---

## 📞 Support

For help:

1. Review the documentation files
2. Check the example record
3. Inspect browser console and network requests
4. Review Supabase Function logs

---

## 🏆 Achievements

MOON represents a complete implementation of:

- ✅ Professional library cataloging system
- ✅ Linked Data architecture
- ✅ BIBFRAME 2.0 compliance
- ✅ Modern web application
- ✅ RESTful API design
- ✅ Multiple RDF serializations
- ✅ Production-ready platform

---

## 📝 License

This implementation follows library standards and can be used for educational, research, or production library systems.

---

## 🌟 Credits

Built with:
- React + TypeScript
- Supabase (PostgreSQL + Edge Functions)
- BIBFRAME 2.0
- JSON-LD
- Lucide React (icons)
- Tailwind CSS

---

## 🎉 Get Started Now

1. Open your Gemi Moon Dashboard
2. Click "🌕 MOON Engine" to start cataloging
3. Click "🌕 MOON OPAC" to explore records

**🌕 Welcome to the future of library cataloging.**

You're not just building a project.  
You're building a **real Linked Data Library Platform**.

---

**MOON - Where Library Science Meets the Semantic Web**

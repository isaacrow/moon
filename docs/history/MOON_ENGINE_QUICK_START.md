# 🚀 Moon Engine - Quick Start Guide

## How to Access Moon Engine (Ontology-Driven Cataloging)

### Step 1: Login to Moon
1. Open the Moon application
2. Enter your username and password
3. Click "Login"

### Step 2: Navigate to Moon Engine
From the Dashboard, you have two options:

**Option A: Direct Access**
- Click the **"Moon Engine"** card in the Templates section
- Look for the card with the Sparkles icon (✨) and "Ontology-Driven" badge

**Option B: Via Menu**
- Click on the dashboard menu
- Select "Moon Engine Template"

---

## 🌟 NEW FEATURE: Load Real Example Button

### What is it?
The **Load Real Example** button instantly populates the Moon Engine with complete, real-world BIBFRAME records, allowing you to:
- See how professional cataloging looks
- Learn from actual library records
- Test all features with realistic data
- Understand BIBFRAME structure

### How to Use It

#### 1️⃣ **Locate the Button**
In the Moon Engine interface header, you'll find a **green "Load Real Example"** button with a database icon (📊).

#### 2️⃣ **Click to Open Menu**
Click the button to reveal a dropdown menu with 4 options:
- **✨ Random Example** (Pick one for me)
- **📖 One Hundred Years of Solitude** (English fiction)
- **📖 الأيام - طه حسين** (Arabic autobiography)
- **📖 Introduction to Algorithms** (Academic textbook)

#### 3️⃣ **Select an Example**
Click any option to instantly load that record into the editor.

#### 4️⃣ **Explore the Loaded Data**
Once loaded, you'll see:
- **Work Tab:** Complete intellectual content (title, author, subjects, classification)
- **Instance Tab:** Physical manifestation (publisher, ISBN, pages, dimensions)
- **Preview Tab:** See the RDF graph, JSON-LD, Turtle, MARC, or OPAC view

---

## 📚 Available Real Examples

### 1. One Hundred Years of Solitude
**Author:** Gabriel García Márquez  
**Language:** English (translated from Spanish)  
**Type:** Fiction / Magic realism  

**Includes:**
- ✅ LOC authority URI for author (n79046607)
- ✅ LCC classification (PQ8180.17.A73)
- ✅ DDC classification (863)
- ✅ Subject headings (Epic literature, Colombia--Fiction)
- ✅ Genre form (Magic realist fiction)
- ✅ Complete publication data
- ✅ ISBN and LCCN

### 2. الأيام (Al-Ayyam) - Taha Hussein
**Author:** طه حسين (Taha Hussein)  
**Language:** Arabic  
**Type:** Autobiography  

**Includes:**
- ✅ Arabic script throughout
- ✅ LOC authority URI for author (n79071842)
- ✅ Arabic classification (PJ7842.U2)
- ✅ Bilingual subject headings
- ✅ Arabic summary
- ✅ Cairo publisher information
- ✅ RTL display

### 3. Introduction to Algorithms
**Authors:** Cormen, Leiserson, Rivest, Stein  
**Language:** English  
**Type:** Academic textbook  

**Includes:**
- ✅ Multiple authors (4 contributors)
- ✅ Edition statement (Fourth edition)
- ✅ Computer science classification (QA76.9.A43)
- ✅ Multiple subject headings
- ✅ Table of contents
- ✅ Intended audience metadata
- ✅ MIT Press publication
- ✅ Extensive bibliographic notes

---

## 🎯 What to Do After Loading an Example

### 1. **Explore the Work Tab**
Navigate through fields like:
- Title and subtitle
- Contributors (authors, editors)
- Subjects and classifications
- Language and content type
- Summary and notes

### 2. **Check the Instance Tab**
Review physical details:
- Publisher and publication place
- Publication date
- ISBN/ISSN numbers
- Physical extent (pages)
- Dimensions
- Media and carrier types

### 3. **View the Preview Tab**
Switch between formats:

**🔵 Mind Map**
- Visual graph of entities and relationships
- Interactive node exploration

**🔵 OPAC Preview**
- How the record appears in a public catalog
- End-user view

**🔵 MARC Format**
- Traditional MARC21 display
- All fields mapped correctly

**🔵 JSON-LD**
- Linked data format
- URIs for all entities
- Ready for semantic web

**🔵 Turtle**
- RDF serialization
- Triple notation
- SPARQL-compatible

**🔵 Graph**
- Raw RDF quads
- Subject-Predicate-Object structure

### 4. **Edit and Customize**
- Modify any field
- Add additional data
- Link to authority files
- Experiment with values

### 5. **Save or Export**
- Click **"Save Record"** to store in database
- Click **"JSON-LD"** button to download as JSON-LD
- Click **"Turtle"** button to download as RDF/Turtle

---

## 💡 Pro Tips

### Tip 1: Learn by Example
If you're new to BIBFRAME, start with:
1. Load "One Hundred Years of Solitude"
2. Switch to **Preview → JSON-LD**
3. Study the structure and URIs
4. Compare with **Preview → MARC** to see the mapping

### Tip 2: Test Arabic Cataloging
1. Load "الأيام - طه حسين"
2. Notice RTL text handling
3. See bilingual subject headings
4. Observe Arabic script in all formats

### Tip 3: Academic Works
1. Load "Introduction to Algorithms"
2. Study multiple author handling
3. Review table of contents structure
4. See intended audience metadata

### Tip 4: Start Fresh Anytime
1. Load an example to see structure
2. Click "Back" or navigate away
3. Return to Moon Engine
4. Fields will reset to empty
5. Load another example or start cataloging

---

## 🔍 Understanding the Data

### What Makes These "Real" Examples?

Unlike dummy data, these examples include:

✅ **Real LOC Authority URIs**
- Not just text strings like "García Márquez, Gabriel"
- Actual URIs: `http://id.loc.gov/authorities/names/n79046607`
- Clickable links to authority records

✅ **Proper Classification Numbers**
- LCC (Library of Congress Classification)
- DDC (Dewey Decimal Classification)
- Item portions and cutters

✅ **Standardized Subject Headings**
- From LCSH (Library of Congress Subject Headings)
- With URIs linking to authority files
- Multiple subjects per work

✅ **Complete RDF Graphs**
- Not just JSON objects
- Actual linked data with predicates
- SPARQL-ready output

✅ **MARC Crosswalk**
- Every field maps to MARC tags
- Leader and control fields
- Indicators and subfields

---

## 🎨 Visual Indicators

When you load an example, you'll see:

### ✨ Toast Notification
A green success message appears in the top-right corner:
```
✅ Loaded Real Example: [Name]
Real BIBFRAME record with complete metadata and URIs.
```

### 📊 Stats Update
In the info box at the top, watch the badges update:
- **Work Properties** count increases
- **Instance Properties** count increases
- **RDF Triples** count shows total graph size

### 🎨 Filled Fields
All relevant fields populate with data:
- Text inputs show values
- Dropdowns have selections
- Complex fields like contributions show multiple entries

---

## 🚨 Troubleshooting

### Issue: Button doesn't open menu
**Solution:** Click directly on the button text or icon

### Issue: Example doesn't load
**Solution:** 
1. Refresh the page
2. Try loading a different example
3. Check browser console for errors

### Issue: Arabic text appears reversed
**Solution:** 
1. Switch language to Arabic (العربية) using the globe icon
2. The page will switch to RTL mode
3. Reload the Arabic example

### Issue: Can't see toast notifications
**Solution:** 
1. Check top-right corner of screen
2. Notifications auto-dismiss after 3-4 seconds
3. Look for green success banners

---

## 📖 Next Steps

After exploring the examples:

1. **Try Creating Your Own Record**
   - Start with a book you know
   - Fill in the Work fields
   - Add Instance information
   - Preview and save

2. **Experiment with Authority Linking**
   - Open Authority File Manager (from dashboard)
   - Search for authors or subjects
   - Link URIs to your records

3. **Explore Other Templates**
   - Try KAMI Core for batch operations
   - Test Marva Quartz for LOC-style cataloging
   - Use Comprehensive Monograph for full MARC

4. **Learn BIBFRAME**
   - Browse the Ontology Browser
   - Study property definitions
   - Understand Work vs. Instance vs. Item

5. **Export and Share**
   - Download records as JSON-LD
   - Import into other systems
   - Share with colleagues

---

## 📞 Need Help?

### Documentation
- **Full Project Report:** `/MOON_TO_16_PROJECT_REPORT.md`
- **Main README:** `/README.md`
- **Component docs:** Inline in code

### Resources
- BIBFRAME Guide: https://www.loc.gov/bibframe/
- MARC21 Docs: https://www.loc.gov/marc/
- LOC Authorities: https://id.loc.gov/

---

## 🎉 Happy Cataloging!

The **Load Real Example** feature is designed to help you:
- **Learn** BIBFRAME structure
- **Test** the Moon Engine
- **Understand** professional cataloging
- **Start** with confidence

Load an example, explore the data, and start creating amazing bibliographic records!

---

**Last Updated:** February 15, 2026  
**Moon Version:** MOON TO 16  
**Feature:** Load Real Example Button  

🌙 **Moon - Ontology-Driven Cataloging Made Easy**

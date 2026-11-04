# 🧪 How to See the New Fields in BlueMoon

## Quick Test Guide

### Step 1: Open BlueMoon
1. Go to your MOON SAND V2 dashboard
2. Click on **Blue Moon** card
3. Create a new Work or open an existing one

### Step 2: Expand the Work Entity
1. Look for the **"Work"** section (blue icon with BookOpen)
2. Click to **expand** the Work section if it's collapsed
3. **Scroll down** past the existing categories

### Step 3: Look for NEW Categories
You should now see these NEW category headers:

#### ✅ **Work Metadata** (NEW!)
Contains:
- **Date of Work** - EDTF format input (YYYY, YYYY-MM-DD, YYYY/YYYY)
- **Country/Place of Origin** - Authority search dropdown
- **Government Publication** - Dropdown with 7 types

#### ✅ **Accessibility** (NEW!)
Contains:
- **Accessibility Content** - Multi-select grid with 9 features:
  - Large print, Braille, Audio description
  - Captions, Sign language, Tactile graphics
  - Screen reader compatible, High contrast, Accessible PDF
- **Notation** - Dropdown with 5 types:
  - Braille code, Music notation, Mathematical notation
  - Movement notation, Tactile notation

#### ✅ **Academic Information** (NEW!)
Contains:
- **Dissertation** - Structured modal editor
  - Click "Edit" to open modal
  - Fields: Degree, Institution, Year, Identifier, Note

#### ✅ **Subject Access** (NEW!)
Contains:
- **Temporal Coverage** - Structured modal editor
  - Click "Edit" to open modal
  - Fields: Start Date, End Date, Textual Description

#### ✅ **Series Information** (NEW!)
Contains:
- **Series Statement** - Structured modal editor
  - Click "Edit" to open modal
  - Fields: Series Title, Enumeration, ISSN, Relationship

### Step 4: Expand the Instance Entity
1. Look for the **"Instance"** section (green icon with Package)
2. Click to **expand** the Instance section
3. **Scroll down** to see new fields

#### ✅ **Publication Information** (NEW!)
Contains:
- **Projected Publication Date** - YYMM format (e.g., 2603 for March 2026)

#### ✅ **Acquisition Information** (NEW!)
Contains:
- **Acquisition Source** - Structured modal editor
  - Click "Edit" to open modal
  - Fields: Stock Number, Source Organization, Terms, Note
- **Immediate Source of Acquisition** - Structured modal editor
  - Click "Edit" to open modal
  - Fields: Source Name, Date, Method, Institution, Note

### Step 5: Test Administrative Metadata
1. Scroll to **"Admin Metadata"** section
2. Look for:

#### ✅ **Administrative Metadata** (NEW!)
Contains:
- **Description Authentication** - Dropdown with 4 codes:
  - PCC, NSDP, Authenticated, Non-authenticated
- **Description Modifier** - Authority search for organizations

---

## 🔍 If You Still Don't See the Fields

### Possible Issues:

#### Issue 1: Categories Not Expanded
- By default, only the first 2 categories in each entity are expanded
- **Solution:** Click the category headers to expand them

#### Issue 2: Browser Cache
- Your browser might be using cached JavaScript
- **Solution:** 
  - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
  - Or clear browser cache

#### Issue 3: Development Server Not Restarted
- Changes might not be loaded if dev server wasn't restarted
- **Solution:** Restart your development server

#### Issue 4: Wrong Entity Type
- Some fields are Work-specific, others are Instance-specific
- **Solution:** Make sure you're looking at the right entity:
  - **Work** → Work Metadata, Accessibility, Academic Info, Temporal Coverage, Series
  - **Instance** → Projected Date, Acquisition Source, Immediate Acquisition
  - **Admin Metadata** → Description Authentication, Description Modifier

---

## 📸 What You Should See

### Example: Work Metadata Category
```
┌─────────────────────────────────────────────┐
│ 📊 Work Metadata                      ▼     │
├─────────────────────────────────────────────┤
│                                             │
│ Date of Work                                │
│ ┌─────────────────────────────────────────┐ │
│ │ YYYY, YYYY-MM-DD, or YYYY/YYYY          │ │
│ └─────────────────────────────────────────┘ │
│ 📝 EDTF Format: Use Extended Date/Time...  │
│                                             │
│ Country/Place of Origin                     │
│ ┌─────────────────────────────────────────┐ │
│ │ Search for country or place... 🔍       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Government Publication                      │
│ ┌─────────────────────────────────────────┐ │
│ │ Select type... ▼                        │ │
│ └─────────────────────────────────────────┘ │
└────────────────────────��────────────────────┘
```

### Example: Accessibility Category
```
┌─────────────────────────────────────────────┐
│ ♿ Accessibility                       ▼     │
├─────────────────────────────────────────────┤
│                                             │
│ Accessibility Content                       │
│ ┌─────────────┬─────────────────────────────┤
│ │ Large print │ Braille                     │
│ ├─────────────┼─────────────────────────────┤
│ │ Captions    │ Sign language               │
│ └─────────────┴─────────────────────────────┘
│ (Click to select multiple)                  │
│                                             │
│ Notation                                    │
│ ┌─────────────────────────────────────────┐ │
│ │ Select notation type... ▼               │ │
│ │ - Braille code                          │ │
│ │ - Music notation                        │ │
│ │ - Mathematical notation                 │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 🛠️ Quick Debugging

### Open Browser Console
1. Press `F12` to open DevTools
2. Go to **Console** tab
3. Type this command:

```javascript
// Check if new properties are loaded
import('./services/ontologyRegistry').then(m => {
  const workProps = m.getPropertiesByDomain('Work');
  console.log('Work properties:', workProps.length);
  console.log('New fields:', workProps.filter(p => 
    p.inputComponent === 'EDTFDateInput' || 
    p.inputComponent === 'DissertationEditor'
  ));
});
```

### Check Network Tab
1. In DevTools, go to **Network** tab
2. Reload the page
3. Look for `ontologyRegistry` in the loaded files
4. Click on it and verify it contains the new properties

---

## ✅ Success Criteria

You know it's working when you see:
- [ ] "Work Metadata" category in Work section
- [ ] "Date of Work" field with EDTF format hint
- [ ] "Accessibility" category with multi-select grid
- [ ] "Dissertation" field with "Edit" button
- [ ] "Temporal Coverage" field with modal editor
- [ ] "Series Information" category
- [ ] "Acquisition Information" in Instance section
- [ ] "Description Authentication" in Admin Metadata

---

## 🆘 Still Not Working?

If you've tried everything above and still don't see the fields:

1. **Check the file paths** - Make sure the files were actually saved:
   - `/src/services/ontologyRegistry.ts`
   - `/src/app/components/cataloging/BlankNodeEditors.tsx`
   - `/src/services/authoritySearch.ts`
   - `/src/app/components/cataloging/OntologyDrivenFormRenderer.tsx`

2. **Restart dev server** completely
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart
   npm run dev
   # or
   pnpm dev
   ```

3. **Clear all caches**
   - Browser cache (Ctrl+Shift+Delete)
   - Node modules cache (optional):
     ```bash
     rm -rf node_modules/.cache
     ```

4. **Check for TypeScript errors**
   - Look for red squiggly lines in your IDE
   - Run: `npm run type-check` or `tsc --noEmit`

---

Let me know what you see and I'll help debug further!

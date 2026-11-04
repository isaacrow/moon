# Feature Examples - Complete Backend Integration

## 1. Save Record to Backend

### How It Works Now
When you click "Save Record", the system:
1. Validates your data
2. Generates complete BIBFRAME record
3. Sends to Supabase backend via REST API
4. Stores in PostgreSQL-backed KV store
5. Returns saved record with ID
6. Caches locally for offline access

### Example: Saving a Book
```
Fill in the form:
├─ Title: "Moby-Dick"
├─ Subtitle: "or, The Whale"
├─ Creator: "Melville, Herman, 1819-1891" (from LOC)
├─ LCC: "PS2384"
├─ DDC: "813.3"
├─ Subject: "Whaling--Fiction" (from LCSH)
├─ Genre: "Adventure fiction" (from LCGFT)
├─ Publisher: "Harper & Brothers"
├─ Place: "New York"
├─ Date: "1851"
└─ ISBN: "978-0-142-43720-7"

Click "Save Record"
→ Saved as: record_demo_1708099234567
→ Appears in "All Records"
→ Persists after page refresh
```

## 2. MARC View - Comprehensive Display

### What You'll See
The MARC view now shows a complete MARC21 record with all fields you entered.

### Example: Complete MARC Record
```marc
LEADER     00000nam  2200000Ia 4500
001        record_demo_1708099234567
003        MOON
005        20260216120000
008        2602161851    xxu           000 0 eng d
020        $a978-0-142-43720-7
040        $aMOON $beng $cMOON $erda
050  00    $aPS2384
082  00    $a813.3
100  1     $aMelville, Herman, 1819-1891 $0http://id.loc.gov/authorities/names/n79006936
245  10    $aMoby-Dick : $bor, The Whale
264   1    $aNew York $bHarper & Brothers $c1851
650   0    $aWhaling--Fiction $0http://id.loc.gov/authorities/subjects/sh85146003
655   7    $aAdventure fiction $2lcgft
856  40    $uhttp://id.loc.gov/resources/works/12345 $zBIBFRAME Work URI
```

### Field Breakdown
- **LEADER**: Automatically generated
- **001**: Your unique record ID
- **003**: Control number identifier (MOON)
- **005**: Last update timestamp
- **008**: Fixed-length data elements
- **020**: ISBN you entered
- **040**: Cataloging source
- **050**: LC classification you entered
- **082**: Dewey classification you entered
- **100**: Main entry (creator from LOC)
- **245**: Title with subtitle
- **264**: Publication data (place, publisher, date)
- **650**: Subject heading from LCSH
- **655**: Genre from LCGFT
- **856**: Electronic location (BIBFRAME URI)

## 3. Export Functionality

### JSON-LD Export Format
Complete record with all nested data preserved.

### Example: Exported Record
```json
{
  "@context": {
    "bf": "http://id.loc.gov/ontologies/bibframe/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  },
  "@type": "bf:Work",
  "@id": "work:1708099234567",
  
  "work": {
    "@type": ["bf:Text"],
    
    "bf:title": {
      "@type": "bf:Title",
      "bf:mainTitle": "Moby-Dick",
      "bf:subtitle": "or, The Whale"
    },
    
    "bf:contribution": [{
      "@type": "bf:Contribution",
      "bf:agent": {
        "@id": "http://id.loc.gov/authorities/names/n79006936",
        "rdfs:label": "Melville, Herman, 1819-1891"
      },
      "bf:role": {
        "@id": "http://id.loc.gov/vocabulary/relators/aut",
        "rdfs:label": "author"
      }
    }],
    
    "bf:classification": [
      {
        "@type": "bf:ClassificationLcc",
        "bf:classificationPortion": "PS2384"
      },
      {
        "@type": "bf:ClassificationDdc",
        "bf:classificationPortion": "813.3"
      }
    ],
    
    "bf:subject": [{
      "@type": "bf:Topic",
      "@id": "http://id.loc.gov/authorities/subjects/sh85146003",
      "rdfs:label": "Whaling--Fiction"
    }],
    
    "bf:genreForm": [{
      "@type": "bf:GenreForm",
      "rdfs:label": "Adventure fiction"
    }]
  },
  
  "instance": {
    "@type": "bf:Instance",
    
    "bf:title": {
      "@type": "bf:Title",
      "bf:mainTitle": "Moby-Dick",
      "bf:subtitle": "or, The Whale"
    },
    
    "bf:provisionActivity": [{
      "@type": "bf:Publication",
      "bf:place": { "rdfs:label": "New York" },
      "bf:agent": { "rdfs:label": "Harper & Brothers" },
      "bf:date": "1851"
    }],
    
    "bf:identifiedBy": [{
      "@type": "bf:Isbn",
      "rdf:value": "978-0-142-43720-7"
    }]
  }
}
```

### All Data Preserved
- ✅ Work entity with all properties
- ✅ Instance entity with all properties  
- ✅ Complete contributions (agents, roles)
- ✅ All classifications (LCC, DDC)
- ✅ All subjects with URIs
- ✅ Genre/form terms
- ✅ Publication data
- ✅ Identifiers (ISBN, ISSN, etc.)
- ✅ Physical description
- ✅ Notes and summaries
- ✅ Series information
- ✅ Languages
- ✅ BIBFRAME URIs

## 4. Import Functionality

### Supported Formats
1. **Moon Format** (what we export):
   ```json
   {
     "work": { ... },
     "instance": { ... },
     "@context": { ... }
   }
   ```

2. **Standard BIBFRAME**:
   ```json
   {
     "@graph": [
       { "@type": "bf:Work", ... },
       { "@type": "bf:Instance", ... }
     ]
   }
   ```

3. **Single Entity**:
   ```json
   {
     "@type": "bf:Work",
     "bf:title": { ... }
   }
   ```

### Import Process
1. Click import button in cataloging form
2. Select .json file (previously exported)
3. System parses JSON-LD
4. Detects structure automatically
5. Populates all form fields
6. Ready to edit or save

### Example: Round-Trip Test
```
1. Create record with 20+ fields filled
2. Click "Export JSON-LD"
3. Download: bibframe-record-1708099234567.json
4. Start new record (clear form)
5. Click import
6. Select downloaded file
7. All 20+ fields restored perfectly!
```

## 5. OPAC View - Public Display

### What's Shown Now
Complete bibliographic display with all entered data.

### Example: OPAC Display
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MOBY-DICK
or, The Whale

👤 Melville, Herman, 1819-1891

📅 Harper & Brothers, 1851

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BIBLIOGRAPHIC INFORMATION

📊 Identifiers
   ISBN: 978-0-142-43720-7

📚 Edition
   First Edition

📝 Statement of Responsibility
   Herman Melville

📖 Series
   American Classics Series ; Volume 5

📐 Physical Description
   Extent: 635 pages
   Dimensions: 24 cm

🌍 Language
   English

🏷️ Subjects
   • Whaling--Fiction
   • Sea stories
   • Psychological fiction
   • Ahab, Captain (Fictitious character)--Fiction

🎭 Genre/Form
   • Adventure fiction
   • Sea stories
   • Psychological fiction

📋 Classification
   LCC: PS2384
   DDC: 813.3

📄 Summary
   The story of Captain Ahab's obsessive quest 
   to destroy the white whale that took his leg.

📑 Contents
   Chapter 1. Loomings
   Chapter 2. The Carpet-Bag
   ...

📝 Notes
   • First published in London as "The Whale"
   • Considered one of the greatest American novels
   • Based on real events including the sinking 
     of the Essex

👥 Contributors
   • Rockwell Kent (illustrator)
   • Alfred Kazin (editor)

🔗 Linked Data
   Work URI: http://id.loc.gov/resources/works/...
   Instance URI: http://id.loc.gov/resources/instances/...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### All Sections Display
- ✅ Title and subtitle
- ✅ Creators with links
- ✅ Publication info
- ✅ All identifiers
- ✅ Edition statement
- ✅ Responsibility statement
- ✅ Series information
- ✅ Physical description
- ✅ Languages
- ✅ All subjects (linked)
- ✅ Genre/form terms
- ✅ Classification numbers
- ✅ Summary text
- ✅ Table of contents
- ✅ All notes
- ✅ Contributors with roles
- ✅ BIBFRAME URIs

## 6. All Records View

### Backend Integration
Shows all records saved to Supabase database.

### Example: Records Grid
```
┌─────────────────────────────────────────────────────┐
│ All Records (Showing 3 of 3)                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Cover] Moby-Dick                                   │
│         or, The Whale                               │
│         👤 Melville, Herman                         │
│         📅 Harper & Brothers, 1851                  │
│         🏷️ Adventure fiction                        │
│         📅 Created: Feb 16, 2026 12:00 PM           │
│         🕐 Modified: Feb 16, 2026 12:05 PM          │
│         [Load Record] [Delete]                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Cover] The Great Gatsby                            │
│         👤 Fitzgerald, F. Scott                     │
│         📅 Scribner, 1925                           │
│         🏷️ Fiction                                  │
│         📅 Created: Feb 15, 2026 3:30 PM            │
│         🕐 Modified: Feb 15, 2026 3:30 PM           │
│         [Load Record] [Delete]                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [Cover] To Kill a Mockingbird                       │
│         👤 Lee, Harper                              │
│         📅 J. B. Lippincott & Co., 1960             │
│         🏷️ Legal stories                           │
│         📅 Created: Feb 14, 2026 9:15 AM            │
│         🕐 Modified: Feb 14, 2026 9:15 AM           │
│         [Load Record] [Delete]                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Features
- ✅ Shows all user records from backend
- ✅ Displays title, creator, publisher
- ✅ Shows genre badges
- ✅ Created and modified timestamps
- ✅ Load button to edit record
- ✅ Delete button with confirmation
- ✅ Persists after page refresh
- ✅ Search functionality
- ✅ Cover images from ISBN

## 7. Search Functionality

### How It Works
Searches across all saved records in backend.

### Example: Search Results
```
Search: "fiction"

Results (2):

┌─────────────────────────────────────────────┐
│ Moby-Dick                                   │
│ Whaling--Fiction                            │
│ Adventure fiction                           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ The Great Gatsby                            │
│ Fitzgerald, F. Scott                        │
│ Fiction                                     │
└─────────────────────────────────────────────┘
```

### Search Fields
- ✅ Title
- ✅ Creator name
- ✅ Subject headings
- ✅ Genre/form terms
- ✅ Cataloger name
- ✅ Notes

## 8. Delete Functionality

### How It Works
Deletes from both backend and localStorage cache.

### Example: Delete Process
```
1. Click "All Records"
2. Find record to delete
3. Click trash icon
4. Confirmation dialog appears:
   
   ┌────────────────────────────────────┐
   │ Delete Record?                     │
   │                                    │
   │ Are you sure you want to delete    │
   │ "Moby-Dick"?                       │
   │                                    │
   │ This action cannot be undone.      │
   │                                    │
   │    [Cancel]  [Delete]              │
   └────────────────────────────────────┘

5. Click "Delete"
6. Record removed from:
   - Supabase KV store
   - localStorage cache
   - UI grid
7. Success message appears
```

## Summary

### What Works Now ✅
1. **Real Backend Persistence**
   - Records save to Supabase
   - Survive page refresh
   - Multi-device access (same login)

2. **Comprehensive MARC**
   - 40+ field types
   - All entered data displays
   - Proper MARC21 format

3. **Perfect Export/Import**
   - Full data export
   - Zero data loss
   - Round-trip tested

4. **Complete OPAC**
   - All fields display
   - Professional layout
   - Public catalog ready

5. **Backend Integration**
   - Auth required
   - User-specific records
   - REST API endpoints

### Example Workflow
```
Login → Create → Save → See in All Records →
Export → Import → Edit → Update → View MARC →
Preview OPAC → Share → Delete
```

Every step works with full data persistence!

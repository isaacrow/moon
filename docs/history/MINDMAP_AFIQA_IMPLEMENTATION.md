# Mind Map View and AFIQA Integration - Implementation Summary

## Overview
This document describes the new features added to the Moon BIBFRAME cataloging system: Mind Map visualization, AFIQA authority file integration, and Arabic example records.

## New Features

### 1. Mind Map View for BIBFRAME Records
**File:** `/src/app/components/MindMapView.tsx`

A visual mind map component that displays BIBFRAME records as an interactive graph using ReactFlow.

**Features:**
- Interactive node-based visualization
- Color-coded nodes for different BIBFRAME entities:
  - Blue: Work
  - Green: Instance
  - Purple: Agent (Contributors/Authors)
  - Orange: Subject
  - Pink: Properties
- Displays relationships between Work, Instance, contributors, subjects, and metadata
- Export functionality to SVG format
- Fully bilingual (Arabic/English) interface
- Zoom and pan controls
- Smooth animated connections between nodes

**Access:**
- Click "Mind Map / خريطة ذهنية" button in the catalog toolbar
- Opens as a modal overlay showing the current record's relationships

### 2. AFIQA Authority File System
**Files:**
- `/src/app/services/afiqaService.ts` - Service layer for AFIQA integration
- `/src/app/components/AuthorityFileManager.tsx` - UI component

AFIQA (Arabic Federated Identification and Qualification of Authorities) integration for managing Arabic authority records.

**Pre-loaded Arabic Authorities:**
The system includes 4 prominent Arabic scholars/poets:

1. **الجواهري، محمد مهدي (1899-1997)**
   - AFIQA ID: 24
   - ISNI: 0000000122843672
   - Wikidata: Q4121866
   - Occupation: شاعر (Poet)
   - Works: ديوان الجواهري، عينية الجواهري، بريد الغربة, and more

2. **الوائلي، احمد (1347-1423 هجري)**
   - AFIQA ID: 1421
   - ISNI: 0000000061605813
   - Wikidata: Q4165199
   - Occupation: رجال الدين الشيعة، الخطباء (Shia cleric, orator)
   - Works: المجالس الحسينية، ديوان الوائلي, and more

3. **السامرائي، فاضل صالح (1933-)**
   - AFIQA ID: 2031
   - ISNI: 0000000123210623
   - Wikidata: Q6823033
   - Occupation: الاكاديميون، اللغويون (Academic, linguist)
   - Works: معاني النحو، التعبير القرآني, and more

4. **ابو الطيب المتنبي (303-354 هجري)**
   - AFIQA ID: 15
   - ISNI: 0000000122424312
   - Wikidata: Q284542
   - LCCN: PJ7750.M8
   - Occupation: الشعراء (Poet)
   - Works: ديوان ابي الطيب المتنبي

**Authority Record Features:**
- Complete personal information (birth/death dates, places)
- Professional information (occupation, field of work, languages)
- Name variants and cross-references (see-also references)
- Complete works bibliography with holdings information
- Source citations with URLs
- Integration with international identifiers (ISNI, Wikidata QID, LCCN)

**Authority Manager Features:**
- Search authority records by name, identifier, or works
- View detailed authority information
- Browse all available authority records
- Select authorities to link to BIBFRAME records
- Bilingual interface (Arabic/English)

**Access:**
- Dashboard → "الملفات الاستنادية / Authority Files" button
- Or catalog toolbar → "Authority Files / AFIQA" button

### 3. Arabic Example Records
**File:** `/src/app/utils/arabicExamples.ts`

Four complete BIBFRAME records in Arabic featuring the works of the 4 pre-loaded authorities:

1. **ديوان الجواهري** (Collected Poetry of Al-Jawahiri)
   - Complete work by محمد مهدي الجواهري
   - Full BIBFRAME Work and Instance metadata
   - Holdings in Iraqi libraries
   - Classification: PJ7840.A85

2. **المجالس الحسينية** (Husseini Councils)
   - Work by احمد الوائلي
   - Religious sermons collection
   - Published in Karbala, Iraq

3. **معاني النحو** (Meanings of Grammar)
   - Academic work by فاضل صالح السامرائي
   - Arabic grammar and rhetoric
   - 4 volumes

4. **ديوان ابي الطيب المتنبي** (Collected Poetry of Al-Mutanabbi)
   - Classical Arabic poetry
   - By المتنبي (915-965 CE)
   - Extensive library holdings

**Loading Arabic Examples:**
- Click the "مثال عربي / Arabic Example" button in the catalog toolbar
- Automatically loads all 4 examples to localStorage
- Opens the first example (Jawahiri's Diwan) in the editor

## Technical Implementation

### Dependencies
- **reactflow**: ^11.11.4 - For mind map visualization

### Data Structure
```typescript
interface AfiqaRecord {
  id: string;
  afiqaId: string;
  isni?: string;
  qid?: string;
  lccn?: string;
  personalName: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  // ... additional fields
  names: AfiqaName[];
  works?: AfiqaWork[];
  sources?: AfiqaSource[];
}
```

### Integration Points

1. **Dashboard:** New quick action for Authority File Manager
2. **Catalog Toolbar:** 
   - "Authority Files / AFIQA" button
   - "Mind Map / خريطة ذهنية" button
   - "مثال عربي / Arabic Example" button
3. **View Modes:** Added 'authority-manager' and 'mind-map' to ViewMode type

## Usage Guide

### Viewing Authority Files
1. From the Dashboard, click "الملفات الاستنادية / Authority Files"
2. Browse the pre-loaded 4 Arabic authorities
3. Click on any record to view detailed information
4. Use the search box to find specific names or works

### Creating a Mind Map
1. Load or create a BIBFRAME record
2. Click "Mind Map / خريطة ذهنية" in the toolbar
3. Explore the visual representation of relationships
4. Use mouse to pan and zoom
5. Export as SVG if needed

### Loading Arabic Examples
1. Click "مثال عربي / Arabic Example" in the catalog toolbar
2. All 4 Arabic records are loaded to the system
3. The first record opens in the editor
4. Access other Arabic records through the search page or dashboard

## Bilingual Support
All new features fully support Arabic and English:
- UI labels in both languages
- RTL (Right-to-Left) text rendering for Arabic
- Arabic metadata fields properly displayed
- Bilingual tooltips and help text

## Future Enhancements
- Connect to external AFIQA API services
- Import/export authority records
- Link authorities directly to catalog records
- Bulk authority record import
- Authority record validation
- Mind map export to PNG/PDF
- Customizable mind map layouts
- Authority record versioning and history

## Integration with Existing Features
- Compatible with JCricket collaborative features
- Works with existing BIBFRAME 3.0.1 ontology
- Integrates with search and discovery features
- Supports bulk editing workflows
- Compatible with OPAC view
- Exports include authority information

## Notes
- Authority records are stored in-memory (can be extended to use Supabase backend)
- Arabic examples are persisted to localStorage
- Mind map uses force-directed layout algorithm
- All components support dark mode
- Mobile-responsive design (though desktop recommended for mind map)

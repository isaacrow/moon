# Sonic Engine: JSON-LD Import System

## Overview

The **Sonic Import System** provides comprehensive JSON-LD parsing with automatic **@graph resolution** and **node reference resolution** for BIBFRAME 3.0 records.

---

## 📁 Files Created

### 1. `/src/app/sonic-engine/services/jsonld-graph-parser.ts`
**Purpose:** Core graph parsing and node resolution engine

**Key Functions:**

```typescript
parseGraph(jsonld: any): ParsedGraph
```
- Parses `@graph` array
- Creates node map indexed by `@id`
- Finds Work and Instance nodes
- Returns resolved objects

```typescript
resolveWorkReferences(workNode, nodeMap): BF3Work
```
- Resolves all URI references in Work
- Handles: title, contribution, subject, classification, language

```typescript
resolveInstanceReferences(instanceNode, nodeMap): BF3Instance
```
- Resolves all URI references in Instance
- Handles: instanceOf, title, provisionActivity, identifiedBy

```typescript
extractFormData(work: BF3Work): FormData
```
- Flattens nested structures
- Prepares data for form population

---

### 2. `/src/app/sonic-engine/services/sonic-import-handler.ts`
**Purpose:** High-level import handler

**Key Function:**

```typescript
importJSONLD(jsonldText: string): ImportResult
```

**Returns:**
```typescript
{
  success: boolean;
  work: BF3Work | null;
  instances: BF3Instance[];
  formData: any;
  errors: string[];
}
```

**Supported Formats:**
1. ✅ **@graph format** - Full graph with separate nodes
2. ✅ **Simple format** - Direct Work/Instance objects
3. ✅ **Work + Instance format** - Combined object

---

### 3. `/src/app/sonic-engine/utils/import-examples.ts`
**Purpose:** Example JSON-LD files for testing

**Exports:**
- `exampleGraphFormat` - Complex @graph with URI references
- `exampleSimpleFormat` - Embedded objects (no references)
- `exampleWorkInstanceFormat` - Work + Instance combo

---

### 4. `/src/app/components/SonicImportDemo.tsx`
**Purpose:** Interactive demo UI

**Features:**
- ✅ Load example JSON-LD files
- ✅ Parse and resolve references
- ✅ Display extracted form data
- ✅ Show resolved Work/Instance objects
- ✅ Visual success/error indicators

---

## 🔄 How It Works

### Step 1: Parse @graph

```typescript
const graph = jsonld['@graph'] || [];
```

Extract all nodes from the `@graph` array.

---

### Step 2: Build Node Map

```typescript
const nodeMap = {};
graph.forEach(node => {
  nodeMap[node["@id"]] = node;
});
```

Create a dictionary indexed by `@id` for **O(1) lookup**.

---

### Step 3: Find Work Node

```typescript
const work = graph.find(n =>
  n["@type"] === "bf:Work" ||
  (Array.isArray(n["@type"]) && n["@type"].includes("bf:Work"))
);
```

Locate the Work entity in the graph.

---

### Step 4: Resolve References

#### Example: Title Reference

**Before Resolution:**
```json
{
  "@id": "http://moon.local/work/12345",
  "@type": "bf:Work",
  "bf:title": "http://moon.local/node/title-1"
}
```

**Node in Graph:**
```json
{
  "@id": "http://moon.local/node/title-1",
  "@type": "bf:Title",
  "bf:mainTitle": "Introduction to BIBFRAME 3.0",
  "bf:subtitle": "A Complete Guide"
}
```

**After Resolution:**
```json
{
  "@id": "http://moon.local/work/12345",
  "@type": "bf:Work",
  "bf:title": {
    "@type": "bf:Title",
    "@id": "http://moon.local/node/title-1",
    "bf:mainTitle": "Introduction to BIBFRAME 3.0",
    "bf:subtitle": "A Complete Guide"
  }
}
```

**Code:**
```typescript
if (typeof work["bf:title"] === 'string') {
  const titleNode = nodeMap[work["bf:title"]];
  work["bf:title"] = {
    "@type": titleNode["@type"],
    "@id": titleNode["@id"],
    "bf:mainTitle": titleNode["bf:mainTitle"],
    "bf:subtitle": titleNode["bf:subtitle"],
  };
}
```

---

### Step 5: Extract Form Data

```typescript
const formData = extractFormData(work);
```

**Returns:**
```json
{
  "mainTitle": "Introduction to BIBFRAME 3.0",
  "subtitle": "A Complete Guide",
  "contributions": [
    {
      "agentLabel": "Smith, Jane",
      "roleLabel": "Author",
      "roleId": "http://id.loc.gov/vocabulary/relators/aut"
    }
  ],
  "subjects": [
    {
      "label": "Library science",
      "type": "bf:Topic",
      "source": "http://id.loc.gov/authorities/subjects/sh85076723"
    }
  ]
}
```

---

## 💻 Usage Examples

### Basic Import

```typescript
import { importJSONLD } from '../sonic-engine/services/sonic-import-handler';

const handleImport = (jsonldString: string) => {
  const result = importJSONLD(jsonldString);
  
  if (result.success && result.formData) {
    console.log('Main Title:', result.formData.mainTitle);
    console.log('Subtitle:', result.formData.subtitle);
    console.log('Contributors:', result.formData.contributions);
  } else {
    console.error('Import failed:', result.errors);
  }
};
```

---

### Populate Form

```typescript
const result = importJSONLD(jsonldString);

if (result.success && result.formData) {
  setWorkData({
    ...result.work,
    mainTitle: result.formData.mainTitle,
    subtitle: result.formData.subtitle,
  });
  
  setContributions(result.formData.contributions || []);
  setSubjects(result.formData.subjects || []);
}
```

---

### Handle Multiple Instances

```typescript
const result = importJSONLD(jsonldString);

if (result.success) {
  console.log('Work:', result.work);
  console.log('Instances:', result.instances);
  
  result.instances.forEach(instance => {
    console.log('Instance ID:', instance['@id']);
    console.log('Publisher:', instance['bf:provisionActivity']);
  });
}
```

---

## 🎯 Supported Properties

### Work Properties

| Property | Type | Resolved |
|----------|------|----------|
| `bf:title` | Title | ✅ |
| `bf:contribution` | Contribution[] | ✅ |
| `bf:subject` | Subject[] | ✅ |
| `bf:classification` | Classification[] | ✅ |
| `bf:language` | Language[] | ✅ |
| `bf:content` | ContentType | Direct |
| `bf:genreForm` | GenreForm | Direct |
| `bf:originDate` | string | Direct |
| `bf:summary` | string | Direct |

---

### Instance Properties

| Property | Type | Resolved |
|----------|------|----------|
| `bf:instanceOf` | Work reference | ✅ |
| `bf:title` | Title | ✅ |
| `bf:provisionActivity` | Publication[] | ✅ |
| `bf:identifiedBy` | Identifier[] | ✅ |
| `bf:extent` | Extent | Direct |
| `bf:dimensions` | string | Direct |
| `bf:carrier` | Carrier | Direct |

---

## 🧪 Testing

### Access the Demo

1. Navigate to Dashboard
2. Click **"🔄 Sonic Import Demo"**
3. Load an example or paste JSON-LD
4. Click **"Parse & Resolve References"**
5. View extracted form data and resolved objects

---

### Example Test Cases

#### Test 1: @graph Format
```json
{
  "@graph": [
    {
      "@id": "http://example.org/work/1",
      "@type": "bf:Work",
      "bf:title": "http://example.org/title/1"
    },
    {
      "@id": "http://example.org/title/1",
      "@type": "bf:Title",
      "bf:mainTitle": "Test Book"
    }
  ]
}
```

**Expected Result:**
- ✅ Work found
- ✅ Title resolved
- ✅ Form data: `{ mainTitle: "Test Book" }`

---

#### Test 2: Nested Contributions

```json
{
  "@graph": [
    {
      "@id": "http://example.org/work/1",
      "@type": "bf:Work",
      "bf:contribution": "http://example.org/contrib/1"
    },
    {
      "@id": "http://example.org/contrib/1",
      "@type": "bf:Contribution",
      "bf:agent": "http://example.org/person/1",
      "bf:role": "http://id.loc.gov/vocabulary/relators/aut"
    },
    {
      "@id": "http://example.org/person/1",
      "@type": "bf:Person",
      "rdfs:label": "Smith, John"
    }
  ]
}
```

**Expected Result:**
- ✅ Contribution resolved
- ✅ Agent resolved (2 levels deep)
- ✅ Form data: `{ contributions: [{ agentLabel: "Smith, John", roleLabel: "Author" }] }`

---

## 🚀 Integration with Sonic Engine

The import system is designed to work seamlessly with the Sonic Engine:

```typescript
// In SonicWorkForm.tsx
import { importJSONLD } from '../sonic-engine/services/sonic-import-handler';

const handleImport = (jsonldText: string) => {
  const result = importJSONLD(jsonldText);
  
  if (result.success && result.work) {
    // Update Sonic state
    setSonicWork(result.work);
    
    // Populate form fields
    if (result.formData) {
      setMainTitle(result.formData.mainTitle || '');
      setSubtitle(result.formData.subtitle || '');
      setContributions(result.formData.contributions || []);
    }
    
    toast.success('JSON-LD imported successfully');
  } else {
    toast.error(`Import failed: ${result.errors.join(', ')}`);
  }
};
```

---

## 📊 Performance

- **Node Map:** O(1) lookup for any node by @id
- **Graph Parsing:** O(n) where n = number of nodes
- **Reference Resolution:** O(1) per reference
- **Total Complexity:** O(n + m) where m = number of references

---

## 🔧 Error Handling

```typescript
const result = importJSONLD(jsonldText);

if (!result.success) {
  // Handle errors
  result.errors.forEach(error => {
    console.error(error);
  });
}
```

**Common Errors:**
- ❌ Invalid JSON syntax
- ❌ Missing @graph array
- ❌ No Work entity found
- ❌ Broken references (URI not in nodeMap)

---

## 🎓 Example Output

### Input:
```json
{
  "@graph": [
    {
      "@id": "http://moon.local/work/1",
      "@type": "bf:Work",
      "bf:title": "http://moon.local/title/1"
    },
    {
      "@id": "http://moon.local/title/1",
      "@type": "bf:Title",
      "bf:mainTitle": "BIBFRAME Guide"
    }
  ]
}
```

### Output:
```json
{
  "success": true,
  "work": {
    "@id": "http://moon.local/work/1",
    "@type": "bf:Work",
    "bf:title": {
      "@id": "http://moon.local/title/1",
      "@type": "bf:Title",
      "bf:mainTitle": "BIBFRAME Guide"
    }
  },
  "formData": {
    "@id": "http://moon.local/work/1",
    "@type": "bf:Work",
    "mainTitle": "BIBFRAME Guide"
  },
  "instances": [],
  "errors": []
}
```

---

## ✅ Features Implemented

- ✅ @graph parsing
- ✅ Node map creation
- ✅ Work entity detection
- ✅ Instance entity detection
- ✅ Title reference resolution
- ✅ Contribution reference resolution (2 levels)
- ✅ Subject reference resolution
- ✅ Classification reference resolution
- ✅ Language reference resolution
- ✅ Publication activity resolution (3 levels)
- ✅ Identifier resolution
- ✅ Form data extraction
- ✅ Error handling
- ✅ Multiple format support
- ✅ Interactive demo UI

---

## 🎯 Next Steps

To integrate with actual Sonic forms:

1. Import the handler in your form component
2. Add an "Import" button
3. Call `importJSONLD()` with user input
4. Populate form fields with `result.formData`
5. Update Sonic state with `result.work`

---

**Created:** February 16, 2026  
**System:** Sonic Engine - BIBFRAME 3.0 Import  
**Status:** ✅ Complete and Ready

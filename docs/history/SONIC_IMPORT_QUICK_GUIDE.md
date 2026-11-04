# Sonic Import - Quick Reference

## 🚀 Quick Start

### 1. Import the Handler
```typescript
import { importJSONLD } from '../sonic-engine/services/sonic-import-handler';
```

### 2. Parse JSON-LD
```typescript
const result = importJSONLD(jsonldString);
```

### 3. Use the Data
```typescript
if (result.success && result.formData) {
  setMainTitle(result.formData.mainTitle);
  setSubtitle(result.formData.subtitle);
  setContributions(result.formData.contributions);
}
```

---

## 📋 The Process

```
JSON-LD Input
    ↓
Parse @graph
    ↓
Build Node Map: { "@id": node }
    ↓
Find Work & Instances
    ↓
Resolve URI References
    ↓
Extract Form Data
    ↓
Ready for Forms!
```

---

## 🔍 Example Transformation

### BEFORE (with references):
```json
{
  "@id": "work123",
  "@type": "bf:Work",
  "bf:title": "http://moon.local/title-1"
}
```

### Node Map Contains:
```json
{
  "http://moon.local/title-1": {
    "@id": "http://moon.local/title-1",
    "@type": "bf:Title",
    "bf:mainTitle": "Introduction to BIBFRAME"
  }
}
```

### AFTER (resolved):
```json
{
  "@id": "work123",
  "@type": "bf:Work",
  "bf:title": {
    "@id": "http://moon.local/title-1",
    "@type": "bf:Title",
    "bf:mainTitle": "Introduction to BIBFRAME"
  }
}
```

### Form Data:
```json
{
  "mainTitle": "Introduction to BIBFRAME"
}
```

---

## 💡 Code Pattern

```typescript
// 1. User provides JSON-LD
const jsonldText = `{ "@graph": [...] }`;

// 2. Import it
const result = importJSONLD(jsonldText);

// 3. Check success
if (result.success) {
  
  // 4. Get the resolved Work
  const work = result.work;
  
  // 5. Get flattened form data
  const formData = result.formData;
  
  // 6. Populate your UI
  setWorkData(work);
  setFormFields(formData);
  
} else {
  // Handle errors
  console.error(result.errors);
}
```

---

## 🎯 Key Functions

| Function | Input | Output |
|----------|-------|--------|
| `parseGraph(jsonld)` | JSON-LD object | `{ work, instances, nodeMap }` |
| `importJSONLD(text)` | JSON-LD string | `ImportResult` |
| `extractFormData(work)` | BF3Work | Flattened form data |

---

## 📦 Result Object

```typescript
{
  success: boolean,          // Did it work?
  work: BF3Work | null,      // Resolved Work
  instances: BF3Instance[],  // Resolved Instances
  formData: any,             // Flattened for forms
  errors: string[]           // Any errors
}
```

---

## ✨ Properties Resolved

### Work
- ✅ `bf:title` → Title object
- ✅ `bf:contribution` → Contribution + Agent + Role
- ✅ `bf:subject` → Subject objects
- ✅ `bf:classification` → Classification objects
- ✅ `bf:language` → Language objects

### Instance
- ✅ `bf:instanceOf` → Work reference
- ✅ `bf:title` → Title object
- ✅ `bf:provisionActivity` → Publication + Agent + Place
- ✅ `bf:identifiedBy` → Identifier objects

---

## 🧪 Test It

1. Go to Dashboard
2. Click **"🔄 Sonic Import Demo"**
3. Click **"@graph Format"** button
4. Click **"Parse & Resolve References"**
5. See the magic! ✨

---

## 🎨 Form Data Structure

```typescript
{
  mainTitle: string,
  subtitle: string,
  partNumber: string,
  partName: string,
  
  contributions: [
    {
      agentLabel: string,
      roleLabel: string,
      roleId: string
    }
  ],
  
  subjects: [
    {
      label: string,
      type: string,
      source: string
    }
  ],
  
  classifications: [
    {
      portion: string,
      item: string,
      source: string
    }
  ],
  
  content: any,
  genreForm: any,
  language: any,
  originDate: string,
  summary: string
}
```

---

## 🔥 Pro Tips

1. **Node Map = Fast Lookups**
   - O(1) complexity for any reference

2. **Handles Nesting**
   - Resolves 2-3 levels deep automatically

3. **Flexible Input**
   - Works with @graph, simple format, or combined format

4. **Form-Ready Output**
   - `formData` is flattened and ready to use

5. **Error Tolerant**
   - Always returns a result, check `success` flag

---

## 📚 Files to Know

```
/src/app/sonic-engine/
  ├── services/
  │   ├── jsonld-graph-parser.ts      # Core parser
  │   └── sonic-import-handler.ts     # Main handler
  ├── utils/
  │   └── import-examples.ts          # Example files
  └── types/
      └── bibframe3-strict.ts         # Type definitions

/src/app/components/
  └── SonicImportDemo.tsx             # Interactive demo
```

---

**That's it!** You now have a complete JSON-LD import system with automatic reference resolution. 🎉

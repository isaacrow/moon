# 📸 Load Real Example - Visual Guide

## Where to Find the "Load Real Example" Button

---

## 🎯 Step-by-Step Visual Guide

### Step 1: Access Moon Engine

**From the Dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│  🌙 Moon Dashboard                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📚 Cataloging Templates                                │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   ✨ Moon    │  │  📖 KAMI     │  │  📝 Marva    │  │
│  │   Engine     │  │  Core        │  │  Quartz      │  │
│  │              │  │              │  │              │  │
│  │ Ontology-    │  │ Enterprise   │  │ LOC Official │  │
│  │ Driven       │  │ Cataloging   │  │ Style        │  │
│  │              │  │              │  │              │  │
│  │ [Click Here] │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Look for:** The card with the ✨ Sparkles icon and "Ontology-Driven" badge

---

### Step 2: Moon Engine Header

Once you click on Moon Engine, you'll see this header:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ✨ Moon Engine  [Ontology-Driven Badge]                                    │
│ Dynamic BIBFRAME cataloging powered by RDF graphs                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Left Side:                                    Right Side (Action Buttons): │
│  • Logo                                        ┌────────────────────────┐  │
│  • Title                                       │  📊 Load Real Example  │  │
│  • Description                                 │                        │  │
│                                                │  [Green Button]        │  │
│                                                └────────────────────────┘  │
│                                                                             │
│                                                [Upload Import]              │
│                                                [🌐 Language]                │
│                                                [JSON-LD Download]           │
│                                                [Turtle Download]            │
│                                                [💾 Save Record]             │
│                                                [Back]                       │
└────────────────────────────────────────────────────────────────────────────┘
```

**The Button Appearance:**
- **Color:** Green background (from-green-50 to-emerald-50)
- **Icon:** 📊 Database icon on the left
- **Text:** "Load Real Example"
- **Border:** Green border
- **Location:** Top-right header area, first button in the action row

---

### Step 3: Click the Button - Dropdown Opens

```
┌────────────────────────────────────────────────────────────┐
│  📊 Load Real Example                                      │
│                                                             │
│  ↓ DROPDOWN MENU OPENS:                                   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Choose a Real BIBFRAME Example                    │  │
│  ├────────────────────────────────────────────────────┤  │
│  │                                                     │  │
│  │  ✨ Random Example                                 │  │
│  │     (Surprise me with any example)                 │  │
│  │                                                     │  │
│  │  📖 One Hundred Years of Solitude (English)        │  │
│  │     Gabriel García Márquez - Fiction               │  │
│  │                                                     │  │
│  │  📖 الأيام - طه حسين (Arabic)                      │  │
│  │     Taha Hussein - Autobiography                   │  │
│  │                                                     │  │
│  │  📖 Introduction to Algorithms (Academic)          │  │
│  │     Cormen et al. - Textbook                       │  │
│  │                                                     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Dropdown Features:**
- **4 Options:** Random + 3 specific examples
- **Icons:** ✨ for Random, 📖 for each book
- **Hover Effect:** Items highlight when you move mouse over them
- **Click:** Click any item to load that example

---

### Step 4: After Clicking an Example

**Toast Notification Appears (Top-Right Corner):**

```
                                    ┌──────────────────────────────────┐
                                    │ ✅ Loaded Real Example:          │
                                    │ One Hundred Years of Solitude    │
                                    │                                  │
                                    │ Real BIBFRAME record with        │
                                    │ complete metadata and URIs.      │
                                    │                                  │
                                    │              [Auto-dismiss 3s]   │
                                    └──────────────────────────────────┘
```

**What Happens:**
1. Green success toast appears
2. Form fields populate instantly
3. RDF triple count updates
4. Work and Instance tabs fill with data
5. Preview tab shows generated output

---

### Step 5: Explore the Loaded Data

**Work Tab View:**

```
┌─────────────────────────────────────────────────────────────┐
│  Work Entity - Conceptual Content                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📝 Title (bf:title)                                         │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Main Title: One Hundred Years of Solitude          │     │
│  │ Subtitle: A Novel                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  👤 Contributors (bf:contribution)                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Name: García Márquez, Gabriel, 1927-2014           │     │
│  │ URI: http://id.loc.gov/authorities/names/n79046607 │     │
│  │ Role: Author                                       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  📚 Subjects (bf:subject)                                    │
│  ┌────────────────────────────────────────────────────┐     │
│  │ • Epic literature                                  │     │
│  │ • Colombia--Fiction                                │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  [More fields scroll down...]                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 6: View Preview Formats

**Preview Tab with Format Selector:**

```
┌─────────────────────────────────────────────────────────────┐
│  Preview Options                                             │
│                                                              │
│  Format Buttons:                                             │
│  [🗺️ Mind Map] [👁️ OPAC] [📄 MARC]                          │
│  [JSON-LD] [Turtle] [Graph]                                 │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Selected: JSON-LD                                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │ {                                                  │     │
│  │   "@context": "http://id.loc.gov/...",            │     │
│  │   "@graph": [                                      │     │
│  │     {                                              │     │
│  │       "@type": "bf:Work",                          │     │
│  │       "@id": "http://moon.local/work/...",         │     │
│  │       "bf:title": {                                │     │
│  │         "@type": "bf:Title",                       │     │
│  │         "bf:mainTitle": "One Hundred Years...",    │     │
│  │         "bf:subtitle": "A Novel"                   │     │
│  │       },                                           │     │
│  │       "bf:contribution": [                         │     │
│  │         {                                          │     │
│  │           "@type": "bf:Contribution",              │     │
│  │           "bf:agent": {                            │     │
│  │             "@type": "bf:Person",                  │     │
│  │             "@id": "http://id.loc.gov/auth.../...",│     │
│  │             "rdfs:label": "García Márquez..."      │     │
│  │           }                                        │     │
│  │         }                                          │     │
│  │       ]                                            │     │
│  │     }                                              │     │
│  │   ]                                                │     │
│  │ }                                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Visual Elements

### Button States

#### 1. Default State (Not Hovered)
```
┌────────────────────────┐
│  📊 Load Real Example  │  ← Light green background
│                        │  ← Green border
└────────────────────────┘
```

#### 2. Hover State
```
┌────────────────────────┐
│  📊 Load Real Example  │  ← Slightly darker green
│                        │  ← Cursor changes to pointer
└────────────────────────┘
```

#### 3. Dropdown Open
```
┌────────────────────────┐
│  📊 Load Real Example  │  ← Button stays highlighted
│        ▼               │  ← Arrow indicates menu below
└────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Menu appears here...        │
└──────────────────────────────┘
```

---

## 📊 Info Box Changes

**Before Loading Example:**
```
┌────────────────────────────────────────────────────────┐
│  ℹ️ About Moon Engine                                  │
│                                                         │
│  This template dynamically generates fields from the    │
│  BIBFRAME ontology...                                   │
│                                                         │
│  [📖 50 Work Properties]                                │
│  [📦 40 Instance Properties]                            │
│  [0 RDF Triples]                                        │
└────────────────────────────────────────────────────────┘
```

**After Loading Example:**
```
┌────────────────────────────────────────────────────────┐
│  ℹ️ About Moon Engine                                  │
│                                                         │
│  This template dynamically generates fields from the    │
│  BIBFRAME ontology...                                   │
│                                                         │
│  [📖 50 Work Properties]                                │
│  [📦 40 Instance Properties]                            │
│  [127 RDF Triples]  ← Now shows actual count!          │
└────────────────────────────────────────────────────────┘
```

---

## 🔍 Finding the Button - Troubleshooting

### Can't Find the Button?

**Check 1:** Are you in Moon Engine?
- The button ONLY appears in the Moon Engine template
- Not in other templates (KAMI, Marva, etc.)

**Check 2:** Look in the correct location
- Top-right area of the header
- First button in the action row
- Green colored, not blue or gray

**Check 3:** Screen too small?
- On smaller screens, buttons may wrap
- Scroll horizontally if needed
- Or zoom out browser (Ctrl + -)

**Check 4:** Button not visible?
- Refresh the page
- Clear browser cache
- Try different browser

---

## 🌈 Color Reference

### Button Colors

**Light Mode:**
- Background: Light green (#f0fdf4) to light emerald (#d1fae5)
- Border: Green (#86efac)
- Text: Dark gray/black
- Hover: Slightly darker green

**Dark Mode:**
- Background: Dark green with transparency
- Border: Dark green (#065f46)
- Text: White/light gray
- Hover: Slightly lighter

---

## 📐 Layout Diagram

### Complete Moon Engine Interface

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER                                                             │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐   │
│  │ ✨ Moon Engine          │  │  [📊 Load Real Example] ▼     │   │
│  │ Ontology-Driven         │  │  [📤 Import]                   │   │
│  │ Dynamic BIBFRAME...     │  │  [🌐 Language]                 │   │
│  └─────────────────────────┘  │  [JSON-LD]  [Turtle]           │   │
│                                │  [💾 Save]  [Back]             │   │
│                                └────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  INFO BOX                                                           │
│  ℹ️ About Moon Engine                                              │
│  [Properties counts and RDF triple count]                           │
├─────────────────────────────────────────────────────────────────────┤
│  TABS                                                               │
│  [Work] [Instance] [Admin Metadata] [Preview]                      │
├─────────────────────────────────────────────────────────────────────┤
│  CONTENT AREA                                                       │
│                                                                     │
│  Current Tab Content Shows Here                                    │
│  (Forms, Fields, Preview, etc.)                                     │
│                                                                     │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    
                                    [Toast notifications appear here →]
```

---

## ✨ Interactive Elements

### What You Can Click

1. **📊 Load Real Example button** - Opens dropdown
2. **✨ Random Example** - Loads random record
3. **📖 Any book title** - Loads that specific record
4. **[Work] / [Instance] / [Admin] / [Preview] tabs** - Switch views
5. **Format buttons** (Mind Map, OPAC, MARC, etc.) - Change preview
6. **💾 Save Record** - Save to database
7. **JSON-LD / Turtle buttons** - Download files

---

## 🎯 Quick Visual Checklist

Before you start, make sure you can see:
- ✅ Moon Engine title with ✨ icon
- ✅ "Ontology-Driven" badge
- ✅ Green "Load Real Example" button
- ✅ Four tabs (Work, Instance, Admin, Preview)
- ✅ Info box with property counts
- ✅ Action buttons in header

If you see all of these, you're in the right place!

---

## 📱 Responsive Views

### Desktop (Large Screen)
All buttons in one row, full header visible

### Tablet (Medium Screen)
Buttons may wrap to two rows, still fully functional

### Mobile (Small Screen)
Buttons stack vertically, may need to scroll

**Note:** Moon is optimized for desktop cataloging workflows

---

## 🎨 Theme Variations

The button looks slightly different in each theme:

### Default Theme
Standard green with subtle shadows

### Apple Store Theme
Crisp, clean green matching Apple aesthetics

### Dark Mode (Any Theme)
Dark green with light text, glowing effect

**All themes:** Button is always recognizable by green color and database icon

---

## 🔔 Notification Styles

### Success Toast (Example Loaded)
```
✅ Loaded Real Example: [Title]
Real BIBFRAME record with complete metadata and URIs.
[Auto-dismiss after 3 seconds]
```

### Info Toast (During Load)
```
ℹ️ Loading example...
Please wait.
```

### Error Toast (If Problem)
```
❌ Failed to load example
Please try again or select a different example.
```

---

## 📊 What Changes After Loading

### Visual Indicators:

1. **Toast notification** appears (top-right)
2. **RDF triple count** updates (info box)
3. **Work tab** shows filled fields
4. **Instance tab** shows filled fields
5. **Preview tab** shows generated output
6. **Dropdown menu** closes automatically

### Data Changes:

- Form fields populate
- URIs generate
- Graph builds
- Validation runs
- Preview updates

---

## 💡 Pro Visual Tips

1. **Look for the green button** - It stands out on purpose
2. **Watch the RDF count** - It confirms data loaded
3. **Check the toast** - Tells you which example loaded
4. **Explore tabs** - See how data is organized
5. **Try different previews** - Each shows unique view

---

## 🎉 You Found It!

Now you know:
- ✅ Where the button is located
- ✅ What it looks like
- ✅ How to use it
- ✅ What happens when you click
- ✅ How to verify it worked

**Ready to load your first real example?**

1. Navigate to Moon Engine
2. Locate the green button
3. Click to open dropdown
4. Select an example
5. Explore the data!

---

🌙 **Moon - Making BIBFRAME Visual and Accessible**

---

**Last Updated:** February 15, 2026  
**Version:** MOON TO 16  
**Feature:** Load Real Example Visual Guide

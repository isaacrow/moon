# KAMI Core - Quick Start Guide

## ✨ What is KAMI?

**KAMI** (Knowledge Architecture for Metadata Integration) is a production-grade, enterprise-level cataloging system for BIBFRAME records built into Moon.

---

## 🚀 Quick Start (3 Steps)

### 1. Access KAMI
1. Log into Moon
2. Go to Dashboard
3. Click **"✨ KAMI Core"** card

### 2. Create Your First Record
1. Choose **"Start Monograph Catalog"** or **"Start Manuscript Catalog"**
2. Fill in the required fields (*marked with red asterisk*)
3. System auto-saves every 30 seconds

### 3. Save & Publish
1. Click **"Save"** button
2. Fix any validation errors (shown in red)
3. Click **"Submit for Review"** when ready

---

## 📋 Key Features

✅ **Ontology-Driven**: Fields automatically generated from BIBFRAME 3.0.1  
✅ **Real-Time Validation**: See errors/warnings as you type  
✅ **Auto-Save**: Never lose your work (30-second intervals)  
✅ **Manuscript Support**: Specialized fields for manuscripts  
✅ **Live Preview**: See your record in real-time  
✅ **Workflow Management**: Draft → Review → Approved → Published  

---

## 🎯 User Interface

### Three-Pane Editor
```
┌─────────────┬─────────────┬─────────────┐
│    Work     │  Instance   │   Preview   │
│   Fields    │   Fields    │   Live      │
│             │             │   View      │
└─────────────┴─────────────┴─────────────┘
```

### Tabs
- **Work**: Conceptual information (title, author, subjects)
- **Instance**: Physical manifestation (publication, ISBN)
- **Item**: Specific copy (for manuscripts)
- **Preview**: Validation results & formatted view

---

## ✅ Required Fields

### For Monographs
- **Work**: Title *, Author *
- **Instance**: Publication info *, ISBN (recommended)

### For Manuscripts
- **Work**: Title *, Origin date (recommended)
- **Instance**: Script, Material
- **Item**: Shelf mark *, Repository *

---

## 🎨 Validation Colors

- 🔴 **Red (Error)**: Must fix to publish
- 🟡 **Yellow (Warning)**: Recommended to fix
- 🔵 **Blue (Info)**: Optional improvements

---

## 💾 Data Storage

**Current**: Local browser storage (offline-capable)  
**Future**: Supabase PostgreSQL database

---

## 📚 Full Documentation

- **Complete Guide**: `/KAMI_COMPLETE.md` (comprehensive overview)
- **Architecture**: `/KAMI_ARCHITECTURE.md` (technical specifications)
- **Implementation**: `/KAMI_IMPLEMENTATION_STATUS.md` (component details)

---

## 🆘 Need Help?

1. Check validation messages in the **Preview** tab
2. Review field help text (hover over labels)
3. Consult full documentation above

---

## 🎉 You're Ready!

Start cataloging with professional-grade tools. KAMI handles the complexity of BIBFRAME so you can focus on your content.

**Happy Cataloging! ✨**

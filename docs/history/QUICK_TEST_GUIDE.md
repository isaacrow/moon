# 🧪 Quick Test Guide - Save/Load Fix Verification

## ⚡ Fast Verification (5 minutes)

### Test 1: Basic Save/Load

1. **Open the app** and login
2. **Click "New Record"** → Select "Monograph" 
3. **Fill in some data**:
   - Title: "Test Record 123"
   - Creator: "Test Author"
   - Any other fields
4. **Click "Save"** button
5. **Check browser console** for:
   ```
   💾 Saving record with @types: { work: 'bf:Work', instance: 'bf:Instance' }
   ✅ Record saved to Supabase: ...
   ```
6. **Click "All Records"** in the menu
7. **Find your record** in the gallery - should show "Test Record 123"
8. **Click "Load"** on that record
9. **Verify**:
   - ✅ Record loads with your data (not empty template)
   - ✅ Title shows "Test Record 123"
   - ✅ Creator shows "Test Author"
   - ✅ All fields you filled are present

---

### Test 2: Arabic Data Persistence

1. **Create new record**
2. **Add Arabic title**: "كتاب الاختبار"
3. **Save** and check console
4. **Go to All Records**
5. **Load the Arabic record**
6. **Verify**: Arabic title is preserved exactly

---

### Test 3: Complex Record

1. **Load the LOC Arabic example** (click "LOC Arabic Search" button)
2. **Verify it loads** complex data
3. **Click "Save"**
4. **Check console** for @type confirmation
5. **Reload the page** (F5)
6. **Click "All Records"**
7. **Load the saved Arabic record**
8. **Verify**: All complex data is preserved (contributors, subjects, etc.)

---

## 🔍 What to Look For

### ✅ SUCCESS Indicators

- Console shows: `💾 Saving record with @types: { work: 'bf:Work', instance: 'bf:Instance' }`
- Toast shows: `✅ Record saved to database permanently!`
- When loading: Toast shows actual title, not "Loaded: Untitled Record"
- When loading: Form shows your actual data, not empty fields
- No console errors about "Invalid record structure"

### ❌ FAILURE Indicators

- Console error: `Invalid BIBFRAME graph: missing Work or Instance`
- Toast error: `Invalid record structure. Missing Work or Instance.`
- Loading shows empty template instead of your data
- Console shows: `@type: undefined`

---

## 🐛 If Something Fails

### Issue: Records not saving

**Check:**
1. Browser console for errors
2. Network tab - is `/records/save` request succeeding?
3. Is Supabase backend running?

**Fix:**
- If backend is down, records will save to localStorage (fallback)
- Check `/supabase/functions/server/index.tsx` is running

### Issue: Records loading as empty template

**Check:**
1. Console for error messages
2. What does console.log show for the savedRecord object?

**Fix:**
- This should NOT happen anymore with the fix
- If it does, check that `recordStorageBackend.ts` has the `extractNodesFromGraph` function
- Verify App.tsx `handleLoadRecordFromGallery` has the new extraction logic

### Issue: @type disappearing

**Check:**
1. Console log: `💾 Saving record with @types: ...`
2. Does it show `undefined`?

**Fix:**
- This should NOT happen anymore with `buildSafeNode`
- Verify `recordStorageBackend.ts` uses `buildSafeNode()` in saveRecord
- Check that spread happens BEFORE defaults

---

## 📊 Expected Console Output

### On Save:
```
💾 Saving record with @types: {work: "bf:Work", instance: "bf:Instance"}
✅ Record saved to Supabase: {id: "record-1234567890", ...}
```

### On Load:
```
Loading record from gallery: {id: "record-1234567890", title: "Test Record 123", ...}
Record loaded successfully into editor
```

### On Error:
```
❌ Failed to load record: Invalid BIBFRAME graph: missing Work or Instance
```

---

## 🎯 Quick Command Tests

Open browser console and run:

### Check localStorage records:
```javascript
JSON.parse(localStorage.getItem('bibframe_saved_records'))
```

### Clear localStorage (DANGER - deletes all local records):
```javascript
localStorage.removeItem('bibframe_saved_records')
```

### Count saved records:
```javascript
JSON.parse(localStorage.getItem('bibframe_saved_records') || '[]').length
```

---

## ✅ All Tests Pass?

If all tests above pass, your save/load system is working perfectly! 🎉

- Records save with guaranteed @type
- Records load with actual data (no template fallback)
- Arabic and complex data persists correctly
- Error messages are clear and helpful

**Ready for production use!** 🚀

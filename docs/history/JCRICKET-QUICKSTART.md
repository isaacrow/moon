# JCricket Quick Start Guide

## Getting Started with Collaborative Cataloging in Moon

This guide will help you quickly start using Moon's JCricket collaborative entity management features.

## Step 1: Access JCricket

### From Main Dashboard
1. Login to Moon
2. Click the **"JCricket"** button in the toolbar
   - Or click **"JCricket Collaborative"** in Quick Actions

### You'll See
- Your user role badge (Basic Editor, Advanced Editor, Reviewer, or Admin)
- Your current institution (Provenance)
- Notification bell with unread count
- Review queue status (if applicable)

## Step 2: Understand Your Role

### Basic Editor
**What you can do:**
- ✓ View all entities
- ✓ Edit data from your institution
- ✓ Create new entities
- ✓ Set language preferences
- ✓ View notifications

**What you cannot do:**
- ✗ Edit data from other institutions
- ✗ Merge entities
- ✗ Split entities
- ✗ Review operations

### Advanced Editor
**Everything Basic Editor can do, plus:**
- ✓ Edit all entity properties (from any institution)
- ✓ Merge duplicate entities
- ✓ Split incorrectly clustered entities
- ✓ Request reviews for operations
- ✓ View complete event log

### Reviewer
**Review and approve collaborative operations:**
- ✓ View review queue
- ✓ Approve merge operations
- ✓ Approve split operations
- ✓ Reject with explanatory notes
- ✓ Track review history

### Admin
**Full system access including all above features**

## Step 3: Set Your Language Preferences

**Why:** Optimize your cataloging workflow for languages you're proficient in.

1. From JCricket Dashboard, click **"Language Preferences"** in Quick Actions
2. Select languages you're comfortable cataloging in:
   - English ✓
   - Arabic ✓
   - Spanish ✓
   - French ✓
   - ... and 16 more
3. Choose display option:
   - **Show All Languages**: View entries in all languages
   - **Only Proficient**: Show only your selected languages
4. Click **"Save Preferences"**

**Result:** When editing entities, empty fields for your languages will appear automatically.

## Step 4: Explore the Dashboard

### Four Main Tabs

#### 1. Notifications
- View system notifications
- Mark as read
- Click to jump to related entities
- Types of notifications:
  - Merge review requested
  - Split review requested
  - Review approved/rejected
  - Concurrent edit warnings

#### 2. Review Queue (Advanced+ only)
- Pending operations awaiting review
- In-progress reviews
- Completed operations
- Priority indicators (low, medium, high)

#### 3. Provenance Stats
- See how many entities each institution has contributed
- Track your institution's contributions
- Monitor collaboration distribution

#### 4. Top Contributors
- Monthly leaderboard
- See most active catalogers
- Track your contribution count

### Collaboration Statistics

**Dashboard Shows:**
- Total Clusters: All entities in knowledge base
- Recent Edits: Activity in last 7 days
- Merges This Month: Entity consolidations
- Active Editors: Contributing this month

## Step 5: Common Tasks

### Task 1: Edit an Entity (Basic Editor)

1. Find entity using search
2. Click to open entity editor
3. Edit fields from your institution only
4. Save changes
5. **Result:** Event logged with your username and timestamp

### Task 2: Merge Duplicate Entities (Advanced Editor)

**Example:** You found two author records for "Jane Smith"

1. Select both entities
2. Click **"Merge"** button
3. **Step 1 - Select Destination:**
   - Choose which entity should be the final version
   - Usually select the one with more complete data
4. **Step 2 - Select Properties:**
   - Review properties from source entity
   - Check boxes for properties to copy to destination
   - See preview of merged result
5. **Step 3 - Request Review:**
   - Enter reviewer's username
   - Add notes explaining why merge is needed
   - Click **"Request Review"**
6. **Wait for Review:**
   - Reviewer receives notification
   - They approve or reject
   - You receive notification of decision
7. **Result:** 
   - If approved: Source entity invalidated, destination enhanced
   - If rejected: Review notes guide you to improve

### Task 3: Split Incorrectly Clustered Data (Advanced Editor)

**Example:** An entity contains data for two different subjects

1. Click **"Split"** button
2. **Select Giver Entity:**
   - Entity that has mixed data
3. **Select Receiver Entity:**
   - Entity that should receive some properties
4. **Choose Properties to Move:**
   - Check properties to transfer from giver to receiver
   - Preview before/after state
5. **Request Review:**
   - Enter reviewer username
   - Explain split rationale
   - Click **"Request Review"**
6. **Result:** 
   - If approved: Properties transferred, both entities corrected
   - If rejected: Guidance provided for revision

### Task 4: Review Operations (Reviewer)

1. From JCricket Dashboard, click **"Review Queue"**
2. See pending operations in left panel
3. Click operation to view details:
   - Request information (who, when, why)
   - Complete operation details
   - Cluster information
4. **To Approve:**
   - Review all details carefully
   - Add optional approval notes
   - Click **"Approve"**
5. **To Reject:**
   - Add required rejection notes (explain what needs fixing)
   - Click **"Reject"**
6. **Result:**
   - Requester notified
   - Event logged
   - Operation status updated

### Task 5: View Entity History

1. From JCricket Dashboard, click **"Event Log"**
2. **Filter options:**
   - Search by description, user, or cluster ID
   - Filter by event type (create, edit, merge, split, etc.)
   - Filter by user
3. **View details:**
   - Click event to see complete information
   - See old values → new values
   - View change metadata
   - Track change provenance

## Step 6: Best Practices

### For All Users

**DO:**
- ✓ Check for concurrent edits before starting work
- ✓ Use descriptive notes when requesting reviews
- ✓ Document significant changes
- ✓ Set accurate language preferences
- ✓ Review notifications regularly

**DON'T:**
- ✗ Ignore concurrent edit warnings
- ✗ Make major changes without review (Advanced+)
- ✗ Skip documentation
- ✗ Work outside your language competencies

### For Advanced Editors

**Before Merging:**
- Verify entities truly represent same real-world entity
- Check all facets from different provenances
- Select most authoritative data as destination
- Document merge reasoning clearly

**Before Splitting:**
- Confirm data truly belongs to different entities
- Plan property distribution carefully
- Consider impact on dependent records
- Explain split logic in review notes

### For Reviewers

**Review Checklist:**
- [ ] Verify operation logic is sound
- [ ] Check data quality of changes
- [ ] Ensure provenance is properly maintained
- [ ] Validate all selected properties
- [ ] Provide constructive feedback

**When Rejecting:**
- Be specific about what needs improvement
- Suggest alternative approaches
- Reference relevant policies
- Encourage resubmission after fixes

## Step 7: Understanding Notifications

### Notification Badge
- Red badge = unread notifications
- Number shows unread count
- Auto-refreshes every 30 seconds

### Notification Types

| Type | Meaning | Action |
|------|---------|--------|
| Merge Review Requested | Someone needs you to review a merge | Click to open review workflow |
| Split Review Requested | Someone needs you to review a split | Click to open review workflow |
| Review Approved | Your merge/split was approved | Click to see final result |
| Review Rejected | Your merge/split needs revision | Read notes, revise, resubmit |
| Concurrent Edit Warning | Someone else is editing same entity | Coordinate to avoid conflicts |
| Cluster Updated | An entity you're tracking changed | Review the changes |

## Step 8: Troubleshooting

### Problem: "Access Denied" when trying to merge
**Solution:** Only Advanced Editors can merge. Check your role in JCricket Dashboard.

### Problem: Can't edit certain fields
**Solution:** Basic Editors can only edit fields from their own provenance. Contact admin if you need advanced access.

### Problem: Concurrent edit warning keeps appearing
**Solution:** 
1. Check who else is editing (shown in warning)
2. Coordinate with them (chat, email, etc.)
3. Wait for them to finish
4. Or work on different entity

### Problem: Notification didn't appear
**Solution:**
1. Notifications refresh every 30 seconds
2. Click notification bell to manually refresh
3. Check notification tab in JCricket Dashboard

### Problem: Review queue is empty but I was assigned a review
**Solution:**
1. Refresh the page
2. Check that review wasn't already completed
3. Verify you're logged in as correct user

## Step 9: Keyboard Shortcuts (Future Enhancement)

Coming soon:
- `Ctrl+K` - Quick search
- `Ctrl+M` - Start merge
- `Ctrl+S` - Start split
- `Ctrl+R` - Open review queue
- `Ctrl+L` - Open event log

## Step 10: Getting Help

### In-App Resources
1. Hover over any icon for tooltip
2. Click "?" icon for contextual help
3. View operation status in dashboard

### Documentation
- **JCRICKET-FEATURES.md**: Complete feature documentation
- **JCRICKET-IMPLEMENTATION.md**: Technical implementation details
- **API_USAGE_EXAMPLES.md**: API integration examples

### Support
- Check event log for error messages
- Review collaboration statistics for system health
- Contact system administrator for access issues

## Summary

Moon's JCricket integration enables:
- **Collaborative cataloging** across multiple institutions
- **Quality control** through review workflows
- **Transparency** with complete audit trails
- **Efficiency** with language preferences
- **Accountability** with provenance tracking

Start small:
1. Set your language preferences
2. Edit entities from your institution
3. Watch notifications for updates
4. Learn merge/split workflows gradually
5. Review operations carefully

With practice, you'll become proficient at collaborative entity management and contribute to high-quality shared bibliographic data!

---

**Need More Help?**
- View detailed feature documentation: JCRICKET-FEATURES.md
- Check implementation guide: JCRICKET-IMPLEMENTATION.md
- Explore API documentation: API_USAGE_EXAMPLES.md

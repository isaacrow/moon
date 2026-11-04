# JCricket Collaborative Entity Management

Moon now includes comprehensive **JCricket-inspired** features for collaborative linked open data entity management, enabling multi-institutional shared cataloging workflows.

## Overview

JCricket is a collaborative entity editor designed for managing bibliographic entities in a shared environment. It enables libraries and institutions to cooperatively curate entity data, perform authority control, and maintain a high-quality knowledge base through structured workflows.

## Key Concepts

### Provenance and Prism

- **Provenance**: Represents a contributing institution or data source
- **Prism**: A multi-dimensional entity concept where each facet represents data from a single provenance
- **Leader Facet**: The primary data displayed by default (can be from any provenance)

Each entity cluster maintains links to records from different provenances, enabling transparent collaboration while preserving institutional contributions.

### User Roles

1. **Basic Editor**
   - Can edit properties from their own provenance only
   - Create new entities
   - View all entity data

2. **Advanced Editor**
   - Can edit all properties (whole prism)
   - Perform merge operations
   - Perform split operations
   - Request reviews

3. **Reviewer**
   - Approve or reject merge/split operations
   - Provide review notes and guidance

4. **Admin**
   - Full system access
   - Manage users and provenances

### Cluster Status

JCricket tracks entity status through the review workflow:

- **SV** (Saved) - Normal state
- **MD** (Merge Destination) - Entity designated as merge target
- **MS** (Merge Source) - Entity to be merged into destination
- **RN** (Review Needed) - Awaiting review approval
- **IN** (Invalidated) - Marked as tombstone (not searchable but preserved)
- **SG** (Split Giver) - Entity giving properties in split
- **SR** (Split Receiver) - Entity receiving properties in split

## Core Features

### 1. Entity Merge

**Purpose**: Consolidate multiple entities into one when they represent the same real-world entity.

**Workflow**:
1. Advanced editor selects 2+ entities to merge
2. Designates one as destination (others become sources)
3. Selects properties from source entities to copy to destination
4. Requests review from designated reviewer
5. Reviewer approves or rejects with notes
6. On approval: source entities are invalidated, destination updated

**Access**: Advanced Editors and Admins only

### 2. Entity Split

**Purpose**: Separate properties between entities when data has been incorrectly clustered.

**Workflow**:
1. Advanced editor selects giver and receiver entities
2. Chooses properties to move from giver to receiver
3. Requests review from designated reviewer
4. Reviewer approves or rejects with notes
5. On approval: properties transferred, both entities updated

**Access**: Advanced Editors and Admins only

### 3. Review Workflow

**Purpose**: Quality control for merge and split operations.

**Features**:
- Review queue with pending/in-progress/completed tabs
- Priority levels (low, medium, high)
- Detailed operation preview
- Review notes (required for rejection)
- Audit trail of all review decisions

**Access**: Reviewers, Advanced Editors, and Admins

### 4. Entity Event Log

**Purpose**: Complete history tracking of all entity changes.

**Tracked Events**:
- Create - New entity creation
- Edit - Property modifications
- Merge - Entity consolidation
- Split - Property separation
- Invalidate - Entity tombstoning
- Review Approve - Operation approval
- Review Reject - Operation rejection
- Property Add/Update/Delete - Field-level changes

**Features**:
- Filter by event type, user, cluster
- Search across all events
- Detailed change tracking (old value → new value)
- Metadata and provenance information

### 5. Notifications

**Purpose**: Keep users informed of relevant activities.

**Notification Types**:
- Merge review requested
- Split review requested
- Review approved
- Review rejected
- Concurrent edit warning
- Cluster updated

**Features**:
- Unread badge indicators
- Mark as read functionality
- Automatic polling (every 30 seconds)
- Action links to related entities

### 6. Language Filter

**Purpose**: Optimize cataloging workflow for multi-lingual environments.

**Features**:
- Select proficient cataloging languages
- Auto-display empty fields in selected languages
- Option to show all languages or only proficient ones
- Supports 20+ languages including:
  - English, Arabic, Spanish, French, German
  - Italian, Portuguese, Russian, Chinese, Japanese
  - Korean, Hindi, Turkish, Polish, Dutch
  - Swedish, Norwegian, Danish, Finnish, Hebrew

### 7. Collaboration Statistics

**Purpose**: Track institutional contributions and cataloging activity.

**Metrics**:
- Total clusters in knowledge base
- Clusters by provenance (institutional distribution)
- Recent edits (last 7 days)
- Pending reviews
- Merges this month
- Splits this month
- Active editors
- Top contributors (leaderboard)

### 8. Concurrent Edit Detection

**Purpose**: Prevent edit conflicts when multiple users work on same entity.

**Features**:
- Real-time session tracking
- Warning when another user is editing
- 5-minute edit session timeout
- Notification to coordinate edits

## Navigation

### Accessing JCricket Features

1. **From Main Dashboard**:
   - Click "JCricket" button in top toolbar
   - Or select "JCricket Collaborative" from quick actions

2. **JCricket Dashboard Tabs**:
   - **Notifications**: Recent system notifications
   - **Review Queue**: Pending merge/split reviews
   - **Provenance Stats**: Clusters by institution
   - **Top Contributors**: Monthly leaderboard

3. **Quick Actions**:
   - Search Entities
   - Event Log (Advanced+ only)
   - Language Preferences

### Navigation Flow

```
Main Dashboard
  ↓
JCricket Dashboard
  ├── Review Workflow → Approve/Reject Operations
  ├── Entity Event Log → View Complete History
  ├── Language Preferences → Configure Languages
  └── Entity Search → Find and Edit Clusters
```

## API Endpoints

All JCricket features are backed by RESTful API endpoints:

### User Profile
- `GET /jcricket/profile` - Get user profile and settings
- `PUT /jcricket/profile/languages` - Update language preferences

### Notifications
- `GET /jcricket/notifications` - Get all notifications
- `POST /jcricket/notifications/:id/read` - Mark as read

### Review Workflow
- `GET /jcricket/review-queue` - Get review queue
- `POST /jcricket/merge` - Request merge operation
- `POST /jcricket/split` - Request split operation
- `GET /jcricket/:type/:id` - Get operation details
- `POST /jcricket/:type/:id/approve` - Approve operation
- `POST /jcricket/:type/:id/reject` - Reject operation

### Events & Stats
- `GET /jcricket/events` - Get entity event log
- `GET /jcricket/stats` - Get collaboration statistics
- `GET /jcricket/cluster/:id/concurrent-edits` - Check concurrent edits

## Data Storage

JCricket uses the Supabase key-value store with structured prefixes:

```
jcricket:profile:{userId}              → User profile with role and settings
jcricket:provenance:{provenanceId}     → Provenance/institution data
jcricket:cluster:{clusterId}           → Entity cluster with facets
jcricket:merge:{operationId}           → Merge operation data
jcricket:split:{operationId}           → Split operation data
jcricket:review:{reviewId}             → Review queue item
jcricket:event:{eventId}               → Event log entry
jcricket:notification:{userId}:{id}    → User notification
jcricket:edit-session:{clusterId}:{userId} → Active edit session
```

## Collaboration Workflow Examples

### Example 1: Merging Duplicate Author Entities

1. **Discovery**: Cataloger finds two author entities for "Jane Smith"
2. **Selection**: Selects both entities, clicks "Merge"
3. **Designation**: Chooses entity with more complete data as destination
4. **Property Selection**: Selects valuable properties from source entity
5. **Review Request**: Designates senior cataloger as reviewer
6. **Review**: Reviewer examines merge, approves with notes
7. **Completion**: Source invalidated, destination enhanced
8. **Audit**: Event log records complete merge history

### Example 2: Splitting Incorrectly Clustered Subjects

1. **Detection**: Editor notices unrelated subjects clustered together
2. **Selection**: Chooses giver entity with mixed data
3. **Split Setup**: Selects receiver entity for moved properties
4. **Property Transfer**: Marks properties to move to receiver
5. **Review Request**: Requests review from subject specialist
6. **Review**: Specialist validates split logic, approves
7. **Completion**: Properties moved, both entities corrected
8. **Notification**: Requestor notified of approval

## Benefits

1. **Quality Assurance**: Review workflows ensure data accuracy
2. **Transparency**: Complete audit trails for all changes
3. **Collaboration**: Multi-institutional cooperation on field-by-field basis
4. **Provenance**: Track institutional contributions
5. **Authority Control**: Proper entity deduplication and reconciliation
6. **Scalability**: Designed for large multi-library consortia
7. **Flexibility**: Accommodates different institutional workflows
8. **Accountability**: Clear user attribution for all actions

## Best Practices

### For Basic Editors
- Focus on data from your institution
- Use language filters for efficiency
- Check concurrent edit warnings
- Document changes clearly

### For Advanced Editors
- Review entities thoroughly before merging/splitting
- Provide detailed notes in review requests
- Coordinate with other editors
- Monitor event logs for your entities

### For Reviewers
- Examine all property changes carefully
- Provide constructive feedback in notes
- Reject with clear guidance for improvement
- Approve only when confident in quality

### For Institutions
- Define clear provenance policies
- Train staff on collaborative workflows
- Establish review standards
- Monitor contribution statistics

## Future Enhancements

Potential future additions to Moon's JCricket implementation:

1. **GraphQL Subscriptions**: Real-time notifications without polling
2. **Advanced Entity Search**: Full-text search across clusters
3. **Batch Operations**: Merge/split multiple entities at once
4. **Workflow Templates**: Pre-defined review workflows
5. **Integration APIs**: Connect with ILS/LSP systems
6. **Wikidata Sync**: Bi-directional entity synchronization
7. **FOLIO Integration**: Direct connection to FOLIO Inventory
8. **Visual Entity Graph**: Relationship visualization
9. **AI-Assisted Matching**: ML-powered duplicate detection
10. **Custom Provenance Rules**: Institutional policy enforcement

## References

- [JCricket LOD Platform Documentation](https://wiki.svde.org/display/SE/JCricket+-+LOD+Platform+Entity+Editor)
- [BIBFRAME Workshop 2025 Presentation](https://wiki.svde.org/x/DQCNC)
- [Share-VDE Collaborative Cataloging](https://svde.org)
- Moon BIBFRAME 2.0 Implementation

---

**Note**: This is a prototype implementation inspired by JCricket. For production use with multiple institutions, additional features like authentication integration, role management UI, and provenance administration would be recommended.

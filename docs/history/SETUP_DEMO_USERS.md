# 🔐 Setting Up Demo Users for Testing

> **Deprecated:** this guide relies on the removed `/setup-demo` endpoint and `X-User-ID` development authentication. Do not run its commands against a deployed environment.

## Quick Start

MOON now requires authentication. Here's how to set up demo users for testing.

---

## Option 1: Automatic Demo Institution Setup

Run this endpoint once to create a complete demo environment:

```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/setup-demo
```

This creates:
- **Institution**: Demo Library (ID: `demo-inst`)
- **Users**:
  - Admin: `admin@demo.local` (ID: `demo-admin`)
  - Cataloger: `cataloger@demo.local` (ID: `demo-cataloger`)
  - Viewer: `viewer@demo.local` (ID: `demo-viewer`)

---

## Option 2: Manual User Creation

### 1. Create Institution

```typescript
const institution = await multiTenant.createInstitution({
  name: "Demo Library",
  code: "DEMO",
  baseUri: "https://demo.library.org",
  settings: {
    enableTripleStore: true,
    enableSHACLValidation: true,
    defaultLanguage: "en"
  }
});

// Save institution ID for next step
const institutionId = institution.id;
```

### 2. Create Admin User

```typescript
const admin = await multiTenant.createUser({
  email: "admin@demo.local",
  name: "Admin User",
  institutionId: institutionId,
  roles: ['admin']
});

// Save admin user ID
const adminUserId = admin.id;
```

### 3. Create Cataloger User

```typescript
const cataloger = await multiTenant.createUser({
  email: "cataloger@demo.local",
  name: "Cataloger User",
  institutionId: institutionId,
  roles: ['cataloger']
});
```

### 4. Create Viewer User

```typescript
const viewer = await multiTenant.createUser({
  email: "viewer@demo.local",
  name: "Viewer User",
  institutionId: institutionId,
  roles: ['viewer']
});
```

---

## Testing with Different Roles

### Admin (Full Access)

```bash
# Can create records
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records \
  -H "X-User-ID: demo-admin" \
  -H "Content-Type: application/json" \
  -d '{"document": {...}}'

# Can delete records
curl -X DELETE https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/rec-123 \
  -H "X-User-ID: demo-admin"

# Can merge authorities
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/authorities/merge \
  -H "X-User-ID: demo-admin" \
  -H "Content-Type: application/json" \
  -d '{"keepId": "auth-1", "mergeIds": ["auth-2", "auth-3"]}'

# Can execute SPARQL UPDATE
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/sparql/update \
  -H "X-User-ID: demo-admin" \
  -H "Content-Type: application/json" \
  -d '{"query": "INSERT DATA { ... }", "config": {...}}'
```

### Cataloger (Create/Edit Only)

```bash
# Can create records
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records \
  -H "X-User-ID: demo-cataloger" \
  -H "Content-Type: application/json" \
  -d '{"document": {...}}'

# Can edit records
curl -X PUT https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/rec-123 \
  -H "X-User-ID: demo-cataloger" \
  -H "Content-Type: application/json" \
  -d '{"document": {...}}'

# ❌ CANNOT delete records
curl -X DELETE https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/rec-123 \
  -H "X-User-ID: demo-cataloger"
# Returns: 403 Forbidden

# ❌ CANNOT merge authorities
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/authorities/merge \
  -H "X-User-ID: demo-cataloger" \
  -d '{"keepId": "auth-1", "mergeIds": ["auth-2"]}'
# Returns: 403 Forbidden (requires admin)
```

### Viewer (Read Only)

```bash
# Can read records
curl -X GET https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records \
  -H "X-User-ID: demo-viewer"

# Can search records
curl -X GET https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/search?q=test \
  -H "X-User-ID: demo-viewer"

# ❌ CANNOT create records
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records \
  -H "X-User-ID: demo-viewer" \
  -d '{"document": {...}}'
# Returns: 403 Forbidden (lacks records.create permission)

# ❌ CANNOT edit records
curl -X PUT https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/rec-123 \
  -H "X-User-ID: demo-viewer" \
  -d '{"document": {...}}'
# Returns: 403 Forbidden (lacks records.edit permission)
```

---

## Role Permissions Matrix

| Permission | Admin | Cataloger | Viewer |
|------------|-------|-----------|--------|
| `records.read` | ✅ | ✅ | ✅ |
| `records.create` | ✅ | ✅ | ❌ |
| `records.edit` | ✅ | ✅ | ❌ |
| `records.delete` | ✅ | ❌ | ❌ |
| `authorities.read` | ✅ | ✅ | ✅ |
| `authorities.create` | ✅ | ✅ | ❌ |
| `authorities.edit` | ✅ | ✅ | ❌ |
| `authorities.merge` | ✅ | ❌ | ❌ |
| `sparql.read` | ✅ | ✅ | ✅ |
| `sparql.update` | ✅ | ❌ | ❌ |
| `system.admin` | ✅ | ❌ | ❌ |

---

## Frontend Integration

### Store User ID in State

```typescript
// In your React app
const [userId, setUserId] = useState<string>('demo-admin');

// When making API calls
const response = await fetch(`${apiUrl}/moon/records`, {
  headers: {
    'X-User-ID': userId,
    'Content-Type': 'application/json'
  }
});
```

### Handle Authentication Errors

```typescript
if (response.status === 401) {
  // User not authenticated
  alert('Please log in');
  // Redirect to login
}

if (response.status === 403) {
  // User lacks permission
  alert('You do not have permission to perform this action');
}
```

### Show/Hide UI Based on Role

```typescript
const [user, setUser] = useState<User | null>(null);

// Load user on mount
useEffect(() => {
  fetch(`${apiUrl}/moon/users/${userId}`, {
    headers: { 'X-User-ID': userId }
  })
    .then(res => res.json())
    .then(data => setUser(data));
}, [userId]);

// Conditionally render buttons
{user?.roles.includes('admin') && (
  <button onClick={handleDelete}>Delete Record</button>
)}

{user?.permissions.includes('records.create') && (
  <button onClick={handleCreate}>Create Record</button>
)}
```

---

## Testing Multi-Tenant Isolation

### Create Second Institution

```typescript
const institution2 = await multiTenant.createInstitution({
  name: "Other Library",
  code: "OTHER",
  baseUri: "https://other.library.org"
});

const otherUser = await multiTenant.createUser({
  email: "user@other.local",
  name: "Other User",
  institutionId: institution2.id,
  roles: ['cataloger']
});
```

### Test Cross-Tenant Access

```bash
# Demo user creates record in demo institution
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records \
  -H "X-User-ID: demo-admin" \
  -d '{"id": "demo-rec-1", "document": {...}}'

# Other user tries to access demo record
curl -X GET https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/demo-rec-1 \
  -H "X-User-ID: other-user-id"
# Returns: 404 Not found (cross-tenant access blocked)

# Other user creates their own record
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records \
  -H "X-User-ID: other-user-id" \
  -d '{"id": "other-rec-1", "document": {...}}'

# Demo user cannot see other's record
curl -X GET https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records/other-rec-1 \
  -H "X-User-ID: demo-admin"
# Returns: 404 Not found (isolation working!)
```

---

## Troubleshooting

### "401 Unauthorized" Error

**Problem**: Missing or invalid user ID

**Solution**:
```bash
# Check user exists
curl https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/users/demo-admin

# If not found, create demo users first
curl -X POST https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/setup-demo
```

### "403 Forbidden" Error

**Problem**: User lacks required permission

**Solution**:
```bash
# Check user's permissions
curl https://PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/users/demo-cataloger

# Response shows:
{
  "permissions": ["records.read", "records.create", "records.edit"],
  "roles": ["cataloger"]
}

# Use admin user for admin operations
curl -X DELETE ... -H "X-User-ID: demo-admin"
```

### "404 Not Found" (but record exists)

**Problem**: Cross-tenant access attempt

**Solution**:
```bash
# Check which institution owns the record
# Use correct user from same institution
```

---

## Production Migration

When deploying to production, replace `X-User-ID` header with real authentication:

```typescript
// Development (current)
const userId = c.req.header('X-User-ID');

// Production (JWT)
import { createClient } from '@supabase/supabase-js';

const token = c.req.header('Authorization')?.replace('Bearer ', '');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { user }, error } = await supabase.auth.getUser(token);

if (!user) {
  return c.json({ error: 'Unauthorized' }, 401);
}

// Map Supabase user to MOON user
const moonUser = await multiTenant.getUserByEmail(user.email);
```

---

## Summary

✅ **All endpoints now require authentication**  
✅ **Role-based permissions enforced**  
✅ **Multi-tenant isolation working**  
✅ **Admin-only operations restricted**  

Use `X-User-ID` header for all API calls during development.

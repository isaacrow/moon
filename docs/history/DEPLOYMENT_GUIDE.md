# 🚀 MOON Production Deployment Guide

> **Outdated instructions:** this guide references the removed `/setup-demo` endpoint and should not be followed for deployment. See the current production readiness audit and use Supabase Auth only.

## Quick Start: 3 Steps to Production

### Step 1: Set Up Authentication (15 minutes)

```bash
# 1. Create demo institution and users
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/setup-demo

# 2. For production, set up Supabase Auth:
# - Go to Supabase Dashboard > Authentication
# - Enable Email provider
# - Optional: Enable Google/GitHub OAuth

# 3. Create institutional admin
const { data } = await supabase.auth.admin.createUser({
  email: 'admin@yourlibrary.org',
  password: 'secure-password',
  email_confirm: true,
  app_metadata: {
    institutionId: 'your-inst-id',
    roles: ['admin']
  }
});
```

### Step 2: Configure Triple Store (Optional, 10 minutes)

```bash
# Install Apache Jena Fuseki
docker run -p 3030:3030 stain/jena-fuseki

# Create dataset named 'moon'
# Access at http://localhost:3030/moon/query
```

### Step 3: Test & Monitor (5 minutes)

```bash
# Check system health
curl https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/health

# Run load test
curl -X POST -H "Authorization: Bearer <admin-token>" \
  https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/test/benchmark/list \
  -d '{"limit": 100}'

# Monitor logs
curl -H "Authorization: Bearer <admin-token>" \
  https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/admin/audit
```

---

## Complete Setup Guide

### Prerequisites

- Supabase project
- Optional: Triple store (Fuseki/GraphDB/Blazegraph)
- Node.js for client applications

### 1. Initial Setup

#### Create Institution

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create institution via MOON API
const response = await fetch(`${apiUrl}/moon/institutions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Your Library Name",
    code: "YOURLIB",
    baseUri: "https://yourlibrary.org",
    settings: {
      enableTripleStore: true,
      enableSHACLValidation: true,
      defaultLanguage: "en"
    }
  })
});

const institution = await response.json();
```

#### Create Users

```typescript
// Admin user
const { data: admin } = await supabase.auth.admin.createUser({
  email: 'admin@yourlibrary.org',
  password: 'secure-password',
  email_confirm: true,
  app_metadata: {
    institutionId: institution.id,
    roles: ['admin']
  }
});

// Cataloger user
const { data: cataloger } = await supabase.auth.admin.createUser({
  email: 'cataloger@yourlibrary.org',
  password: 'secure-password',
  email_confirm: true,
  app_metadata: {
    institutionId: institution.id,
    roles: ['cataloger']
  }
});

// Viewer user
const { data: viewer } = await supabase.auth.admin.createUser({
  email: 'viewer@yourlibrary.org',
  password: 'secure-password',
  email_confirm: true,
  app_metadata: {
    institutionId: institution.id,
    roles: ['viewer']
  }
});
```

### 2. Frontend Integration

#### Install Dependencies

```bash
npm install @supabase/supabase-js
```

#### Create Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const moonApiUrl = process.env.NEXT_PUBLIC_MOON_API_URL!;
```

#### Authentication Hook

```typescript
// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
```

#### API Helper

```typescript
// lib/moon-api.ts
import { supabase, moonApiUrl } from './supabase';

export async function moonFetch(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${moonApiUrl}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Example usage functions
export const moonApi = {
  // Records
  async listRecords() {
    return moonFetch('/moon/records');
  },

  async getRecord(id: string) {
    return moonFetch(`/moon/records/${id}`);
  },

  async createRecord(document: any) {
    return moonFetch('/moon/records', {
      method: 'POST',
      body: JSON.stringify({ document })
    });
  },

  async updateRecord(id: string, document: any) {
    return moonFetch(`/moon/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ document })
    });
  },

  async deleteRecord(id: string) {
    return moonFetch(`/moon/records/${id}`, {
      method: 'DELETE'
    });
  },

  // Search
  async search(query: string) {
    return moonFetch(`/moon/search?q=${encodeURIComponent(query)}`);
  },

  // Authorities
  async listAuthorities(type?: string) {
    const params = type ? `?type=${type}` : '';
    return moonFetch(`/moon/authorities${params}`);
  },

  async mergeAuthorities(keepId: string, mergeIds: string[]) {
    return moonFetch('/moon/authorities/merge', {
      method: 'POST',
      body: JSON.stringify({ keepId, mergeIds })
    });
  },

  // Validation
  async validate(document: any, tripleStoreConfig?: any) {
    return moonFetch('/moon/validate', {
      method: 'POST',
      body: JSON.stringify({ document, tripleStoreConfig })
    });
  }
};
```

### 3. OAuth Configuration (Optional)

#### Enable Google OAuth

1. Go to Supabase Dashboard > Authentication > Providers
2. Enable Google
3. Add OAuth credentials from Google Cloud Console
4. Set redirect URL: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

#### Frontend OAuth Button

```typescript
// components/LoginButton.tsx
import { supabase } from '@/lib/supabase';

export function LoginButton() {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error('OAuth error:', error);
    }
  };

  return (
    <button onClick={handleGoogleLogin}>
      Sign in with Google
    </button>
  );
}
```

### 4. Triple Store Setup (Optional but Recommended)

#### Apache Jena Fuseki (Docker)

```bash
docker run -d \
  --name jena-fuseki \
  -p 3030:3030 \
  -e ADMIN_PASSWORD=admin \
  stain/jena-fuseki

# Create dataset
curl -X POST http://localhost:3030/$/datasets \
  -u admin:admin \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "dbName=moon&dbType=tdb2"
```

#### GraphDB (Local Installation)

1. Download GraphDB Free from Ontotext
2. Create repository named "moon"
3. Enable SHACL validation in repository settings
4. Use endpoint: `http://localhost:7200/repositories/moon`

#### Blazegraph (Docker)

```bash
docker run -d \
  --name blazegraph \
  -p 9999:9999 \
  lyrasis/blazegraph:2.1.5

# Access at http://localhost:9999/blazegraph
```

### 5. Configure MOON with Triple Store

```typescript
// Store in your frontend config
const tripleStoreConfig = {
  type: 'fuseki', // or 'graphdb' or 'blazegraph'
  endpoint: 'http://localhost:3030/moon/query',
  auth: {
    username: 'admin',
    password: 'admin'
  }
};

// Use when creating records
await moonApi.createRecord(document);

// Upload to triple store automatically
const graphUri = `https://yourlibrary.org/record/${recordId}`;
await fetch(`${moonApiUrl}/moon/triplestore/upload/${recordId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ graphUri, config: tripleStoreConfig })
});
```

---

## Monitoring & Operations

### Daily Checks

```bash
# 1. System health
curl https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/health

# Response should be:
# { "status": "healthy", "metrics": {...}, "issues": [] }

# 2. Recent errors (admin only)
curl -H "Authorization: Bearer <admin-token>" \
  https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/admin/errors?severity=critical

# 3. Performance metrics
curl -H "Authorization: Bearer <admin-token>" \
  https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/admin/metrics
```

### Weekly Reviews

- Review audit logs for unusual activity
- Check error trends
- Monitor performance degradation
- Review failed SHACL validations
- Check triple store sync status

### Monthly Maintenance

- Analyze usage patterns
- Optimize slow queries
- Review authority merge history
- Clean up test data
- Update documentation

---

## Performance Optimization

### Enable Caching (Frontend)

```typescript
// lib/cache.ts
const cache = new Map();

export async function cachedFetch(key: string, fetcher: () => Promise<any>) {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const data = await fetcher();
  cache.set(key, data);
  
  // Clear after 5 minutes
  setTimeout(() => cache.delete(key), 5 * 60 * 1000);
  
  return data;
}

// Usage
const records = await cachedFetch('records:list', () => moonApi.listRecords());
```

### Use Pagination

```typescript
// Always paginate large result sets
const page = 1;
const limit = 50;

const records = await moonFetch(`/moon/records?limit=${limit}&offset=${(page - 1) * limit}`);
```

### Offload Search to Triple Store

```typescript
// For complex queries, use SPARQL
const query = `
  PREFIX bf: <http://id.loc.gov/ontologies/bibframe/>
  
  SELECT ?work ?title
  WHERE {
    ?work a bf:Work ;
          bf:title ?titleNode .
    ?titleNode bf:mainTitle ?title .
    FILTER(CONTAINS(?title, "${searchTerm}"))
  }
  LIMIT 50
`;

const results = await moonFetch('/moon/sparql/query', {
  method: 'POST',
  body: JSON.stringify({ query, config: tripleStoreConfig })
});
```

---

## Security Best Practices

### 1. Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_MOON_API_URL=https://your-project.supabase.co/functions/v1/make-server-49c0e13c

# Server-side only (not NEXT_PUBLIC)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

### 2. Row-Level Security

Already enforced in MOON - all data is partitioned by institution ID.

### 3. Rate Limiting

```typescript
// Optional: Add client-side rate limiting
let requestCount = 0;
let resetTime = Date.now() + 60000;

async function rateLimitedFetch(url: string, options: any) {
  if (Date.now() > resetTime) {
    requestCount = 0;
    resetTime = Date.now() + 60000;
  }

  if (requestCount >= 100) {
    throw new Error('Rate limit exceeded. Try again in a minute.');
  }

  requestCount++;
  return fetch(url, options);
}
```

### 4. CORS Configuration

Supabase Edge Functions already handle CORS. No additional configuration needed.

---

## Troubleshooting

### "401 Unauthorized"

**Problem:** Missing or invalid JWT token

**Solution:**
```typescript
// Check if user is signed in
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  // Redirect to login
  window.location.href = '/login';
}
```

### "403 Forbidden"

**Problem:** User lacks required permission

**Solution:**
```typescript
// Check user roles
const { data: { user } } = await supabase.auth.getUser();
const roles = user?.app_metadata?.roles || [];

if (!roles.includes('admin')) {
  alert('This action requires administrator privileges');
}
```

### "500 Internal Server Error"

**Problem:** Server-side error

**Solution:**
```bash
# Check error logs (admin only)
curl -H "Authorization: Bearer <admin-token>" \
  https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/admin/errors?severity=critical
```

### Slow Performance

**Problem:** Too many records, no pagination

**Solution:**
```typescript
// Always use pagination
const records = await moonApi.listRecords({ limit: 50, offset: 0 });

// Or offload to SPARQL
const results = await moonApi.sparqlQuery(query, tripleStoreConfig);
```

---

## Backup & Recovery

### Export All Data

```bash
# Export records (admin only)
curl -H "Authorization: Bearer <admin-token>" \
  https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/records > records-backup.json

# Export authorities
curl -H "Authorization: Bearer <admin-token>" \
  https://YOUR-PROJECT.supabase.co/functions/v1/make-server-49c0e13c/moon/authorities > authorities-backup.json
```

### Triple Store Backup

```bash
# Fuseki
curl -X POST http://localhost:3030/$/backup/moon > fuseki-backup.nq

# GraphDB
# Use GraphDB Workbench > Export repository
```

---

## Going to Production Checklist

- [ ] Supabase Auth configured
- [ ] Institution created
- [ ] Admin users created
- [ ] OAuth providers enabled (optional)
- [ ] Triple store set up (optional)
- [ ] Load testing completed
- [ ] Performance benchmarks documented
- [ ] Health monitoring set up
- [ ] Error logging verified
- [ ] Backup strategy implemented
- [ ] Security review completed
- [ ] User training completed
- [ ] Documentation updated

---

## Support & Resources

### Documentation
- `/SECURITY_IMPLEMENTATION.md` - Security architecture
- `/PHASE_5_COMPLETE.md` - Operational hardening details
- `/LOAD_TESTING.md` - Performance testing guide
- `/DATABASE_MIGRATION_LIMITATIONS.md` - Platform constraints

### Endpoints
- Health: `GET /health`
- Audit Logs: `GET /admin/audit`
- Error Logs: `GET /admin/errors`
- Metrics: `GET /admin/metrics`

### Contact
For institutional deployments, ensure you have:
- Triple store infrastructure
- Backup systems
- Monitoring dashboards
- User support processes

---

**MOON is production-ready for pilot institutional deployments.**  
**For scale beyond 10,000 records, plan PostgreSQL migration.**

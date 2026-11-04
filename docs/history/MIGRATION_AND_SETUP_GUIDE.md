# MOON SAND V2 - Migration to Real Backend & Project Setup Guide

> Written for: Isaac Faleh
> Date: March 6, 2026
> Current stack: React 18 + Vite 6 + Tailwind CSS v4 + Supabase Edge Functions (Hono/Deno)

---

## Table of Contents

1. [How to Run This Project (Current Figma Make Environment)](#1-how-to-run-this-project-current-figma-make-environment)
2. [Project Architecture Overview](#2-project-architecture-overview)
3. [Step-by-Step: Migrate to a Real Backend](#3-step-by-step-migrate-to-a-real-backend)
4. [Wiring the Frontend to the New Backend](#4-wiring-the-frontend-to-the-new-backend)
5. [Environment Variables & Secrets](#5-environment-variables--secrets)
6. [Database Migration](#6-database-migration)
7. [Deploying to Production](#7-deploying-to-production)
8. [Known Issues & Warnings](#8-known-issues--warnings)

---

## 1. How to Run This Project (Current Figma Make Environment)

### Prerequisites
- Node.js >= 18 (v20+ recommended)
- pnpm (the project uses pnpm as its package manager)
- A Supabase project (already provisioned: `gfbagczwhvxxstbfrfhu`)
- Deno >= 1.40 (for running the server/Edge Functions locally)

### Frontend (React/Vite)

```bash
# 1. Clone/download the project files

# 2. Install dependencies
pnpm install

# 3. Start the Vite dev server
pnpm run dev
# The app will be available at http://localhost:5173

# 4. Build for production
pnpm run build
# Output goes to /dist
```

**Entry points:**
- `index.html` -- HTML shell, loads `/src/main.tsx`
- `/src/main.tsx` -- React root, renders `<App />`
- `/src/app/App.tsx` -- Main application component (Dashboard, routing, lazy-loaded views)

### Backend (Supabase Edge Functions / Hono + Deno)

The backend is a single Hono web server at `/supabase/functions/server/index.tsx` with 37 supporting modules in the same directory.

```bash
# 1. Install the Supabase CLI
npm install -g supabase

# 2. Link to your Supabase project
supabase link --project-ref gfbagczwhvxxstbfrfhu

# 3. Set your secrets (see Section 5 for full list)
supabase secrets set OPENAI_API_KEY=sk-your-new-rotated-key
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set LLAMA_API_KEY=your-llama-key
# Optional for higher rate limits:
supabase secrets set EUROPEANA_API_KEY=your-key
supabase secrets set DPLA_API_KEY=your-key
supabase secrets set ISBNDB_API_KEY=your-key

# 4. Run the Edge Function locally
supabase functions serve server --no-verify-jwt
# Server will be at http://localhost:54321/functions/v1/make-server-49c0e13c/health

# 5. Deploy to production
supabase functions deploy server
```

### Default Login
- Username: `demo`
- Password: `demo123`
- (The server auto-creates this user on boot via `createDemoUserIfNeeded()`)

---

## 2. Project Architecture Overview

```
Frontend (React + Vite)                    Backend (Supabase Edge Functions)
========================                   =================================
/src/app/App.tsx (entry)                   /supabase/functions/server/index.tsx (Hono server)
/src/app/components/                       /supabase/functions/server/*.tsx (37 modules)
  - BlueMoon.tsx (main editor)               - aiEngine.tsx (5-phase AI engine)
  - Dashboard.tsx                            - aiProviders.tsx (OpenAI/Gemini/LLaMA)
  - MoonNexus.tsx (5 tabs)                   - aiRouter.tsx (MOON DIJLA multi-AI router)
  - MoonAIOrchestrator.tsx (10 tabs)         - discoveryProviders.tsx (19 federated sources)
  - MoonDijlaCore.tsx (8 tabs)               - ld4Integration.tsx (LD4 platform)
  - DijlaPlatform.tsx                        - moonRecords.tsx (record CRUD)
  - LD4Platform.tsx                          - kv_store.tsx (KV persistence layer)
  - LinkedDataDiscovery.tsx                  - ...and 30 more modules
  - 100+ more components
/src/services/ (client-side services)      Database
/src/styles/ (Tailwind + theme CSS)        ========
/utils/supabase/info.tsx (project config)  Supabase PostgreSQL
                                             - kv_store_49c0e13c (key-value table)
                                             - Supabase Auth (users)
```

**How frontend talks to backend:**
- All API calls use: `https://{projectId}.supabase.co/functions/v1/make-server-49c0e13c/{route}`
- Auth header: `Authorization: Bearer {publicAnonKey}` (or user's access_token for protected routes)
- The `projectId` and `publicAnonKey` are imported from `/utils/supabase/info.tsx`

**30 files import from `/utils/supabase/info.tsx`:**
```
AuthContext.tsx, Dashboard.tsx, BlueMoon.tsx, MoonNexus.tsx,
MoonAIOrchestrator.tsx, MoonDijlaCore.tsx, DijlaPlatform.tsx,
LD4Platform.tsx, LinkedDataDiscovery.tsx, MoonAI.tsx, MoonEngine.tsx,
MoonOPAC.tsx, MoonWave101.tsx, EnterpriseAIEngine.tsx, BlueMoonAIPanel.tsx,
BibframeSearchPage.tsx, AuthoritySearch.tsx, AuthorityManager.tsx,
SparqlInterface.tsx, VersionHistory.tsx, FileImportDialog.tsx,
ImportRecordDialog.tsx, EntityMerge.tsx, EntitySplit.tsx,
ReviewWorkflow.tsx, EntityEventLog.tsx, MultiSourceAuthorityField.tsx,
MoonEngineClassic.tsx, MoonEngineClassicClean.tsx, MoonEngineBlur.tsx,
ISBNdbDiagnostic.tsx, MoonWaveDiagnostic.tsx
```

---

## 3. Step-by-Step: Migrate to a Real Backend

You have two main options:

### Option A: Keep Supabase, Self-Host or Use Supabase Cloud (Recommended - Least Work)

Your backend is already written for Supabase Edge Functions. This is the easiest path.

**Steps:**

1. **Create a new Supabase project** (or keep using the current one)
   - Go to https://supabase.com/dashboard
   - Create a new project or use `gfbagczwhvxxstbfrfhu`

2. **Create the KV store table** in your Supabase SQL Editor:
   ```sql
   CREATE TABLE IF NOT EXISTS kv_store_49c0e13c (
     key TEXT NOT NULL PRIMARY KEY,
     value JSONB NOT NULL
   );
   ```

3. **Deploy the Edge Function:**
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy server
   ```

4. **Set all secrets** (see Section 5)

5. **Update `/utils/supabase/info.tsx`** with your new project's values:
   ```ts
   export const projectId = "YOUR_NEW_PROJECT_ID"
   export const publicAnonKey = "YOUR_NEW_ANON_KEY"
   ```

6. **Build and deploy the frontend** to Vercel/Netlify/any static host:
   ```bash
   pnpm run build
   # Upload /dist to your hosting provider
   ```

### Option B: Migrate to a Standalone Node.js/Express Backend

If you want to leave Supabase entirely and run your own server:

**Step 1: Create a new Node.js project for the backend**

```bash
mkdir moon-sand-server
cd moon-sand-server
npm init -y
npm install express cors hono @supabase/supabase-js dotenv
npm install -D typescript @types/node tsx
```

**Step 2: Convert the Deno server files to Node.js**

The 37 server files in `/supabase/functions/server/` need these changes:

| Deno Pattern | Node.js Equivalent |
|---|---|
| `import { Hono } from "npm:hono"` | `import { Hono } from "hono"` |
| `import { cors } from "npm:hono/cors"` | `import { cors } from "hono/cors"` |
| `import { createClient } from "jsr:@supabase/supabase-js@2"` | `import { createClient } from "@supabase/supabase-js"` |
| `Deno.env.get("OPENAI_API_KEY")` | `process.env.OPENAI_API_KEY` |
| `Deno.serve(app.fetch)` | `serve({ fetch: app.fetch, port: 3001 })` (using `@hono/node-server`) |

**Step 3: Create a conversion script or do it manually:**

```bash
# For each .tsx file in /supabase/functions/server/:
# 1. Remove "npm:" and "jsr:" prefixes from imports
# 2. Replace Deno.env.get("X") with process.env.X
# 3. Replace Deno.serve() with @hono/node-server serve()
```

**Step 4: Replace the KV store**

The `kv_store.tsx` uses Supabase PostgreSQL. Replace with:
- **PostgreSQL directly** (using `pg` or `postgres` package)
- **Redis** (using `ioredis`)
- **SQLite** (using `better-sqlite3`)
- **Or keep Supabase** as just a database (you can still use `@supabase/supabase-js` in Node)

**Step 5: Replace Supabase Auth**

- Use **Passport.js** or **next-auth** or **Auth0** or **Firebase Auth**
- Or keep Supabase Auth as a standalone service (it works independently)

**Step 6: Update the server entry point**

```ts
// server/index.ts (Node.js version)
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import 'dotenv/config'

const app = new Hono()
app.use('*', logger())
app.use('/*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }))

// ... import and register all your routes ...

serve({ fetch: app.fetch, port: 3001 })
console.log('Moon Engine running on http://localhost:3001')
```

---

## 4. Wiring the Frontend to the New Backend

### The Single Connection Point

The frontend connects to the backend through ONE configuration file:

**`/utils/supabase/info.tsx`** (currently):
```ts
export const projectId = "gfbagczwhvxxstbfrfhu"
export const publicAnonKey = "eyJhbGciOiJI..."
```

Every API call in the app constructs URLs like:
```ts
`https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c/${route}`
```

### Option A: If staying on Supabase
Just update `projectId` and `publicAnonKey` in `/utils/supabase/info.tsx`.

### Option B: If migrating to your own server

**Step 1: Create an API config file to replace `/utils/supabase/info.tsx`**

```ts
// /utils/supabase/info.tsx (modified for custom backend)
export const projectId = "" // no longer needed
export const publicAnonKey = "" // no longer needed

// New: your custom API base URL
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"
```

**Step 2: Create a `.env` file at the project root**

```env
VITE_API_URL=http://localhost:3001
```

For production:
```env
VITE_API_URL=https://api.yourdomain.com
```

**Step 3: Find-and-replace all API URL constructions**

Search for this pattern across all 30+ files:
```ts
// OLD (Supabase Edge Function pattern):
`https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c/${route}`

// NEW (custom server pattern):
`${API_BASE}/${route}`
```

The specific files to update (all 30 files listed in Section 2 above).

**Step 4: Update auth headers**

Search for:
```ts
Authorization: `Bearer ${publicAnonKey}`
```
Replace with your new auth mechanism (JWT, API key, session cookie, etc.)

**Step 5: Update the route prefix**

On your new server, you can drop the `/make-server-49c0e13c` prefix:
```ts
// Old: app.get("/make-server-49c0e13c/health", ...)
// New: app.get("/api/health", ...)
```

Then update the frontend URL construction to match.

### Recommended: Create an API client module

Instead of updating 30+ files individually, create a centralized API client:

```ts
// /src/services/apiClient.ts
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api"

export async function apiGet(route: string, token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/${route}`, { headers })
  if (!res.ok) throw new Error(`API ${route}: ${res.status}`)
  return res.json()
}

export async function apiPost(route: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/${route}`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`API ${route}: ${res.status}`)
  return res.json()
}

// ... apiPut, apiDelete, etc.
```

Then refactor each component to use `apiGet("health")` instead of the full URL construction.

---

## 5. Environment Variables & Secrets

### Backend Secrets (Supabase or .env)

| Secret | Status | Description |
|--------|--------|-------------|
| `SUPABASE_URL` | Auto-set by Supabase | Supabase project URL |
| `SUPABASE_ANON_KEY` | Auto-set by Supabase | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase | Service role key (NEVER expose to frontend!) |
| `SUPABASE_DB_URL` | Auto-set by Supabase | Direct PostgreSQL connection string |
| `OPENAI_API_KEY` | **NEEDS ROTATION** | Go to platform.openai.com/api-keys, create new key, then `supabase secrets set OPENAI_API_KEY=sk-new-key` |
| `GEMINI_API_KEY` | **NEEDS TO BE SET** | Get from Google AI Studio, then `supabase secrets set GEMINI_API_KEY=your-key` |
| `LLAMA_API_KEY` | **NEEDS TO BE SET** | Get from Meta/Fireworks/Together AI, then `supabase secrets set LLAMA_API_KEY=your-key` |
| `ISBNDB_API_KEY` | Set | ISBNdb API key |
| `EUROPEANA_API_KEY` | Optional | For higher Europeana rate limits |
| `DPLA_API_KEY` | Optional | For higher DPLA rate limits |

### Frontend Environment (.env at project root for Vite)

```env
# Only needed if migrating away from Supabase
VITE_API_URL=https://your-api-domain.com
VITE_SUPABASE_URL=https://gfbagczwhvxxstbfrfhu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

> **CRITICAL**: Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend code or VITE_ env vars!

---

## 6. Database Migration

### Current Schema

The project uses ONE table:

```sql
CREATE TABLE kv_store_49c0e13c (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);
```

All data is stored as key-value pairs. Known key patterns:

| Key Pattern | Used By | Description |
|---|---|---|
| `field-templates-all` | BlueMoon.tsx | Saved field customization templates |
| `record:*` | moonRecords.tsx | BIBFRAME records |
| `version:*` | versioning.tsx | Record version history |
| `audit:*` | auditLog.tsx | Audit trail entries |
| `tenant:*` | multiTenant.tsx | Multi-tenant data |
| `triple:*` | tripleStore.tsx | RDF triple store |

### If migrating to your own PostgreSQL

```sql
-- Create the same table in your new database:
CREATE TABLE kv_store_49c0e13c (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);

-- Export existing data from Supabase:
-- Go to Supabase Dashboard > Table Editor > kv_store_49c0e13c > Export CSV

-- Or use pg_dump:
pg_dump --data-only --table=kv_store_49c0e13c YOUR_SUPABASE_DB_URL > kv_data.sql
psql YOUR_NEW_DB_URL < kv_data.sql
```

### If migrating to a proper relational schema (future)

Eventually you'll want dedicated tables:

```sql
CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'Work', 'Instance', 'Item'
  data JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE field_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_template TEXT,
  hidden_fields TEXT[],
  all_fields TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ... more tables for versions, triples, etc.
```

---

## 7. Deploying to Production

### Frontend Deployment (Vercel - Recommended)

```bash
# 1. Build
pnpm run build

# 2. Install Vercel CLI
npm i -g vercel

# 3. Deploy
vercel --prod

# 4. Set env vars in Vercel Dashboard:
#    VITE_API_URL = https://your-api.yourdomain.com
```

**Or use Netlify:**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

**Or use any static hosting** (the frontend is just static HTML/JS/CSS after build):
- AWS S3 + CloudFront
- Google Cloud Storage + Cloud CDN
- GitHub Pages
- Firebase Hosting

### Backend Deployment

**Option A: Supabase Edge Functions (current, simplest)**
```bash
supabase functions deploy server
```

**Option B: Your own server**
- **Railway.app**: Push to GitHub, connect Railway, auto-deploys
- **Fly.io**: `fly launch` then `fly deploy`
- **AWS ECS/Fargate**: Docker container
- **DigitalOcean App Platform**: Auto-deploy from GitHub
- **VPS (any provider)**: Install Node.js, run with PM2

Example Dockerfile:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

---

## 8. Known Issues & Warnings

### DO NOT TOUCH
- **BlueMoon.tsx dynamic import error**: There is a persistent `TypeError: Failed to fetch dynamically imported module` on `BlueMoon.tsx`. Do NOT attempt to fix this unless explicitly asked.

### API Key Security
- The OpenAI API key was previously exposed and needs rotation at https://platform.openai.com/api-keys
- After rotating, update the Supabase secret: `supabase secrets set OPENAI_API_KEY=sk-new-key`
- `GEMINI_API_KEY` and `LLAMA_API_KEY` Supabase secrets still need to be created for the MOON DIJLA multi-AI router fallback chain

### CORS
- The VIAF authority lookup was fixed to use `https://viaf.org/` (no `www.`)
- If moving to your own server, ensure CORS is configured to allow your frontend domain:
  ```ts
  cors({ origin: ['https://yourdomain.com', 'http://localhost:5173'] })
  ```

### Supabase-Specific Code
- `kv_store.tsx` uses `Deno.env.get()` -- must be changed to `process.env` for Node.js
- Auth uses `supabase.auth.admin.createUser()` -- requires service role key
- The boot sequence in `index.tsx` calls `Deno.exit(1)` on failure -- change to `process.exit(1)` for Node.js

---

## Quick Reference: File Counts

| Category | Count |
|---|---|
| Frontend components | 130+ .tsx files |
| Backend server modules | 37 .tsx files |
| Frontend services | 35+ .ts files |
| CSS/Theme files | 11 files |
| API routes (server) | 166+ routes |
| Files importing supabase/info | 30 files |
| i18n supported languages | 2 (English + Arabic) |

---

## Migration Checklist

- [ ] Rotate OpenAI API key at platform.openai.com/api-keys
- [ ] Set new `OPENAI_API_KEY` in Supabase secrets
- [ ] Set `GEMINI_API_KEY` in Supabase secrets
- [ ] Set `LLAMA_API_KEY` in Supabase secrets
- [ ] Create KV table in target database
- [ ] Export existing KV data from current Supabase
- [ ] Update `/utils/supabase/info.tsx` with new credentials
- [ ] If Option B: Convert all `Deno.env.get()` to `process.env`
- [ ] If Option B: Remove `npm:` and `jsr:` import prefixes
- [ ] If Option B: Replace `Deno.serve()` with Node server
- [ ] If Option B: Update all 30 frontend files with new API URL pattern
- [ ] Test all major flows: Login, Create Record, Save, AI Engine, Discovery
- [ ] Deploy frontend to static host
- [ ] Deploy backend to server
- [ ] Configure production CORS
- [ ] Set up monitoring/logging

# Building MOON in Karbala 222

## Step-by-Step Guide: How to Run the MOON SAND V2 Project in VS Code

**Author:** Isaac Faleh
**Date:** March 7, 2026

---

## Table of Contents

1. [Prerequisites - What You Need Installed](#step-1-prerequisites---what-you-need-installed)
2. [Get the Source Code](#step-2-get-the-source-code)
3. [Open the Project in VS Code](#step-3-open-the-project-in-vs-code)
4. [Understand the Project Structure](#step-4-understand-the-project-structure)
5. [Set Up Supabase (Database + Auth + Backend)](#step-5-set-up-supabase-database--auth--backend)
6. [Create the Database Table](#step-6-create-the-database-table)
7. [Configure Environment Variables / Secrets](#step-7-configure-environment-variables--secrets)
8. [Update the Frontend Configuration](#step-8-update-the-frontend-configuration)
9. [Install Frontend Dependencies](#step-9-install-frontend-dependencies)
10. [Run the Frontend (Dev Server)](#step-10-run-the-frontend-dev-server)
11. [Deploy the Backend (Supabase Edge Function)](#step-11-deploy-the-backend-supabase-edge-function)
12. [Set Up AI API Keys (Optional but Recommended)](#step-12-set-up-ai-api-keys-optional-but-recommended)
13. [Test That Everything Works](#step-13-test-that-everything-works)
14. [Common Errors and How to Fix Them](#step-14-common-errors-and-how-to-fix-them)
15. [VS Code Extensions You Should Install](#step-15-vs-code-extensions-you-should-install)
16. [How to Make Changes and Develop](#step-16-how-to-make-changes-and-develop)
17. [How to Build for Production](#step-17-how-to-build-for-production)
18. [Alternative: Run Backend Locally with Supabase CLI](#step-18-alternative-run-backend-locally-with-supabase-cli)
19. [Quick Reference Card](#step-19-quick-reference-card)

---

## Step 1: Prerequisites - What You Need Installed

Before you start, install these tools on your computer. Open your terminal (Command Prompt on Windows, Terminal on Mac/Linux) and verify each one.

### 1.1 Node.js (v18 or higher)

Download from: https://nodejs.org/en/download (choose LTS version)

Verify installation:
```bash
node --version
# Should show: v18.x.x or v20.x.x or v22.x.x
```

### 1.2 pnpm (Package Manager)

MOON uses pnpm, not npm. Install it:
```bash
npm install -g pnpm
```

Verify:
```bash
pnpm --version
# Should show: 8.x.x or 9.x.x
```

### 1.3 Git

Download from: https://git-scm.com/downloads

Verify:
```bash
git --version
# Should show: git version 2.x.x
```

### 1.4 VS Code

Download from: https://code.visualstudio.com/

### 1.5 Supabase CLI (for backend deployment)

```bash
# On Mac:
brew install supabase/tap/supabase

# On Windows (using scoop):
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# On Linux:
brew install supabase/tap/supabase

# Or via npm (any platform):
npm install -g supabase
```

Verify:
```bash
supabase --version
# Should show: 1.x.x or 2.x.x
```

### 1.6 Deno (for running/testing backend locally - optional)

Download from: https://deno.land/

```bash
# Mac/Linux:
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell):
irm https://deno.land/install.ps1 | iex
```

Verify:
```bash
deno --version
# Should show: deno 1.x.x or 2.x.x
```

---

## Step 2: Get the Source Code

### Option A: Clone from your Git repository

```bash
cd ~/Desktop
git clone <your-repository-url> moon-sand-v2
cd moon-sand-v2
```

### Option B: Copy from Figma Make export

If you exported the project from Figma Make:

1. Download or unzip the project folder
2. Move it to a convenient location:
```bash
# Example on Mac:
mv ~/Downloads/moon-sand-v2 ~/Desktop/moon-sand-v2
cd ~/Desktop/moon-sand-v2

# Example on Windows:
move C:\Users\YourName\Downloads\moon-sand-v2 C:\Users\YourName\Desktop\moon-sand-v2
cd C:\Users\YourName\Desktop\moon-sand-v2
```

### Option C: Start fresh

Create the directory and copy all files from the Figma Make environment into it.

---

## Step 3: Open the Project in VS Code

```bash
code ~/Desktop/moon-sand-v2
```

Or:
1. Open VS Code
2. File > Open Folder
3. Navigate to `moon-sand-v2` folder
4. Click "Open"

You should see this structure in the VS Code Explorer sidebar:

```
moon-sand-v2/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  postcss.config.mjs
  src/
    main.tsx
    app/
      App.tsx
      components/     (130+ component files)
      contexts/       (3 context files)
      hooks/
      i18n/
      services/       (35+ service files)
      types/
      utils/
    imports/
    services/         (15+ service files)
    styles/           (11 CSS files)
  supabase/
    functions/
      server/
        index.tsx     (main backend server)
        kv_store.tsx  (database layer)
        ... (35+ backend modules)
  utils/
    supabase/
      info.tsx        (project ID + anon key)
```

---

## Step 4: Understand the Project Structure

**There are 3 parts to this project:**

```
+---------------------------+
|   FRONTEND (React)        |  <-- Runs in your browser
|   /src/                   |  <-- `pnpm dev` starts this
+---------------------------+
            |
            | HTTPS API calls
            |
+---------------------------+
|   BACKEND (Hono + Deno)   |  <-- Runs as Supabase Edge Function
|   /supabase/functions/    |  <-- `supabase functions deploy` deploys this
|   /server/                |
+---------------------------+
            |
            | SQL queries
            |
+---------------------------+
|   DATABASE (PostgreSQL)   |  <-- Hosted by Supabase
|   kv_store_49c0e13c       |  <-- The key-value table
+---------------------------+
```

---

## Step 5: Set Up Supabase (Database + Auth + Backend)

### 5.1 Create a Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Project name:** `moon-sand-v2`
   - **Database password:** Choose a strong password (save it!)
   - **Region:** Choose closest to you (e.g., `Central EU (Frankfurt)` for Middle East)
5. Click **"Create new project"**
6. Wait 2-3 minutes for the project to be ready

### 5.2 Get Your Project Credentials

Once the project is ready, go to **Settings > API** in the Supabase dashboard.

You will need these 4 values:

| Value | Where to Find It | Example |
|---|---|---|
| **Project URL** | Settings > API > Project URL | `https://abcdefgh.supabase.co` |
| **Project ID** | The part between `https://` and `.supabase.co` | `abcdefgh` |
| **anon (public) key** | Settings > API > Project API keys > anon | `eyJhbGci...` (long string) |
| **service_role key** | Settings > API > Project API keys > service_role | `eyJhbGci...` (long string, keep SECRET) |

**IMPORTANT: The `service_role` key is a secret. Never put it in frontend code or commit it to Git.**

---

## Step 6: Create the Database Table

The backend needs one table called `kv_store_49c0e13c`.

### 6.1 Open the SQL Editor

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**

### 6.2 Run This SQL

Paste this SQL and click **"Run"**:

```sql
-- Create the key-value store table that MOON uses for all data
CREATE TABLE IF NOT EXISTS kv_store_49c0e13c (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);

-- Enable Row Level Security (but allow all access for the service role)
ALTER TABLE kv_store_49c0e13c ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows the service role to do everything
CREATE POLICY "Service role full access" ON kv_store_49c0e13c
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for prefix searches (used by getByPrefix)
CREATE INDEX IF NOT EXISTS idx_kv_store_key_prefix 
  ON kv_store_49c0e13c (key text_pattern_ops);
```

### 6.3 Verify

Click **"Table Editor"** in the left sidebar. You should see `kv_store_49c0e13c` in the list of tables.

---

## Step 7: Configure Environment Variables / Secrets

### 7.1 Set Supabase Edge Function Secrets

These are the environment variables that the backend server reads with `Deno.env.get()`.

Open your terminal and log in to Supabase CLI:

```bash
supabase login
```

This will open your browser. Log in and authorize the CLI.

Then link your project:

```bash
cd ~/Desktop/moon-sand-v2
supabase link --project-ref YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your actual project ID (e.g., `abcdefgh`).

Now set the secrets:

```bash
# Required secrets (the backend will not start without these)
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
supabase secrets set SUPABASE_ANON_KEY="your-anon-key-here"
supabase secrets set SUPABASE_DB_URL="postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_ID.supabase.co:5432/postgres"
```

Replace all placeholder values with your actual credentials from Step 5.2.

### 7.2 Set AI API Keys (Optional - AI features will be disabled without them)

```bash
# OpenAI (for GPT-4o-mini)
supabase secrets set OPENAI_API_KEY="sk-..."

# Google Gemini (for Gemini 1.5 Flash)
supabase secrets set GEMINI_API_KEY="AIza..."

# ISBNdb (for ISBN lookup)
supabase secrets set ISBNDB_API_KEY="your-isbndb-key"
```

To get these keys:
- **OpenAI:** https://platform.openai.com/api-keys
- **Google Gemini:** https://aistudio.google.com/app/apikey
- **ISBNdb:** https://isbndb.com/apidocs/v2

### 7.3 Verify Secrets

```bash
supabase secrets list
```

You should see all the secrets you just set (values will be hidden).

---

## Step 8: Update the Frontend Configuration

The frontend needs to know your Supabase project ID and anon key.

### 8.1 Edit `/utils/supabase/info.tsx`

Open this file in VS Code and update it with your values:

```typescript
/* AUTOGENERATED FILE - DO NOT EDIT CONTENTS */

export const projectId = "YOUR_PROJECT_ID"
export const publicAnonKey = "YOUR_ANON_PUBLIC_KEY"
```

Replace:
- `YOUR_PROJECT_ID` with your project ID (e.g., `abcdefgh`)
- `YOUR_ANON_PUBLIC_KEY` with your anon key from Step 5.2

**Example:**
```typescript
export const projectId = "abcdefgh"
export const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 8.2 How the Frontend Connects to the Backend

The frontend makes API calls to:
```
https://{projectId}.supabase.co/functions/v1/make-server-49c0e13c/{route}
```

This is configured in `/src/app/utils/recordStorageBackend.ts`:
```typescript
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-49c0e13c`;
```

You do NOT need to change this file -- it automatically uses the values from `info.tsx`.

---

## Step 9: Install Frontend Dependencies

Open the VS Code terminal (Ctrl+` or View > Terminal):

```bash
pnpm install
```

This will install all 80+ packages listed in `package.json`. It may take 2-5 minutes.

**What you should see:**
```
Packages: +280
+++++++++++++++++++++++++++++++++++++++
Progress: resolved 350, reused 0, downloaded 280, added 280, done

dependencies:
+ @emotion/react 11.14.0
+ @emotion/styled 11.14.1
+ @mui/icons-material 7.3.5
+ @mui/material 7.3.5
+ react 18.3.1
+ react-dom 18.3.1
+ tailwindcss 4.1.12
+ vite 6.3.5
... (many more)
```

### If you get errors:

**Error: `pnpm: command not found`**
```bash
npm install -g pnpm
```

**Error: `peer dependency issues`**
```bash
pnpm install --no-strict-peer-deps
```

**Error: `node version too old`**
Update Node.js to v18+ from https://nodejs.org

---

## Step 10: Run the Frontend (Dev Server)

```bash
pnpm dev
```

**What you should see:**
```
  VITE v6.3.5  ready in 1500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.x:5173/
  ➜  press h + enter to show help
```

### 10.1 Open in Browser

Open your browser and go to:
```
http://localhost:5173
```

### 10.2 What You Should See

1. **Login page** -- the MOON login screen with glassmorphism design
2. Use these demo credentials:
   - **Username:** `demo`
   - **Password:** `demo123`
3. After login, you should see the **Dashboard** with stats cards, recent records, and navigation buttons

### 10.3 If the Backend Is Not Deployed Yet

The frontend will still load and show the UI, but:
- Records will not save to the database (they will fall back to localStorage)
- AI features will not work
- Discovery search will still work (it calls external APIs directly from the frontend)
- LOC/VIAF/Wikidata search will still work (direct API calls)

---

## Step 11: Deploy the Backend (Supabase Edge Function)

The backend is a single Edge Function that contains all 166+ API routes.

### 11.1 Create the Function

First, check if the function directory structure is correct. Your project should have:

```
supabase/
  functions/
    server/
      index.tsx        <-- This is the main entry point
      kv_store.tsx
      aiEngine.tsx
      ... (35+ more files)
```

### 11.2 Deploy

```bash
supabase functions deploy server --no-verify-jwt
```

**What the flags mean:**
- `server` -- the function name (matches the folder name `supabase/functions/server/`)
- `--no-verify-jwt` -- allows unauthenticated access to the health check endpoint

**What you should see:**
```
Deploying function: server
Deployed function: server
Function URL: https://YOUR_PROJECT_ID.supabase.co/functions/v1/server
```

### 11.3 Verify Deployment

Test the health endpoint in your browser or terminal:

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-49c0e13c/health
```

**Expected response:**
```json
{"status":"ok"}
```

Test the engine status:

```bash
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-49c0e13c/engine/status
```

**Expected response:**
```json
{
  "status": "operational",
  "bootComplete": true,
  "engine": { ... },
  "ontology": { "initialized": true, "version": "3.0.1" }
}
```

### 11.4 Check the Logs

```bash
supabase functions logs server --tail
```

You should see the boot sequence:
```
============================================================
MOON ENGINE BOOT SEQUENCE STARTING
============================================================
[BOOT] Step 1: Loading BIBFRAME Ontology Schema...
[BOOT] Ontology loaded successfully
[BOOT] Step 2: Initializing Moon Engine...
[BOOT] Engine initialized successfully
[BOOT] Step 3: Loading example datasets...
[BOOT] Example data loaded successfully
============================================================
MOON ENGINE READY - All systems operational
Demo login: username=demo, password=demo123
============================================================
```

---

## Step 12: Set Up AI API Keys (Optional but Recommended)

### 12.1 OpenAI (GPT-4o-mini)

1. Go to https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-`)
4. Set it:
```bash
supabase secrets set OPENAI_API_KEY="sk-your-key-here"
```
5. Redeploy the function:
```bash
supabase functions deploy server --no-verify-jwt
```

### 12.2 Google Gemini (Gemini 1.5 Flash)

1. Go to https://aistudio.google.com/app/apikey
2. Click **"Create API key"**
3. Copy the key (starts with `AIza`)
4. Set it:
```bash
supabase secrets set GEMINI_API_KEY="AIza-your-key-here"
```
5. Redeploy.

### 12.3 ISBNdb (ISBN Lookup)

1. Go to https://isbndb.com and create an account
2. Get your API key from the dashboard
3. Set it:
```bash
supabase secrets set ISBNDB_API_KEY="your-isbndb-key"
```
4. Redeploy.

### 12.4 After Setting Keys

Always redeploy after changing secrets:
```bash
supabase functions deploy server --no-verify-jwt
```

---

## Step 13: Test That Everything Works

### 13.1 Health Check

Open: `http://localhost:5173`

Login with `demo` / `demo123`

### 13.2 Test Record Saving

1. From the Dashboard, click **"Moon BIBFRAME Template"** or any cataloging engine
2. Enter a title like: **"كتاب القانون في الطب"**
3. Click **Save**
4. If you see a green toast "Record saved to database permanently!" -- the backend is working

### 13.3 Test LOC Search

1. From the Dashboard, click **"Search LOC"** or **"BIBFRAME Search"**
2. Search for: **"Shakespeare"**
3. You should see results from the Library of Congress

### 13.4 Test AI (if keys are set)

1. Open **"Moon AI"** or **"Enterprise AI Engine"** from the Dashboard
2. Enter a title and click **"Auto-Fill"**
3. If AI keys are configured, you should see suggestions for subjects, authors, etc.

### 13.5 Test All Records Gallery

1. From the Dashboard, click **"All Records"**
2. You should see any records you saved in Step 13.2

### 13.6 Full System Diagnostic

1. From the Dashboard, click **"Moon Wave Diagnostic"**
2. This runs connectivity tests against all backend endpoints
3. Green checkmarks = working, Red X = something is wrong

---

## Step 14: Common Errors and How to Fix Them

### Error: "Failed to fetch" when saving records

**Cause:** Backend is not deployed or secrets are wrong.

**Fix:**
```bash
# Check if function is deployed
supabase functions list

# Check logs for errors
supabase functions logs server --tail

# Redeploy
supabase functions deploy server --no-verify-jwt
```

### Error: "TypeError: Failed to fetch dynamically imported module: BlueMoon.tsx"

**Cause:** Known issue with the BlueMoon component. This is a persistent error.

**Fix:** Do NOT touch `BlueMoon.tsx` unless explicitly needed. The rest of the application works fine. If you encounter this error when navigating to Blue Moon, simply go back to the Dashboard and use a different editor.

### Error: "CORS error" in browser console

**Cause:** The backend CORS is not configured or the function URL is wrong.

**Fix:** Verify `projectId` in `/utils/supabase/info.tsx` matches your actual Supabase project.

### Error: "relation kv_store_49c0e13c does not exist"

**Cause:** The database table was not created.

**Fix:** Go back to [Step 6](#step-6-create-the-database-table) and run the SQL.

### Error: "pnpm dev" shows many TypeScript errors but still runs

**Cause:** Some type definitions may be loose. Vite/React still compiles and runs despite TS warnings.

**Fix:** This is normal for a rapid prototyping project. The app runs despite the warnings.

### Error: "Module not found: @supabase/supabase-js"

**Cause:** This import is for the backend (Deno), not the frontend. The backend uses `jsr:@supabase/supabase-js@2` and `npm:` prefixes which are Deno-specific.

**Fix:** This is NOT a frontend error. The frontend uses `fetch()` directly, not the Supabase JS client. If you see this error in the frontend, something was incorrectly imported.

### Error: Dark mode text is unreadable in OntologyField

**Cause:** Known issue. Partially fixed for Label and Badge, but other text elements still need dark mode text color adjustments.

**Fix:** Add `dark:text-white` or `dark:text-gray-200` to the affected elements in `OntologyField.tsx`.

### Error: "Deno.exit is not a function" or "Deno is not defined"

**Cause:** You are trying to run the backend with Node.js instead of Deno.

**Fix:** The backend is designed for Deno (Supabase Edge Functions). See Step 18 for how to run it locally with the Supabase CLI.

---

## Step 15: VS Code Extensions You Should Install

Open VS Code and install these extensions (Ctrl+Shift+X):

| Extension | ID | Purpose |
|---|---|---|
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Autocomplete for Tailwind classes |
| **ESLint** | `dbaeumer.vscode-eslint` | JavaScript/TypeScript linting |
| **Prettier** | `esbenp.prettier-vscode` | Code formatting |
| **ES7+ React Snippets** | `dsznajder.es7-react-js-snippets` | React component shortcuts |
| **TypeScript Importer** | `pmneo.tsimporter` | Auto-import TypeScript modules |
| **i18n Ally** | `lokalise.i18n-ally` | i18n translation management |
| **Deno** | `denoland.vscode-deno` | For editing backend files (disable for /src/) |
| **Thunder Client** | `rangav.vscode-thunder-client` | API testing from VS Code |
| **GitLens** | `eamodio.gitlens` | Git history visualization |
| **Error Lens** | `usernamehw.errorlens` | Show errors inline |

### VS Code Settings for This Project

Create or update `.vscode/settings.json` in your project root:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*)[\"'`]"]
  ],
  "files.exclude": {
    "node_modules": true,
    "pnpm-lock.yaml": true
  },
  "deno.enable": false,
  "deno.enablePaths": ["./supabase/functions/server"]
}
```

---

## Step 16: How to Make Changes and Develop

### 16.1 Frontend Hot Reload

When `pnpm dev` is running:
- Edit any `.tsx` file in `/src/`
- Save the file (Ctrl+S)
- The browser automatically refreshes with your changes (Hot Module Replacement)

### 16.2 Key Files to Edit

| What You Want to Change | File to Edit |
|---|---|
| Dashboard layout | `/src/app/components/Dashboard.tsx` |
| Login page | `/src/app/components/LoginPage.tsx` |
| Top navigation bar | `/src/app/components/TopNavBar.tsx` |
| Add a new view/page | `/src/app/App.tsx` (add ViewMode + lazy import + route) |
| English translations | `/src/app/i18n/config.ts` (resources.en.translation) |
| Arabic translations | `/src/app/i18n/config.ts` (resources.ar.translation) |
| Theme colors/styles | `/src/styles/theme.css` |
| Glassmorphism effects | `/src/styles/glassmorphism.css` |
| Backend API routes | `/supabase/functions/server/index.tsx` |
| AI engine logic | `/supabase/functions/server/aiEngine.tsx` |
| Record storage | `/supabase/functions/server/recordService.tsx` |

### 16.3 Adding a New Component

1. Create the file: `/src/app/components/MyNewComponent.tsx`

```tsx
import React from 'react';

interface MyNewComponentProps {
  onBack: () => void;
}

export function MyNewComponent({ onBack }: MyNewComponentProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <button onClick={onBack} className="mb-4 text-blue-600">
        Back to Dashboard
      </button>
      <h1 className="text-2xl font-bold">My New Component</h1>
    </div>
  );
}

export default MyNewComponent;
```

2. Register it in `/src/app/App.tsx`:

```tsx
// Add to the lazy imports at the top (around line 84):
const MyNewComponent = React.lazy(() => import('./components/MyNewComponent'));

// Add to the ViewMode type (around line 85):
type ViewMode = '...' | 'my-new-component';

// Add the route (after the other if-blocks, around line 930):
if (viewMode === 'my-new-component') {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <MyNewComponent onBack={() => setViewMode('dashboard')} />
    </React.Suspense>
  );
}
```

3. Add a card in Dashboard to navigate to it.

### 16.4 Backend Changes

After editing any file in `/supabase/functions/server/`:
```bash
supabase functions deploy server --no-verify-jwt
```

Changes are NOT live until you redeploy.

---

## Step 17: How to Build for Production

### 17.1 Build the Frontend

```bash
pnpm build
```

This creates a `/dist/` folder with optimized static files:
```
dist/
  index.html
  assets/
    index-abc123.js      (minified React app)
    index-def456.css     (minified CSS)
    ...
```

### 17.2 Deploy the Frontend

The `/dist/` folder can be deployed to any static hosting:

**Vercel:**
```bash
npm install -g vercel
vercel --prod
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Cloudflare Pages:**
```bash
npm install -g wrangler
wrangler pages deploy dist
```

**GitHub Pages:**
- Push the `dist/` folder to the `gh-pages` branch

### 17.3 The Backend Is Already Deployed

The Supabase Edge Function is always running in the cloud once you deploy it with `supabase functions deploy`. You do not need to deploy it separately for production.

---

## Step 18: Alternative - Run Backend Locally with Supabase CLI

If you want to run the backend on your local machine (instead of the cloud):

### 18.1 Start Supabase Locally

```bash
supabase start
```

This starts a local PostgreSQL, Auth, and Edge Functions runtime using Docker.

**Requirements:** Docker must be installed and running.

### 18.2 Serve the Edge Function Locally

```bash
supabase functions serve server --no-verify-jwt --env-file .env.local
```

Create a `.env.local` file in your project root:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
OPENAI_API_KEY=sk-your-key
GEMINI_API_KEY=AIza-your-key
ISBNDB_API_KEY=your-isbndb-key
```

The local service_role and anon keys are printed when `supabase start` finishes.

### 18.3 Point the Frontend to Local Backend

Edit `/utils/supabase/info.tsx`:
```typescript
export const projectId = "localhost:54321"
export const publicAnonKey = "your-local-anon-key"
```

And update the API_BASE in `/src/app/utils/recordStorageBackend.ts`:
```typescript
const API_BASE = `http://localhost:54321/functions/v1/make-server-49c0e13c`;
```

### 18.4 Create the Local Database Table

```bash
supabase db reset
```

Or connect to the local database and run the SQL from Step 6.

---

## Step 19: Quick Reference Card

### Daily Development Workflow

```bash
# 1. Open project
cd ~/Desktop/moon-sand-v2
code .

# 2. Start frontend dev server
pnpm dev

# 3. Open browser
# http://localhost:5173

# 4. Login
# Username: demo
# Password: demo123

# 5. Edit files, save, browser auto-refreshes

# 6. If you changed backend files:
supabase functions deploy server --no-verify-jwt

# 7. Check backend logs:
supabase functions logs server --tail
```

### Key Commands

| Command | What It Does |
|---|---|
| `pnpm install` | Install all dependencies |
| `pnpm dev` | Start frontend dev server (http://localhost:5173) |
| `pnpm build` | Build for production (creates /dist/) |
| `supabase login` | Authenticate with Supabase |
| `supabase link --project-ref ID` | Link to your Supabase project |
| `supabase functions deploy server --no-verify-jwt` | Deploy the backend |
| `supabase functions logs server --tail` | Watch backend logs in real-time |
| `supabase secrets set KEY="VALUE"` | Set an environment variable |
| `supabase secrets list` | List all secrets |
| `supabase start` | Start local Supabase (needs Docker) |
| `supabase functions serve server` | Run backend locally |

### Key URLs

| URL | What It Is |
|---|---|
| `http://localhost:5173` | Your local frontend |
| `https://{projectId}.supabase.co` | Your Supabase project |
| `https://{projectId}.supabase.co/functions/v1/make-server-49c0e13c/health` | Backend health check |
| `https://supabase.com/dashboard` | Supabase dashboard |
| `https://platform.openai.com/api-keys` | OpenAI API keys |
| `https://aistudio.google.com/app/apikey` | Gemini API keys |

### Login Credentials

| Username | Password | Access Level |
|---|---|---|
| `demo` | `demo123` | Full access (auto-created by boot sequence) |

### Project Files Quick Map

| Need to change... | Edit this file |
|---|---|
| What the user sees first | `Dashboard.tsx` |
| How records are saved | `recordStorageBackend.ts` (frontend) + `recordService.tsx` (backend) |
| AI behavior | `aiEngine.tsx` + `aiRouter.tsx` + `aiProviders.tsx` |
| Which sources are searched | `discoveryProviders.tsx` |
| Arabic translations | `i18n/config.ts` |
| Visual theme | `styles/glassmorphism.css` + `styles/theme.css` |
| Backend API routes | `server/index.tsx` |
| Database access | `server/kv_store.tsx` (DO NOT EDIT - PROTECTED) |
| Supabase connection | `utils/supabase/info.tsx` |

---

**You are now ready to run MOON SAND V2 in VS Code.**

**Built in Karbala by Isaac Faleh.**

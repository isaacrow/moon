// Applies supabase/migrations/*.sql to the live database, oldest first, each one once.
// Runs in CI through the Supabase Management API with the same SUPABASE_ACCESS_TOKEN that deploys the
// edge function. Applied files are recorded in public.moon_schema_migrations; each file runs in a
// transaction together with that record, so a failing file leaves nothing half-applied.
//
//   node scripts/apply-migrations.mjs            apply pending migrations
//   node scripts/apply-migrations.mjs --dry-run  list what would run, change nothing

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const dryRun = process.argv.includes('--dry-run');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const project = process.env.SUPABASE_PROJECT_ID;

if (!token || !project) {
  console.log('::warning::SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_ID not set - migrations were not applied.');
  process.exit(0);
}

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database query failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

const quote = (s) => `'${s.replace(/'/g, "''")}'`;

await sql(`create table if not exists public.moon_schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.moon_schema_migrations enable row level security;`);

const applied = new Set((await sql('select name from public.moon_schema_migrations')).map((r) => r.name));
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log(`Database is up to date (${files.length} migrations applied).`);
  process.exit(0);
}

for (const file of pending) {
  if (dryRun) {
    console.log(`Would apply ${file}`);
    continue;
  }
  const body = await readFile(path.join(dir, file), 'utf8');
  await sql(`begin;\n${body}\ninsert into public.moon_schema_migrations (name) values (${quote(file)});\ncommit;`);
  console.log(`Applied ${file}`);
}

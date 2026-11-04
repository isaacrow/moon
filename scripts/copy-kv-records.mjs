// Copies BIBFRAME records from the key-value table (kv_store_49c0e13c, keys bibframe:record:<id>) into
// public.records, each with a version 1 in public.record_versions. The key-value rows are never changed.
//
//   node scripts/copy-kv-records.mjs --dry-run  back up, then run the copy and roll it back: nothing is kept
//   node scripts/copy-kv-records.mjs --apply    back up, then copy for real (records already copied are skipped)
//
// Both modes first write every key-value record row, untouched, to backups/kv-records-<time>.json, and
// write a summary of what was (or would be) copied and skipped to backups/copy-report-<time>.md.

import { mkdir, writeFile } from 'node:fs/promises';
import { sql, quote, token, project } from './supabase-sql.mjs';

const PREFIX = 'bibframe:record:';
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,120}$/;
// Keep each request well under the API's body limit.
const BATCH_BYTES = 2_000_000;
const DRY_RUN_MARK = 'MOON_DRY_RUN';

const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--dry-run') ? 'dry-run' : null;
if (!mode) {
  console.error('Usage: node scripts/copy-kv-records.mjs --dry-run | --apply');
  process.exit(2);
}
if (!token || !project) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID are required.');
  process.exit(1);
}

/** Same rule as the app: anything that is not waiting or returned counts as published. */
function normalizeStatus(value) {
  return value === 'pending-review' || value === 'needs-review' ? value : 'complete';
}

function isoOrNull(value) {
  if (!value) return null;
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/** Turns one key-value row into a records row, or explains why it cannot be copied. */
export function toRecordRow(key, value) {
  let rec = value;
  if (typeof rec === 'string') {
    try { rec = JSON.parse(rec); } catch { return { skip: 'value is not valid JSON' }; }
  }
  if (!rec || typeof rec !== 'object') return { skip: 'value is not a record object' };
  // The key is what the server reads by, so it decides the id.
  const id = key.slice(PREFIX.length);
  if (!ID_PATTERN.test(id)) return { skip: `id "${id}" has characters the server does not allow` };
  const document = rec.document;
  if (!document || !Array.isArray(document['@graph'])) return { skip: 'document has no @graph array' };
  const created = isoOrNull(rec.createdAt) || isoOrNull(rec.saved);
  return {
    row: {
      id,
      title: typeof rec.title === 'string' && rec.title.trim() ? rec.title : 'Untitled',
      status: normalizeStatus(rec.status || rec.metadata?.status),
      cataloger: rec.cataloger || rec.metadata?.catalogerId || null,
      document,
      metadata: rec.metadata && typeof rec.metadata === 'object' ? rec.metadata : {},
      created_at: created,
      updated_at: isoOrNull(rec.saved) || created,
      approved_by: rec.approvedBy || null,
      approved_at: isoOrNull(rec.approvedAt),
      reviewed_by: rec.reviewedBy || null,
      reviewed_at: isoOrNull(rec.reviewedAt),
    },
    idMismatch: rec.id && rec.id !== id ? rec.id : null,
  };
}

/** SQL that inserts one batch of rows and their version 1, skipping records that are already there. */
export function copySql(rows) {
  const json = JSON.stringify(rows);
  if (json.includes('$moon$')) throw new Error('A record contains the text $moon$, which this script uses as a quote');
  const ids = rows.map((r) => quote(r.id)).join(', ');
  return {
    records: `insert into public.records
  (id, title, status, cataloger, document, metadata, current_version, created_at, updated_at,
   approved_by, approved_at, reviewed_by, reviewed_at)
select id, title, status, cataloger, document, metadata, 1, coalesce(created_at, now()),
  coalesce(updated_at, created_at, now()), approved_by, approved_at, reviewed_by, reviewed_at
from jsonb_to_recordset($moon$${json}$moon$::jsonb) as x(
  id text, title text, status text, cataloger text, document jsonb, metadata jsonb,
  created_at timestamptz, updated_at timestamptz, approved_by text, approved_at timestamptz,
  reviewed_by text, reviewed_at timestamptz)
on conflict (id) do nothing`,
    versions: `insert into public.record_versions (record_id, version, title, status, document, metadata, saved_by, saved_at, note)
select id, 1, title, status, document, metadata, cataloger, updated_at, 'migrated from kv_store'
from public.records where id in (${ids})
on conflict (record_id, version) do nothing`,
  };
}

function batches(rows) {
  const out = [];
  let current = [];
  let size = 0;
  for (const row of rows) {
    const bytes = JSON.stringify(row).length;
    if (current.length && size + bytes > BATCH_BYTES) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += bytes;
  }
  if (current.length) out.push(current);
  return out;
}

/** Runs one batch inside a block that always fails at the end, so Postgres rolls everything back. */
async function dryRunBatch(batch) {
  const { records, versions } = copySql(batch);
  const block = `do $do$
declare nr integer; nv integer;
begin
  ${records};
  get diagnostics nr = row_count;
  ${versions};
  get diagnostics nv = row_count;
  raise exception '${DRY_RUN_MARK} records=% versions=%', nr, nv;
end
$do$`;
  try {
    await sql(block);
  } catch (e) {
    const m = String(e.message).match(new RegExp(`${DRY_RUN_MARK} records=(\\d+) versions=(\\d+)`));
    if (m) return { records: Number(m[1]), versions: Number(m[2]) };
    throw e;
  }
  throw new Error('The dry run did not roll back as expected; stopping.');
}

async function applyBatch(batch) {
  const { records, versions } = copySql(batch);
  const before = await counts(batch);
  await sql(`begin;\n${records};\n${versions};\ncommit;`);
  const after = await counts(batch);
  return { records: after.records - before.records, versions: after.versions - before.versions };
}

async function counts(batch) {
  const ids = batch.map((r) => quote(r.id)).join(', ');
  const [row] = await sql(`select
  (select count(*) from public.records where id in (${ids}))::int as records,
  (select count(*) from public.record_versions where record_id in (${ids}))::int as versions`);
  return row;
}

// ─── Run ─────────────────────────────────────────────────────

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await mkdir('backups', { recursive: true });

const kvRows = await sql(`select key, value from public.kv_store_49c0e13c where key like '${PREFIX}%' order by key`);
const backupFile = `backups/kv-records-${stamp}.json`;
await writeFile(backupFile, JSON.stringify(kvRows, null, 1));
console.log(`Backed up ${kvRows.length} key-value records to ${backupFile}`);

const rows = [];
const skipped = [];
const mismatched = [];
for (const { key, value } of kvRows) {
  const r = toRecordRow(key, value);
  if (r.skip) skipped.push({ key, reason: r.skip });
  else {
    rows.push(r.row);
    if (r.idMismatch) mismatched.push({ key, storedId: r.idMismatch });
  }
}

const [existing] = await sql('select (select count(*) from public.records)::int as records, (select count(*) from public.record_versions)::int as versions');
let copied = { records: 0, versions: 0 };
for (const batch of batches(rows)) {
  const n = mode === 'apply' ? await applyBatch(batch) : await dryRunBatch(batch);
  copied = { records: copied.records + n.records, versions: copied.versions + n.versions };
}

const byStatus = {};
for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
const verb = mode === 'apply' ? 'Copied' : 'Would copy';
const report = [
  `# ${mode === 'apply' ? 'Record copy' : 'Record copy dry run'} — ${new Date().toISOString()}`,
  '',
  `- Key-value records found: **${kvRows.length}** (backup: \`${backupFile}\`)`,
  `- Already in the records table before this run: ${existing.records} records, ${existing.versions} versions`,
  `- ${verb}: **${copied.records} records** and **${copied.versions} versions**`,
  `- Ready to copy by status: ${Object.entries(byStatus).map(([s, n]) => `${s} ${n}`).join(', ') || 'none'}`,
  `- Skipped: **${skipped.length}**`,
  ...skipped.map((s) => `  - \`${s.key}\`: ${s.reason}`),
  ...(mismatched.length
    ? ['- Copied under the id in their key, though the record inside names another id:',
       ...mismatched.map((m) => `  - \`${m.key}\` (record says \`${m.storedId}\`)`)]
    : []),
  mode === 'dry-run' ? '\nNothing was kept: the copy ran inside a transaction that was rolled back.' : '',
].join('\n');
const reportFile = `backups/copy-report-${stamp}.md`;
await writeFile(reportFile, report + '\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, report + '\n', { flag: 'a' });

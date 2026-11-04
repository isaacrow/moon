// Gives published records that still carry placeholder ids (example.org, moon.local…) permanent
// https://mooon.site/resource/... URIs (see scripts/remint.mjs), saved as a new published version, so
// their record addresses resolve. Records with an edit waiting for review are skipped and listed:
// approve or return the edit first.
//
//   node scripts/remint-uris.mjs --dry-run  back up, then re-mint and roll back: nothing is kept
//   node scripts/remint-uris.mjs --apply    back up, then re-mint for real, then check every new Work URI resolves
//
// Writes backups/remint-records-<time>.json (every record as it was) and backups/remint-report-<time>.md.

import { mkdir, writeFile } from 'node:fs/promises';
import { sql, quote, token, project } from './supabase-sql.mjs';
import { plan, apply, uriSet, BASE_URI } from './remint.mjs';

const MARK = 'MOON_DRY_RUN';
const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--dry-run') ? 'dry-run' : null;
if (!mode) {
  console.error('Usage: node scripts/remint-uris.mjs --dry-run | --apply');
  process.exit(2);
}
if (!token || !project) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID are required.');
  process.exit(1);
}

const dollar = (s) => {
  if (s.includes('$moon$')) throw new Error('A record contains the text $moon$, which this script uses as a quote');
  return `$moon$${s}$moon$`;
};

/** One record's save (new version, still published) and its key-value mirror, as SQL statements. */
function statements(r, document, metadata) {
  const save = `public.moon_save_record(${quote(r.id)}, ${quote(r.title)}, 'complete', ${r.cataloger == null ? 'null' : quote(r.cataloger)},
    ${dollar(JSON.stringify(document))}::jsonb, ${dollar(JSON.stringify(metadata))}::jsonb,
    'uri re-mint', now(), 'uri re-mint', ${r.approved_by == null ? 'null' : quote(r.approved_by)}, ${r.approved_at == null ? 'null' : quote(r.approved_at)}::timestamptz,
    ${Number(r.current_version)})`;
  // The key-value row holds the record as a JSON string; keep its copy in step for the parts that still read it.
  const kv = `update public.kv_store_49c0e13c
    set value = to_jsonb(jsonb_set(jsonb_set((value #>> '{}')::jsonb, '{document}', ${dollar(JSON.stringify(document))}::jsonb),
                         '{metadata}', ${dollar(JSON.stringify(metadata))}::jsonb)::text)
    where key = ${quote('bibframe:record:' + r.id)} and jsonb_typeof(value) = 'string'`;
  return { save, kv };
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await mkdir('backups', { recursive: true });

const rows = await sql(`select id, title, status, cataloger, document, metadata, current_version, published_version,
  approved_by, approved_at from public.records where deleted_at is null order by id`);
const backupFile = `backups/remint-records-${stamp}.json`;
await writeFile(backupFile, JSON.stringify(rows, null, 1));
console.log(`Backed up ${rows.length} records to ${backupFile}`);

const todo = [];
const skipped = [];
let alreadyDone = 0;
for (const r of rows) {
  const mapping = plan(r.id, r.document);
  if (mapping.size === 0) { alreadyDone++; continue; }
  if (r.status !== 'complete' || r.published_version !== r.current_version) {
    skipped.push({ id: r.id, title: r.title, reason: r.published_version ? 'has an edit waiting for review: approve or return it first' : 'not published yet' });
    continue;
  }
  const document = apply(r.document, mapping);
  const metadata = { ...(r.metadata || {}), recordId: r.id, uriSet: uriSet(r.id) };
  const work = [...mapping.values()].find((v) => v.startsWith(`${BASE_URI}/work/`));
  todo.push({ r, document, metadata, work, changed: mapping.size });
}

let done = 0;
const resolved = [];
if (mode === 'dry-run' && todo.length) {
  const block = `do $do$
declare n integer := 0;
begin
${todo.map(({ r, document, metadata }) => { const s = statements(r, document, metadata); return `  perform ${s.save};\n  ${s.kv};\n  n := n + 1;`; }).join('\n')}
  raise exception '${MARK} n=%', n;
end
$do$`;
  try {
    await sql(block);
    throw new Error('The dry run did not roll back as expected; stopping.');
  } catch (e) {
    const m = String(e.message).match(new RegExp(`${MARK} n=(\\d+)`));
    if (!m) throw e;
    done = Number(m[1]);
  }
} else if (mode === 'apply') {
  for (const { r, document, metadata, work } of todo) {
    const s = statements(r, document, metadata);
    await sql(`begin;\nselect ${s.save};\n${s.kv};\ncommit;`);
    done++;
    if (work) {
      const [hit] = await sql(`select public.moon_find_published_by_uri(${quote(work)}) ->> 'id' as id`);
      resolved.push({ id: r.id, work, ok: hit?.id === r.id });
    }
  }
}

const report = [
  `# ${mode === 'apply' ? 'URI re-mint' : 'URI re-mint dry run'} — ${new Date().toISOString()}`,
  '',
  `- Records: **${rows.length}** (backup: \`${backupFile}\`)`,
  `- Nothing to change (already under ${BASE_URI}, or no placeholder ids): ${alreadyDone}`,
  `- ${mode === 'apply' ? 'Re-minted' : 'Would re-mint'}: **${done}** (each saved as a new published version, note "uri re-mint")`,
  ...todo.map(({ r, work, changed }) => `  - \`${r.id}\` ${r.title ? `"${r.title}"` : ''} → ${work || '(no Work node)'} (${changed} ids)`),
  `- Skipped: **${skipped.length}**`,
  ...skipped.map((s) => `  - \`${s.id}\` "${s.title}": ${s.reason}`),
  ...(mode === 'apply' ? [`- New Work URIs that resolve: **${resolved.filter((x) => x.ok).length} of ${resolved.length}**`,
    ...resolved.filter((x) => !x.ok).map((x) => `  - does not resolve: ${x.work}`)] : []),
  mode === 'dry-run' ? '\nNothing was kept: the changes ran inside a block that was rolled back.' : '',
].join('\n');
const reportFile = `backups/remint-report-${stamp}.md`;
await writeFile(reportFile, report + '\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, report + '\n', { flag: 'a' });

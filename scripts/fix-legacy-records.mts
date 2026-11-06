// Repairs published records saved by Moon's early editor (src/services/legacyRecordFix.ts): field names
// without bf:, links stored as text, links to moon.local placeholders, Instances not linked to their Work,
// and the stored title "Untitled". Each repaired record is saved as a new published version (note
// "data clean-up"), so the old version stays in its history.
//
//   npx tsx scripts/fix-legacy-records.mts --dry-run  back up, then repair and roll back: nothing is kept
//   npx tsx scripts/fix-legacy-records.mts --apply    back up, then repair for real
//
// Records with an edit waiting for review, or not published, are skipped and listed. Records with no
// title to recover are listed for a person to unpublish or delete; they are not changed.
// Writes backups/legacy-records-<time>.json (every record as it was) and backups/legacy-report-<time>.md.

import { mkdir, writeFile } from 'node:fs/promises';
import { sql, quote, token, project } from './supabase-sql.mjs';
import { fixLegacyDocument, titleOf } from '../src/services/legacyRecordFix.ts';

const MARK = 'MOON_DRY_RUN';
const NOTE = 'data clean-up';
const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--dry-run') ? 'dry-run' : null;
if (!mode) {
  console.error('Usage: npx tsx scripts/fix-legacy-records.mts --dry-run | --apply');
  process.exit(2);
}
if (!token || !project) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID are required.');
  process.exit(1);
}

const dollar = (s: string) => {
  if (s.includes('$moon$')) throw new Error('A record contains the text $moon$, which this script uses as a quote');
  return `$moon$${s}$moon$`;
};
const isUntitled = (t: unknown) => !t || /^\s*(untitled( record)?|بدون عنوان)\s*$/i.test(String(t));

/** One record's save (a new version, still published) and its key-value mirror, as SQL statements. */
function statements(r: any, title: string, document: any) {
  const save = `public.moon_save_record(${quote(r.id)}, ${quote(title)}, 'complete', ${r.cataloger == null ? 'null' : quote(r.cataloger)},
    ${dollar(JSON.stringify(document))}::jsonb, ${dollar(JSON.stringify(r.metadata || {}))}::jsonb,
    ${quote(NOTE)}, now(), ${quote(NOTE)}, ${r.approved_by == null ? 'null' : quote(r.approved_by)}, ${r.approved_at == null ? 'null' : quote(r.approved_at)}::timestamptz,
    ${Number(r.current_version)})`;
  const kv = `update public.kv_store_49c0e13c
    set value = to_jsonb(jsonb_set(jsonb_set((value #>> '{}')::jsonb, '{document}', ${dollar(JSON.stringify(document))}::jsonb),
                         '{title}', to_jsonb(${quote(title)}::text))::text)
    where key = ${quote('bibframe:record:' + r.id)} and jsonb_typeof(value) = 'string'`;
  return { save, kv };
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await mkdir('backups', { recursive: true });

const rows: any[] = await sql(`select id, title, status, cataloger, document, metadata, current_version, published_version,
  approved_by, approved_at from public.records where deleted_at is null order by id`);
const backupFile = `backups/legacy-records-${stamp}.json`;
await writeFile(backupFile, JSON.stringify(rows, null, 1));
console.log(`Backed up ${rows.length} records to ${backupFile}`);

const todo: Array<{ r: any; title: string; document: any; summary: string }> = [];
const skipped: Array<{ id: string; title: string; reason: string }> = [];
const empty: Array<{ id: string; title: string }> = [];
let fine = 0;
for (const r of rows) {
  const { document, report, changed } = fixLegacyDocument(r.document);
  const recovered = titleOf(document);
  const title = isUntitled(r.title) && recovered ? recovered : r.title;
  if (!changed && title === r.title) { fine++; continue; }
  if (!recovered) { empty.push({ id: r.id, title: r.title }); continue; }
  if (r.status !== 'complete' || r.published_version !== r.current_version) {
    skipped.push({ id: r.id, title: r.title, reason: r.published_version ? 'has an edit waiting for review: approve or return it first' : 'not published' });
    continue;
  }
  const parts = [
    report.renamed && `${report.renamed} field names`,
    report.linksMade && `${report.linksMade} links`,
    report.placeholdersRelinked && `${report.placeholdersRelinked} placeholder links reconnected`,
    report.placeholdersRemoved && `${report.placeholdersRemoved} dead placeholder links removed`,
    report.droppedDuplicates && `${report.droppedDuplicates} unread old copies dropped`,
    report.instanceLinked && 'Instance linked to its Work',
    title !== r.title && `title "${r.title}" → "${title}"`,
  ].filter(Boolean).join(', ');
  todo.push({ r, title, document, summary: parts });
}

let done = 0;
if (mode === 'dry-run' && todo.length) {
  const block = `do $do$
declare n integer := 0;
begin
${todo.map(({ r, title, document }) => { const s = statements(r, title, document); return `  perform ${s.save};\n  ${s.kv};\n  n := n + 1;`; }).join('\n')}
  raise exception '${MARK} n=%', n;
end
$do$`;
  try {
    await sql(block);
    throw new Error('The dry run did not roll back as expected; stopping.');
  } catch (e: any) {
    const m = String(e.message).match(new RegExp(`${MARK} n=(\\d+)`));
    if (!m) throw e;
    done = Number(m[1]);
  }
} else if (mode === 'apply') {
  for (const { r, title, document } of todo) {
    const s = statements(r, title, document);
    await sql(`begin;\nselect ${s.save};\n${s.kv};\ncommit;`);
    done++;
  }
}

const report = [
  `# ${mode === 'apply' ? 'Old-record clean-up' : 'Old-record clean-up — dry run'} — ${new Date().toISOString()}`,
  '',
  `- Records: **${rows.length}** (backup: \`${backupFile}\`)`,
  `- Already fine: ${fine}`,
  `- ${mode === 'apply' ? 'Repaired' : 'Would repair'}: **${done}** (each saved as a new published version, note "${NOTE}")`,
  ...todo.map(({ r, title, summary }) => `  - \`${r.id}\` "${title}": ${summary}`),
  `- Nothing to recover (no title anywhere; not changed — unpublish or delete them by hand): **${empty.length}**`,
  ...empty.map((x) => `  - \`${x.id}\` "${x.title}"`),
  `- Skipped: **${skipped.length}**`,
  ...skipped.map((s) => `  - \`${s.id}\` "${s.title}": ${s.reason}`),
  mode === 'dry-run' ? '\nNothing was kept: the changes ran inside a block that was rolled back.' : '',
].join('\n');
const reportFile = `backups/legacy-report-${stamp}.md`;
await writeFile(reportFile, report + '\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, report + '\n', { flag: 'a' });

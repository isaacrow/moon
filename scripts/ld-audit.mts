// The nightly linked-data audit (Phase 12): audits an N-Triples dump, writes the scorecard (Markdown) to stdout
// and to the GitHub job summary, and fails when a number is worse than scripts/ld-audit-baseline.json.
//   npx tsx scripts/ld-audit.mts <dump.nt>            audit and compare
//   npx tsx scripts/ld-audit.mts <dump.nt> --update   audit and save as the new baseline (after a fix lands)
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { auditNTriples, regressions, score } from '../supabase/functions/server/ldAudit.tsx';
import * as T from '../supabase/functions/server/bibframeTerms.generated.tsx';

const file = process.argv[2];
if (!file) { console.error('usage: ld-audit.mts <dump.nt> [--update]'); process.exit(2); }
const baselinePath = new URL('./ld-audit-baseline.json', import.meta.url);
const report = auditNTriples(readFileSync(file, 'utf8'), {
  bfClasses: T.BF_CLASSES, bfObject: T.BF_OBJECT_PROPERTIES, bfData: T.BF_DATATYPE_PROPERTIES,
  bflcClasses: T.BFLC_CLASSES, bflcObject: T.BFLC_OBJECT_PROPERTIES, bflcData: T.BFLC_DATATYPE_PROPERTIES,
});

const lines = [
  `## Linked-data audit — ${report.counts.works} works, ${report.counts.instances} instances, ${report.counts.triples} triples`,
  '',
  '| Measure | Result | Met |',
  '| --- | --- | --- |',
  ...report.measures.map((m) => `| ${m.en} | ${m.target === 'none' ? m.value : `${m.value}/${m.total}`} | ${score(m) >= 0.999 ? '✅' : '—'} |`),
];
if (Object.keys(report.unknownTerms).length) lines.push('', `Terms outside BIBFRAME 3.0.1: ${Object.entries(report.unknownTerms).map(([k, n]) => `${k} ×${n}`).join(', ')}`);

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, JSON.stringify(Object.fromEntries(report.measures.map((m) => [m.key, { value: m.value, total: m.total }])), null, 2) + '\n');
  lines.push('', 'Baseline updated.');
}
let worse: string[] = [];
try { worse = regressions(report, JSON.parse(readFileSync(baselinePath, 'utf8'))); } catch { /* no baseline yet */ }
if (worse.length) lines.push('', '### Worse than the baseline', ...worse.map((w) => `- ${w}`));

const md = lines.join('\n');
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
if (worse.length) process.exit(1);

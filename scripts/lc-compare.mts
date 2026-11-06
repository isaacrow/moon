/**
 * Compares Moon with LC's two converters, record by record (Phase 9: "check against LC in CI"):
 *
 *   1. Moon's own MARC export  vs  the MARC LC's bibframe2marc makes from Moon's BIBFRAME:
 *      the fields each side writes, and the key values (title, main entry, ISBN, publication, language).
 *   2. LC's marc2bibframe2 run on Moon's MARC export: does LC's converter get a Work, an Instance and the
 *      same title back from it?
 *
 *   npx tsx scripts/lc-compare.mts <moon-marc-dir> <lc-marc-dir> <lc-bf-dir>
 *
 * Writes a Markdown report to stdout (and to $GITHUB_STEP_SUMMARY when set). It reports; it does not fail.
 */
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { RdfXmlParser } from 'rdfxml-streaming-parser';
import { parseMarcXml, type MarcRecord } from '../src/services/marc/marcRecord.ts';

const [moonDir, lcDir, lcBfDir] = process.argv.slice(2);
const BF = 'http://id.loc.gov/ontologies/bibframe/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const norm = (s: string) => s.normalize('NFC').replace(/[\s.,:;\/=\[\]]+/g, ' ').trim().toLowerCase();
const sub = (r: MarcRecord | undefined, tag: string, code: string): string => {
  const f: any = r?.fields.find((x: any) => x.tag === tag && x.subfields);
  return f ? (f.subfields.find(([c]: [string, string]) => c === code)?.[1] || '') : '';
};
const control = (r: MarcRecord | undefined, tag: string) => (r?.fields.find((x: any) => x.tag === tag && 'data' in x) as any)?.data || '';
/** The tags a record has, without the ones that only say who made the file and when. */
const tags = (r: MarcRecord | undefined) => new Set((r?.fields || []).map((f) => f.tag).filter((t) => !['001', '003', '005', '884'].includes(t)));
const read = (p: string): MarcRecord | undefined => (existsSync(p) ? parseMarcXml(readFileSync(p, 'utf8'))[0] : undefined);

async function quads(p: string): Promise<any[]> {
  if (!existsSync(p)) return [];
  const parser = new RdfXmlParser();
  const out: any[] = [];
  await new Promise<void>((resolve) => {
    parser.on('data', (q) => out.push(q)).on('error', () => resolve()).on('end', () => resolve());
    parser.write(readFileSync(p, 'utf8'));
    parser.end();
  });
  return out;
}

const KEYS: Array<[string, (r?: MarcRecord) => string]> = [
  ['title 245$a', (r) => sub(r, '245', 'a')],
  ['main entry 1XX$a', (r) => sub(r, '100', 'a') || sub(r, '110', 'a') || sub(r, '111', 'a')],
  ['ISBN 020$a', (r) => sub(r, '020', 'a').replace(/[^0-9Xx]/g, '')],
  ['date 264/260$c', (r) => (sub(r, '264', 'c') || sub(r, '260', 'c')).replace(/[^0-9]/g, '').slice(0, 4)],
  ['language 008', (r) => control(r, '008').slice(35, 38).trim()],
];

const ids = readdirSync(moonDir).filter((f) => f.endsWith('.xml')).map((f) => f.slice(0, -4)).sort();
const rows: string[] = [];
const tagGaps = new Map<string, number>();
const keyAgree = new Map<string, { same: number; diff: number; missingMoon: number; missingLc: number }>(KEYS.map(([k]) => [k, { same: 0, diff: 0, missingMoon: 0, missingLc: 0 }]));
let lcRead = 0, lcWorkInstance = 0, lcSameTitle = 0, compared = 0;

for (const id of ids) {
  const moon = read(join(moonDir, `${id}.xml`));
  const lc = read(join(lcDir, `${id}.xml`));
  const notes: string[] = [];
  if (lc) {
    compared++;
    const mt = tags(moon), lt = tags(lc);
    for (const t of lt) if (!mt.has(t)) tagGaps.set(`LC only ${t}`, (tagGaps.get(`LC only ${t}`) || 0) + 1);
    for (const t of mt) if (!lt.has(t)) tagGaps.set(`Moon only ${t}`, (tagGaps.get(`Moon only ${t}`) || 0) + 1);
    for (const [k, get] of KEYS) {
      const a = norm(get(moon)), b = norm(get(lc));
      const s = keyAgree.get(k)!;
      if (!a && !b) continue;
      if (!a) { s.missingMoon++; notes.push(`${k}: Moon has none, LC "${get(lc)}"`); }
      else if (!b) { s.missingLc++; notes.push(`${k}: LC has none, Moon "${get(moon)}"`); }
      else if (a === b || a.startsWith(b) || b.startsWith(a)) s.same++;
      else { s.diff++; notes.push(`${k}: Moon "${get(moon)}" ≠ LC "${get(lc)}"`); }
    }
  }
  // LC's marc2bibframe2 on Moon's MARC.
  const q = await quads(join(lcBfDir, `${id}.rdf`));
  if (q.length) {
    lcRead++;
    const typed = (cls: string) => q.some((x) => x.predicate.value === RDF_TYPE && x.object.value === BF + cls);
    if (typed('Work') && typed('Instance')) lcWorkInstance++;
    const titles = q.filter((x) => x.predicate.value === `${BF}mainTitle`).map((x) => norm(x.object.value));
    const want = norm(sub(moon, '245', 'a'));
    if (want && titles.some((t) => t === want || t.startsWith(want) || want.startsWith(t))) lcSameTitle++;
    else if (want) notes.push(`marc2bibframe2: title "${sub(moon, '245', 'a')}" not found back`);
  } else if (moon) notes.push('marc2bibframe2 could not read Moon\'s MARC');
  if (notes.length) rows.push(`| \`${id}\` | ${notes.map((n) => n.replace(/\|/g, '/')).join('<br>')} |`);
}

const pct = (n: number, d: number) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : '0/0');
const report = [
  '## Moon vs LC converters',
  '',
  `### 1. Moon's MARC export vs LC's bibframe2marc on Moon's BIBFRAME (${compared} records)`,
  '',
  '| Value | Same | Different | Moon has none | LC has none |',
  '| --- | --- | --- | --- | --- |',
  ...KEYS.map(([k]) => { const s = keyAgree.get(k)!; return `| ${k} | ${s.same} | ${s.diff} | ${s.missingMoon} | ${s.missingLc} |`; }),
  '',
  'Fields only one side writes (number of records):',
  '',
  ...[...tagGaps].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t, n]) => `- ${t}: ${n}`),
  '',
  `### 2. LC's marc2bibframe2 on Moon's MARC export`,
  '',
  `- Read: ${pct(lcRead, ids.length)}`,
  `- Work and Instance: ${pct(lcWorkInstance, ids.length)}`,
  `- Same title back: ${pct(lcSameTitle, ids.length)}`,
  '',
  '### Per record',
  '',
  '| Record | Differences |',
  '| --- | --- |',
  ...rows,
].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');

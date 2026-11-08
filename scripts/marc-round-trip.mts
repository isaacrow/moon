// MARC → Moon → MARC on a file of records, and what did not come back (Phase 13 S17).
//   npx tsx scripts/marc-round-trip.mts records.mrc|records.xml [--limit 2000] [--examples]
// Prints how many records came back whole and, for each tag or subfield, how many records lost or changed it.
import { readFileSync } from 'node:fs';
import { parseIso2709, parseMarcXml } from '../src/services/marc/marcRecord';
import { roundTrip, roundTripReport } from '../src/services/marc/marcRoundTrip';

const file = process.argv[2];
if (!file) { console.error('usage: marc-round-trip.mts <records.mrc|records.xml> [--limit N] [--examples]'); process.exit(2); }
const limitAt = process.argv.indexOf('--limit');
const limit = limitAt > 0 ? Number(process.argv[limitAt + 1]) || 2000 : 2000;
const bytes = readFileSync(file);
const all = /\.xml$/i.test(file) ? parseMarcXml(bytes.toString('utf8')) : parseIso2709(new Uint8Array(bytes));
const step = Math.max(1, Math.floor(all.length / limit));
const records = all.filter((_, i) => i % step === 0).slice(0, limit);

const r = roundTripReport(records);
console.log(`${r.records} of ${all.length} records checked; ${r.clean} came back whole (${Math.round((100 * r.clean) / Math.max(1, r.records))}%).`);
for (const [what, n] of r.counts.slice(0, 40)) console.log(String(n).padStart(6), what);
if (process.argv.includes('--examples')) {
  const shown = new Map<string, number>();
  for (const rec of records) for (const i of roundTrip(rec).issues) {
    const k = `${i.kind} ${i.tag}${i.code ? '$' + i.code : ''}`;
    if ((shown.get(k) || 0) >= 2) continue;
    shown.set(k, (shown.get(k) || 0) + 1);
    console.log(`  ${k}: ${JSON.stringify(i.before ?? '')} → ${JSON.stringify(i.after ?? '')}`);
  }
}

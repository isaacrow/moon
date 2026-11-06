/**
 * Writes Moon's published records as bounded RDF/XML (the shape LC's bibframe2marc reads), one file per
 * record, for the LC conformance check in .github/workflows/lc-conformance.yml. Uses this branch's writer
 * on the live published triples, so a change to the writer is tested before it is deployed.
 *
 *   npx tsx scripts/lc-rdfxml-samples.mts <out-dir> [max] [moon-marc-dir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Parser } from 'n3';
import { toBoundedRdfXml } from '../supabase/functions/server/rdfXml.tsx';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc.ts';
import { toMarcXml } from '../src/services/marc/marcRecord.ts';

const out = process.argv[2] || 'lc-check/rdf';
const max = Number(process.argv[3] || 50);
const PREFIXES = {
  bf: 'http://id.loc.gov/ontologies/bibframe/',
  bflc: 'http://id.loc.gov/ontologies/bflc/',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  madsrdf: 'http://www.loc.gov/mads/rdf/v1#',
};

mkdirSync(out, { recursive: true });
const marcOut = process.argv[4];
if (marcOut) mkdirSync(marcOut, { recursive: true });
const list = await (await fetch('https://mooon.site/resource/?format=json')).json();
let n = 0;
for (const r of (list.records || []).slice(0, max)) {
  const res = await fetch(`${r.work}.nt`);
  if (!res.ok) { console.log(`skip ${r.id}: ${res.status}`); continue; }
  const quads = new Parser({ format: 'N-Triples' }).parse(await res.text());
  writeFileSync(join(out, `${r.id}.rdf`), toBoundedRdfXml(quads as any, PREFIXES));
  // Moon's own MARC export of the same record, to compare with what LC's bibframe2marc makes of it.
  if (marcOut) {
    const doc = await (await fetch(`${r.work}.jsonld`)).json();
    writeFileSync(join(marcOut, `${r.id}.xml`), toMarcXml([bibframeToMarc(doc, { recordId: r.id })]));
  }
  n++;
}
console.log(`wrote ${n} records to ${out}`);

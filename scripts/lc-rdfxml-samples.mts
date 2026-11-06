/**
 * Writes Moon's published records as bounded RDF/XML (the shape LC's bibframe2marc reads), one file per
 * record, for the LC conformance check in .github/workflows/lc-conformance.yml. Uses this branch's writer
 * on the live published triples, so a change to the writer is tested before it is deployed.
 *
 *   npx tsx scripts/lc-rdfxml-samples.mts <out-dir> [max]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Parser } from 'n3';
import { toBoundedRdfXml } from '../supabase/functions/server/rdfXml.tsx';

const out = process.argv[2] || 'lc-check/rdf';
const max = Number(process.argv[3] || 50);
const PREFIXES = {
  bf: 'http://id.loc.gov/ontologies/bibframe/',
  bflc: 'http://id.loc.gov/ontologies/bflc/',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  madsrdf: 'http://www.loc.gov/mads/rdf/v1#',
};

mkdirSync(out, { recursive: true });
const list = await (await fetch('https://mooon.site/resource/?format=json')).json();
let n = 0;
for (const r of (list.records || []).slice(0, max)) {
  const res = await fetch(`${r.work}.nt`);
  if (!res.ok) { console.log(`skip ${r.id}: ${res.status}`); continue; }
  const quads = new Parser({ format: 'N-Triples' }).parse(await res.text());
  writeFileSync(join(out, `${r.id}.rdf`), toBoundedRdfXml(quads as any, PREFIXES));
  n++;
}
console.log(`wrote ${n} records to ${out}`);

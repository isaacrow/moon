/**
 * MARC 21 bibliographic record → BIBFRAME Work, Instance and Item as the editor holds them (the same
 * shapes the Category Cards store), so an imported record opens in Moon Studio and exports like any other.
 * The reverse of bibframeToMarc for the fields it writes, plus 260 (pre-RDA publication) and ISBD
 * punctuation as Koha and other systems export it.
 */
import type { DataField, MarcRecord } from './marcRecord';
import { isControl } from './marcRecord';

const VOCAB = 'http://id.loc.gov/vocabulary';
const data = (r: MarcRecord, tag: string) => r.fields.filter((f): f is DataField => f.tag === tag && !isControl(f));
const control = (r: MarcRecord, tag: string) => (r.fields.find((f) => f.tag === tag && isControl(f)) as any)?.data as string | undefined;
const subs = (f: DataField | undefined, code: string) => (f ? f.subfields.filter(([c]) => c === code).map(([, v]) => v) : []);
const sub = (f: DataField | undefined, code: string) => subs(f, code)[0] || '';
const link = (f: DataField) => subs(f, '0').find((v) => /^https?:\/\//.test(v)) || '';

/** Drops ISBD punctuation at the end of a value: " /", " :", " ;", ",", " =", and a closing period. */
export function clean(value: string): string {
  let v = value.trim().replace(/\s*[\/:;,=]+$/, '').trim();
  // A final period ends the field in ISBD; keep it after an initial or an abbreviation ("J.", "ed.", "p.").
  // (Unicode-aware: \b only knows ASCII letters, so "Qabasāt." would look like the initial "t.")
  if (/\.$/.test(v) && !/(?<![\p{L}\p{M}])(\p{L}|ed|p|cm|ca|vol|no)\.$/iu.test(v)) v = v.slice(0, -1);
  return v.trim();
}

const LEADER_CONTENT: Record<string, [string, string]> = { a: ['txt', 'text'], t: ['txt', 'text'], c: ['ntm', 'notated music'], d: ['ntm', 'notated music'], e: ['cri', 'cartographic image'], f: ['cri', 'cartographic image'], k: ['sti', 'still image'], i: ['spw', 'spoken word'], j: ['prm', 'performed music'], g: ['tdi', 'two-dimensional moving image'], m: ['cod', 'computer dataset'] };
const LEADER_ISSUANCE: Record<string, [string, string]> = { m: ['mono', 'single unit'], s: ['serl', 'serial'], i: ['intg', 'integrating resource'], a: ['mono', 'single unit'] };
const PROVISION_TYPE: Record<string, string> = { '0': 'bf:Production', '1': 'bf:Publication', '2': 'bf:Distribution', '3': 'bf:Manufacture' };
const NAME_TYPE: Record<string, string> = { '00': 'bf:Person', '10': 'bf:Organization', '11': 'bf:Meeting' };

const vocabNode = (path: string, label: string) => ({ '@id': `${VOCAB}/${path}`, 'rdfs:label': label });

export interface ImportedMarcRecord { work: any; instance: any; item: any; title: string }

export function marcToBibframe(r: MarcRecord): ImportedMarcRecord {
  // Parallel scripts: a field with $6 880-NN has its Arabic form in the 880 whose $6 is TAG-NN.
  const linked = (f: DataField | undefined): DataField | undefined => {
    const n = (sub(f, '6').match(/^880-(\d+)/) || [])[1];
    return n && f ? data(r, '880').find((x) => sub(x, '6').startsWith(`${f.tag}-${n}`)) : undefined;
  };
  const both = (main: string, alt: string | undefined): string | string[] => {
    const m = clean(main);
    const a = alt ? clean(alt) : '';
    return a && a !== m ? [m, a] : m;
  };
  const pair = (f: DataField | undefined, code: string) => both(sub(f, code), sub(linked(f), code));
  const work: any = { '@type': 'bf:Work' };
  const instance: any = { '@type': 'bf:Instance' };
  const item: any = { '@type': 'bf:Item' };
  const leader = r.leader.padEnd(24, ' ');
  const f008 = (control(r, '008') || '').padEnd(40, ' ');

  // ---- Title and statements (245, 250) ----
  const t = data(r, '245')[0];
  if (t) {
    const title: any = { '@type': 'bf:Title', 'bf:mainTitle': pair(t, 'a') };
    if (sub(t, 'b')) title['bf:subtitle'] = pair(t, 'b');
    if (sub(t, 'n')) title['bf:partNumber'] = pair(t, 'n');
    if (sub(t, 'p')) title['bf:partName'] = pair(t, 'p');
    if (/^[1-9]$/.test(t.ind2)) title['bflc:nonSortNum'] = t.ind2;
    work['bf:title'] = title;
    instance['bf:title'] = { ...title };
    if (sub(t, 'c')) instance['bf:responsibilityStatement'] = pair(t, 'c');
  }
  const f250 = data(r, '250')[0];
  if (sub(f250, 'a')) instance['bf:editionStatement'] = pair(f250, 'a');

  // ---- Names (1XX primary, 7XX others) ----
  const contributions: any[] = [];
  for (const f of r.fields) {
    if (isControl(f) || !/^[17](00|10|11)$/.test(f.tag)) continue;
    const nameOf = (x: DataField | undefined) => clean([sub(x, 'a'), sub(x, 'b'), sub(x, 'c'), sub(x, 'd')].filter(Boolean).join(' '));
    const name = nameOf(f);
    if (!name) continue;
    const agent: any = { '@type': NAME_TYPE[f.tag.slice(1)] || 'bf:Agent', 'rdfs:label': both(name, nameOf(linked(f))) };
    if (link(f)) agent['@id'] = link(f);
    const roles = [...subs(f, '4').filter((c) => /^[a-z]{3}$/.test(c)), ...(subs(f, '4').length ? [] : subs(f, 'e').map(clean))];
    contributions.push({
      '@type': f.tag.startsWith('1') ? ['bf:Contribution', 'bf:PrimaryContribution'] : 'bf:Contribution',
      'bf:agent': agent,
      ...(roles.length ? { 'bf:role': roles } : {}),
    });
  }
  if (contributions.length) work['bf:contribution'] = contributions;

  // ---- Language, content, media, carrier, issuance ----
  const lang = f008.slice(35, 38).trim();
  if (/^[a-z]{3}$/.test(lang) && !['und', 'zxx', 'mul'].includes(lang)) work['bf:language'] = { '@id': `${VOCAB}/languages/${lang}` };
  const rdaNode = (tag: string, vocab: string) => {
    const f = data(r, tag)[0];
    const code = sub(f, 'b');
    return f && code ? vocabNode(`${vocab}/${code}`, clean(sub(f, 'a')) || code) : null;
  };
  work['bf:content'] = rdaNode('336', 'contentTypes') || (LEADER_CONTENT[leader[6]] ? vocabNode(`contentTypes/${LEADER_CONTENT[leader[6]][0]}`, LEADER_CONTENT[leader[6]][1]) : undefined);
  instance['bf:media'] = rdaNode('337', 'mediaTypes') || undefined;
  instance['bf:carrier'] = rdaNode('338', 'carriers') || undefined;
  const issuance = LEADER_ISSUANCE[leader[7]];
  if (issuance) instance['bf:issuance'] = vocabNode(`issuance/${issuance[0]}`, issuance[1]);
  if (leader[6] === 't') instance['@type'] = ['bf:Instance', 'bf:Manuscript'];

  // ---- Numbers ----
  const identifiers: any[] = [];
  const number = (v: string) => v.replace(/\s*\(.*\)\s*$/, '').replace(/[^0-9Xx\-]/g, '').replace(/-/g, '');
  for (const f of data(r, '010')) if (sub(f, 'a')) identifiers.push({ '@type': 'bf:Lccn', 'rdf:value': sub(f, 'a').trim() });
  for (const f of data(r, '020')) if (number(sub(f, 'a'))) identifiers.push({ '@type': 'bf:Isbn', 'rdf:value': number(sub(f, 'a')) });
  for (const f of data(r, '022')) if (sub(f, 'a')) identifiers.push({ '@type': 'bf:Issn', 'rdf:value': sub(f, 'a').trim() });
  if (identifiers.length) instance['bf:identifiedBy'] = identifiers;

  // ---- Classification ----
  const classes: any[] = [];
  for (const f of data(r, '050')) if (sub(f, 'a')) classes.push({ '@type': 'bf:ClassificationLcc', 'bf:classificationPortion': sub(f, 'a'), ...(sub(f, 'b') ? { 'bf:itemPortion': sub(f, 'b') } : {}) });
  for (const f of data(r, '082')) if (sub(f, 'a')) classes.push({ '@type': 'bf:ClassificationDdc', 'bf:classificationPortion': sub(f, 'a').replace(/\//g, '') });
  if (classes.length) work['bf:classification'] = classes;

  // ---- Publication (264, or 260 in older records) ----
  const country = f008.slice(15, 18).trim();
  const provisions = [...data(r, '264'), ...data(r, '260')].map((f) => {
    const p: any = { '@type': f.tag === '260' ? 'bf:Publication' : PROVISION_TYPE[f.ind2] || 'bf:Publication' };
    const alt = linked(f);
    const places = subs(f, 'a').map((v, i) => both(v, subs(alt, 'a')[i])).filter((v) => (Array.isArray(v) ? v.length : v));
    if (places.length) p['bf:place'] = places.map((label, i) => (i === 0 && /^[a-z]{2,3}$/.test(country) && country !== 'xx'
      ? { '@id': `${VOCAB}/countries/${country}`, 'rdfs:label': label } : { 'rdfs:label': label }));
    const agents = subs(f, 'b').map((v, i) => both(v, subs(alt, 'b')[i])).filter((v) => (Array.isArray(v) ? v.length : v));
    if (agents.length) p['bf:agent'] = agents.map((label) => ({ 'rdfs:label': label }));
    if (sub(f, 'c')) p['bf:date'] = clean(sub(f, 'c'));
    return p;
  }).filter((p) => Object.keys(p).length > 1);
  if (provisions.length) instance['bf:provisionActivity'] = provisions;

  // ---- Description, series, notes ----
  const f300 = data(r, '300')[0];
  if (sub(f300, 'a')) instance['bf:extent'] = clean([sub(f300, 'a'), sub(f300, 'b')].filter(Boolean).join(' : '));
  if (sub(f300, 'c')) instance['bf:dimensions'] = clean(sub(f300, 'c'));
  const series = data(r, '490').flatMap((f) => {
    const s = (x: DataField | undefined) => [sub(x, 'a'), sub(x, 'v')].filter(Boolean).join(' ; ');
    const v = both(s(f), s(linked(f)));
    return Array.isArray(v) ? v : [v];
  }).filter(Boolean);
  if (series.length) instance['bf:seriesStatement'] = series.length === 1 ? series[0] : series;
  const notes = data(r, '500').map((f) => sub(f, 'a')).filter(Boolean);
  if (notes.length) work['bf:note'] = notes;
  const summaries = data(r, '520').map((f) => sub(f, 'a')).filter(Boolean);
  if (summaries.length) work['bf:summary'] = summaries;

  // ---- Subjects and genre ----
  const SUBJECT_TYPE: Record<string, string> = { '600': 'bf:Person', '610': 'bf:Organization', '611': 'bf:Meeting', '650': 'bf:Topic', '651': 'bf:Place' };
  const subjects = r.fields.filter((f): f is DataField => !isControl(f) && !!SUBJECT_TYPE[f.tag]).map((f) => {
    // A heading with subdivisions ($x $y $z $v) is one subject, as LC writes it: "Philosophy--History".
    const heading = f.subfields.filter(([c]) => /[abcdtxyzv]/.test(c)).map(([, v]) => clean(v)).filter(Boolean).join('--');
    const node: any = { '@type': SUBJECT_TYPE[f.tag], 'rdfs:label': heading };
    if (link(f)) node['@id'] = link(f);
    return heading ? node : null;
  }).filter(Boolean);
  if (subjects.length) work['bf:subject'] = subjects;
  const genres = data(r, '655').map((f) => {
    const node: any = { '@type': 'bf:GenreForm', 'rdfs:label': clean(sub(f, 'a')) };
    if (link(f)) node['@id'] = link(f);
    return node['rdfs:label'] ? node : null;
  }).filter(Boolean);
  if (genres.length) work['bf:genreForm'] = genres;

  const urls = data(r, '856').map((f) => sub(f, 'u')).filter(Boolean);
  if (urls.length) item['bf:electronicLocator'] = urls;

  for (const node of [work, instance]) for (const k of Object.keys(node)) if (node[k] === undefined) delete node[k];
  const title = work['bf:title']?.['bf:mainTitle'] || control(r, '001') || 'Untitled';
  return { work, instance, item, title };
}

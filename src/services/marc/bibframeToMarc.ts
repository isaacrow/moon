/**
 * BIBFRAME → MARC 21 bibliographic record, from the same validated graph every other export uses
 * (buildW3CJsonLd). It follows LC's BIBFRAME-to-MARC conventions for the fields Moon catalogues:
 * leader, 001/005/008, 010/020/022, 040, 050/082, 1XX/7XX, 245, 250, 264, 300, 336-338, 490, 5XX,
 * 6XX and 856. Authority links travel as $0 and relator codes as $4.
 */
import type { DataField, MarcField, MarcRecord, Subfield } from './marcRecord';

const BF = 'http://id.loc.gov/ontologies/bibframe/';
const all = (v: any): any[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const types = (n: any): string[] => all(n?.['@type']).map((t: any) => String(t).replace(BF, 'bf:'));
const isA = (n: any, t: string) => types(n).includes(t);
const get = (n: any, p: string) => n?.[`bf:${p}`] ?? n?.[p];

/** Every text in a value (literals, labels, main titles), in order. */
function texts(v: any): string[] {
  const out: string[] = [];
  for (const x of all(v)) {
    if (x === undefined || x === null) continue;
    if (typeof x === 'string' || typeof x === 'number') { if (String(x).trim()) out.push(String(x).trim()); continue; }
    if (x['@value'] !== undefined) { if (String(x['@value']).trim()) out.push(String(x['@value']).trim()); continue; }
    out.push(...texts(x['rdfs:label'] ?? x.label ?? x['rdf:value'] ?? x['bf:mainTitle']));
  }
  return out;
}
const text = (v: any) => texts(v)[0] || '';
const uri = (v: any): string => {
  const x = all(v)[0];
  const id = typeof x === 'string' ? x : x?.['@id'];
  return typeof id === 'string' && /^https?:\/\//.test(id) ? id : '';
};
const codeIn = (v: any, vocab: string) => (uri(v).match(new RegExp(`/vocabulary/${vocab}/([^/#]+)$`)) || [])[1] || '';
/** Resolves a reference to a node elsewhere in the graph (agents and places are hoisted to the top). */
const resolve = (v: any, graph: any[]) => {
  const x = all(v)[0];
  const id = x?.['@id'];
  return (id && graph.find((n) => n['@id'] === id && n !== x)) || x;
};

const field = (tag: string, ind1: string, ind2: string, subfields: (Subfield | null | false | undefined)[]): DataField | null => {
  const subs = subfields.filter((s): s is Subfield => !!s && !!s[1]);
  return subs.length ? { tag, ind1, ind2, subfields: subs } : null;
};
const sf = (code: string, value: string | undefined): Subfield | null => (value ? [code, value] : null);

const LEADER_TYPE: Record<string, string> = { txt: 'a', tct: 'a', ntm: 'c', tcm: 'c', cri: 'e', crd: 'e', crm: 'e', sti: 'k', prm: 'j', spw: 'i', tdi: 'g', cod: 'm' };
const LEADER_LEVEL: Record<string, string> = { mono: 'm', serl: 's', intg: 'i', mulm: 'm' };
const ROLE_FIELDS: Record<string, [string, string]> = { 'bf:Person': ['00', '1'], 'bf:Family': ['00', '3'], 'bf:Organization': ['10', '2'], 'bf:Jurisdiction': ['10', '1'], 'bf:Meeting': ['11', '2'] };
const PROVISION_IND2: Record<string, string> = { 'bf:Production': '0', 'bf:Publication': '1', 'bf:Distribution': '2', 'bf:Manufacture': '3' };

export function bibframeToMarc(doc: { '@graph': any[] }, options: { recordId?: string; now?: Date } = {}): MarcRecord {
  const graph = doc['@graph'] || [];
  const work = graph.find((n) => isA(n, 'bf:Work') && !get(n, 'expressionOf')) || graph.find((n) => isA(n, 'bf:Work')) || {};
  const instance = graph.find((n) => isA(n, 'bf:Instance')) || {};
  const item = graph.find((n) => isA(n, 'bf:Item')) || {};
  const admin = graph.find((n) => isA(n, 'bf:AdminMetadata')) || {};
  const now = options.now || new Date();
  const fields: MarcField[] = [];
  const push = (f: MarcField | null) => { if (f) fields.push(f); };

  // ---- Leader and control fields ----
  const content = codeIn(get(work, 'content'), 'contentTypes');
  const issuance = codeIn(get(instance, 'issuance'), 'issuance');
  const type = isA(instance, 'bf:Manuscript') && LEADER_TYPE[content] === 'a' ? 't' : LEADER_TYPE[content] || 'a';
  const leader = `00000n${type}${LEADER_LEVEL[issuance] || 'm'} a2200000 c 4500`;

  const id = options.recordId || String(work['@id'] || '').split('/').pop() || '';
  if (id) push({ tag: '001', data: id });
  push({ tag: '005', data: now.toISOString().replace(/[-:T]/g, '').slice(0, 14) + '.0' });

  const provisions = all(get(instance, 'provisionActivity'));
  const pub = provisions.find((p) => isA(p, 'bf:Publication')) || provisions[0];
  const year = (texts(get(pub, 'date')).concat(texts(get(work, 'originDate'))).join(' ').match(/\b(\d{4})\b/) || [])[1];
  const entered = (text(get(admin, 'creationDate')) || now.toISOString()).replace(/-/g, '').slice(2, 8);
  const country = all(get(pub, 'place')).map((p) => codeIn(resolve(p, graph), 'countries')).find(Boolean) || 'xx';
  const lang = codeIn(get(work, 'language'), 'languages') || 'und';
  // 008: date entered, one known year (s) or none (n), place, 17 positions not coded (|), language, source d.
  push({ tag: '008', data: `${entered}${year ? 's' + year : 'nuuuu'}    ${country.padEnd(3, ' ').slice(0, 3)}${'|'.repeat(17)}${lang.slice(0, 3)} d` });

  // ---- Numbers and codes ----
  for (const ident of all(get(instance, 'identifiedBy'))) {
    const value = text(get(ident, 'value') ?? ident['rdf:value']);
    if (isA(ident, 'bf:Lccn')) push(field('010', ' ', ' ', [sf('a', value)]));
    else if (isA(ident, 'bf:Isbn')) push(field('020', ' ', ' ', [sf('a', value)]));
    else if (isA(ident, 'bf:Issn')) push(field('022', ' ', ' ', [sf('a', value)]));
  }
  push(field('040', ' ', ' ', [sf('b', codeIn(get(admin, 'descriptionLanguage'), 'languages')), sf('e', codeIn(get(admin, 'descriptionConventions'), 'descriptionConventions'))]));
  for (const c of all(get(work, 'classification'))) {
    const portion = text(get(c, 'classificationPortion'));
    if (isA(c, 'bf:ClassificationLcc')) push(field('050', ' ', '4', [sf('a', portion), sf('b', text(get(c, 'itemPortion')))]));
    else if (isA(c, 'bf:ClassificationDdc')) push(field('082', '0', '4', [sf('a', portion)]));
  }

  // ---- Names: the primary contributor is the 1XX, everyone else a 7XX ----
  let has1xx = false;
  for (const c of all(get(work, 'contribution'))) {
    const agent = resolve(get(c, 'agent'), graph);
    const name = text(agent);
    if (!name) continue;
    const kind = Object.keys(ROLE_FIELDS).find((t) => isA(agent, t)) || 'bf:Person';
    const [suffix, ind1] = ROLE_FIELDS[kind];
    const primary = isA(c, 'bf:PrimaryContribution') && !has1xx;
    if (primary) has1xx = true;
    const roles = all(get(c, 'role'));
    push(field(`${primary ? '1' : '7'}${suffix}`, ind1, ' ', [
      sf('a', name),
      ...roles.map((r) => sf('e', text(r) && !/^[a-z]{3}$/.test(text(r)) ? text(r) : '')),
      sf('0', uri(agent)),
      ...roles.map((r) => sf('4', codeIn(r, 'relators'))),
    ]));
  }

  // ---- Title and statements ----
  const title = all(get(instance, 'title')).find((t) => !isA(t, 'bf:VariantTitle')) || all(get(work, 'title'))[0];
  const nonSort = text(title?.['bflc:nonSortNum']);
  push(field('245', has1xx ? '1' : '0', /^\d$/.test(nonSort) ? nonSort : '0', [
    sf('a', text(get(title, 'mainTitle'))),
    sf('b', text(get(title, 'subtitle'))),
    sf('n', text(get(title, 'partNumber'))),
    sf('p', text(get(title, 'partName'))),
    sf('c', text(get(instance, 'responsibilityStatement'))),
  ]));
  push(field('250', ' ', ' ', [sf('a', text(get(instance, 'editionStatement')))]));
  for (const p of provisions) {
    const ind2 = PROVISION_IND2[types(p).find((t) => PROVISION_IND2[t] !== undefined) || 'bf:Publication'];
    push(field('264', ' ', ind2, [
      ...all(get(p, 'place')).map((pl) => sf('a', text(resolve(pl, graph)))),
      ...all(get(p, 'agent')).map((a) => sf('b', text(resolve(a, graph)))),
      sf('c', text(get(p, 'date')) || text(p['bflc:simpleDate'])),
    ]));
  }
  push(field('300', ' ', ' ', [sf('a', texts(get(instance, 'extent')).join(' ; ')), sf('c', text(get(instance, 'dimensions')))]));
  const rda = (tag: string, v: any, vocab: string, source: string) => {
    for (const x of all(v)) push(field(tag, ' ', ' ', [sf('a', text(x) || codeIn(x, vocab)), sf('b', codeIn(x, vocab)), sf('2', source), sf('0', uri(x))]));
  };
  rda('336', get(work, 'content'), 'contentTypes', 'rdacontent');
  rda('337', get(instance, 'media'), 'mediaTypes', 'rdamedia');
  rda('338', get(instance, 'carrier'), 'carriers', 'rdacarrier');
  for (const s of texts(get(instance, 'seriesStatement'))) push(field('490', '0', ' ', [sf('a', s)]));

  // ---- Notes ----
  for (const n of [...all(get(work, 'note')), ...all(get(instance, 'note'))]) push(field('500', ' ', ' ', [sf('a', text(n))]));
  for (const s of all(get(work, 'summary'))) push(field('520', ' ', ' ', [sf('a', text(s))]));

  // ---- Subjects and genre (LCSH / LCGFT when the link says so) ----
  for (const s of all(get(work, 'subject'))) {
    const node = resolve(s, graph);
    const link = uri(node);
    const lcsh = /id\.loc\.gov\/authorities\/(subjects|names)\//.test(link);
    const tag = isA(node, 'bf:Place') ? '651' : isA(node, 'bf:Person') ? '600' : isA(node, 'bf:Organization') ? '610' : '650';
    push(field(tag, tag === '600' ? '1' : tag === '610' ? '2' : ' ', lcsh ? '0' : '4', [sf('a', text(node)), sf('0', link)]));
  }
  for (const g of all(get(work, 'genreForm'))) {
    const node = resolve(g, graph);
    const link = uri(node);
    const lcgft = /authorities\/genreForms\//.test(link);
    push(field('655', ' ', lcgft ? '7' : '4', [sf('a', text(node)), lcgft ? sf('2', 'lcgft') : null, sf('0', link)]));
  }

  for (const loc of all(get(item, 'electronicLocator'))) push(field('856', '4', '0', [sf('u', uri(loc) || text(loc))]));

  return { leader, fields };
}

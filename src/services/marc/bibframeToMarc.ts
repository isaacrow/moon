/**
 * BIBFRAME → MARC 21 bibliographic record, from the same validated graph every other export uses
 * (buildW3CJsonLd). It follows LC's BIBFRAME-to-MARC conventions for the fields Moon catalogues:
 * leader, 001/005/008, 010/020/022, 040, 050/082, 1XX/7XX, 245, 250, 264, 300, 336-338, 490, 5XX,
 * 6XX and 856. Authority links travel as $0 and relator codes as $4.
 */
import type { DataField, MarcField, MarcRecord, Subfield } from './marcRecord';
import { nodeToEvent, eventsToMarc, type TransmissionEvent } from '../transmission';

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

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
/** A subfield that may have a parallel Arabic-script value: [code, value, Arabic value]. */
type PSub = [code: string, main: string, alt?: string];
/** The romanized value and its Arabic-script parallel, when a value is held in both; else the one value. */
function scripts(v: any): { main: string; alt?: string } {
  const all = texts(v);
  const roman = all.find((t) => !ARABIC_SCRIPT.test(t));
  const arabic = all.find((t) => ARABIC_SCRIPT.test(t));
  return roman && arabic ? { main: roman, alt: arabic } : { main: all[0] || '' };
}

const LEADER_TYPE: Record<string, string> = { txt: 'a', tct: 'a', ntm: 'c', tcm: 'c', cri: 'e', crd: 'e', crm: 'e', sti: 'k', prm: 'j', spw: 'i', tdi: 'g', cod: 'm' };
const LEADER_LEVEL: Record<string, string> = { mono: 'm', serl: 's', intg: 'i', mulm: 'm' };
const ROLE_FIELDS: Record<string, [string, string]> = { 'bf:Person': ['00', '1'], 'bf:Family': ['00', '3'], 'bf:Organization': ['10', '2'], 'bf:Jurisdiction': ['10', '1'], 'bf:Meeting': ['11', '2'] };
const PROVISION_IND2: Record<string, string> = { 'bf:Production': '0', 'bf:Publication': '1', 'bf:Distribution': '2', 'bf:Manufacture': '3' };

/**
 * The graph with references to its own nodes written out in place: a Work whose bf:title is
 * {"@id": "_:b1"} gets the bf:Title node itself, as the fields below expect. The Work, Instance, Item and
 * AdminMetadata stay references (they are the record's top-level resources), and a node is never written
 * inside itself, so a loop cannot run forever.
 */
function inlineReferences(graph: any[]): any[] {
  const byId = new Map(graph.filter((n) => typeof n?.['@id'] === 'string').map((n) => [n['@id'], n]));
  const top = (n: any) => ['bf:Work', 'bf:Instance', 'bf:Item', 'bf:AdminMetadata'].some((t) => isA(n, t));
  const walk = (v: any, path: Set<any>): any => {
    if (Array.isArray(v)) return v.map((x) => walk(x, path));
    if (!v || typeof v !== 'object') return v;
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '@id') {
      const target = byId.get(v['@id']);
      if (target && !top(target) && !path.has(target)) return walk(target, new Set([...path, target]));
      return v;
    }
    const out: any = {};
    for (const [k, x] of Object.entries(v)) out[k] = k.startsWith('@') ? x : walk(x, new Set([...path, v]));
    return out;
  };
  return graph.map((n) => walk(n, new Set([n])));
}

export function bibframeToMarc(doc: { '@graph': any[] }, options: { recordId?: string; now?: Date } = {}): MarcRecord {
  const graph = inlineReferences(doc['@graph'] || []);
  const work = graph.find((n) => isA(n, 'bf:Work') && !get(n, 'expressionOf')) || graph.find((n) => isA(n, 'bf:Work')) || {};
  const instance = graph.find((n) => isA(n, 'bf:Instance')) || {};
  const item = graph.find((n) => isA(n, 'bf:Item')) || {};
  const admin = graph.find((n) => isA(n, 'bf:AdminMetadata')) || {};
  const now = options.now || new Date();
  const fields: MarcField[] = [];
  const push = (f: MarcField | null) => { if (f) fields.push(f); };

  // Parallel scripts, as LC records them: when a value is held in both Arabic script and romanization,
  // the field carries the romanization and $6 880-NN, and a linked 880 carries the Arabic ($6 TAG-NN/(3/r).
  let linkCount = 0;
  const ps = (code: string, v: any): PSub | null => {
    const { main, alt } = scripts(v);
    return main ? [code, main, alt] : null;
  };
  const pfield = (tag: string, ind1: string, ind2: string, parts: (PSub | null)[]) => {
    const subs = parts.filter((p): p is PSub => !!p && !!p[1]);
    if (!subs.length) return;
    if (!subs.some((p) => p[2])) { push(field(tag, ind1, ind2, subs.map(([c, m]) => [c, m] as Subfield))); return; }
    const n = String(++linkCount).padStart(2, '0');
    push({ tag, ind1, ind2, subfields: [['6', `880-${n}`], ...subs.map(([c, m]) => [c, m] as Subfield)] });
    push({ tag: '880', ind1, ind2, subfields: [['6', `${tag}-${n}/(3/r`], ...subs.map(([c, m, a]) => [c, a || m] as Subfield)] });
  };

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
    else if (isA(ident, 'bf:Local')) {
      const agency = text(get(ident, 'assigner'));
      push(field('035', ' ', ' ', [sf('a', agency ? `(${agency})${value}` : value)]));
    } else {
      const ind1 = { 'bf:Isrc': '0', 'bf:Upc': '1', 'bf:Ismn': '2', 'bf:Ean': '3', 'bf:Sici': '4' }[types(ident).find((t) => /^bf:(Isrc|Upc|Ismn|Ean|Sici)$/.test(t)) || ''] || '7';
      const scheme = isA(ident, 'bf:Doi') ? 'doi' : isA(ident, 'bf:Hdl') ? 'hdl' : isA(ident, 'bf:Isni') ? 'isni' : text(get(ident, 'source'));
      if (value && (ind1 !== '7' || scheme)) push(field('024', ind1, ' ', [sf('a', value), ind1 === '7' ? sf('2', scheme) : null]));
    }
  }
  // More than one language: all of them in 041 (the 008 holds the first).
  const languages = all(get(work, 'language')).map((l) => codeIn(l, 'languages')).filter(Boolean);
  if (languages.length > 1) push(field('041', '0', ' ', languages.map((l) => sf('a', l))));
  push(field('040', ' ', ' ', [sf('b', codeIn(get(admin, 'descriptionLanguage'), 'languages')), sf('e', codeIn(get(admin, 'descriptionConventions'), 'descriptionConventions'))]));
  // Geographic area codes (MARC 043, padded to seven characters: "a-iq---"), from the Work's coverage.
  const areas = [...new Set(all(get(work, 'geographicCoverage')).map((g) => codeIn(g, 'geographicAreas')).filter(Boolean))];
  if (areas.length) push(field('043', ' ', ' ', areas.slice(0, 3).map((a) => sf('a', a.padEnd(7, '-')))));
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
    const plain = (s: Subfield | null): PSub | null => (s ? [s[0], s[1]] : null);
    pfield(`${primary ? '1' : '7'}${suffix}`, ind1, ' ', [
      ps('a', agent),
      ...roles.map((r) => plain(sf('e', text(r) && !/^[a-z]{3}$/.test(text(r)) ? text(r) : ''))),
      plain(sf('0', uri(agent))),
      ...roles.map((r) => plain(sf('4', codeIn(r, 'relators')))),
    ]);
  }

  // ---- Title and statements ----
  const title = all(get(instance, 'title')).find((t) => !isA(t, 'bf:VariantTitle')) || all(get(work, 'title'))[0];
  const nonSort = text(title?.['bflc:nonSortNum']);
  pfield('245', has1xx ? '1' : '0', /^\d$/.test(nonSort) ? nonSort : '0', [
    ps('a', get(title, 'mainTitle')),
    ps('b', get(title, 'subtitle')),
    ps('n', get(title, 'partNumber')),
    ps('p', get(title, 'partName')),
    ps('c', get(instance, 'responsibilityStatement')),
  ]);
  // Variant and parallel titles (246), the second indicator from the variant's type.
  const VARTYPE_IND2: Record<string, string> = { por: '0', dis: '2', cov: '4', atp: '5', cap: '6', run: '7', spi: '8' };
  for (const v of all(get(instance, 'title')).filter((x) => isA(x, 'bf:VariantTitle') || isA(x, 'bf:ParallelTitle'))) {
    const vt = types(v).map((t) => (t.match(/vartitletype\/(\w+)$/) || [])[1]).find(Boolean) || '';
    const ind2 = isA(v, 'bf:ParallelTitle') ? '1' : VARTYPE_IND2[vt] ?? ' ';
    const kind = text(get(v, 'variantType'));
    pfield('246', ind2 === ' ' && kind ? '1' : '3', ind2, [
      kind && ind2 === ' ' ? (['i', `${kind}:`] as PSub) : null,
      ps('a', get(v, 'mainTitle')), ps('b', get(v, 'subtitle')), ps('n', get(v, 'partNumber')), ps('p', get(v, 'partName')),
    ]);
  }
  pfield('250', ' ', ' ', [ps('a', get(instance, 'editionStatement'))]);
  for (const p of provisions) {
    const ind2 = PROVISION_IND2[types(p).find((t) => PROVISION_IND2[t] !== undefined) || 'bf:Publication'];
    pfield('264', ' ', ind2, [
      ...all(get(p, 'place')).map((pl) => ps('a', resolve(pl, graph))),
      ...all(get(p, 'agent')).map((a) => ps('b', resolve(a, graph))),
      ps('c', text(get(p, 'date')) || text(p['bflc:simpleDate'])),
    ]);
  }
  push(field('300', ' ', ' ', [sf('a', texts(get(instance, 'extent')).join(' ; ')), sf('c', text(get(instance, 'dimensions')))]));
  const rda = (tag: string, v: any, vocab: string, source: string) => {
    for (const x of all(v)) push(field(tag, ' ', ' ', [sf('a', text(x) || codeIn(x, vocab)), sf('b', codeIn(x, vocab)), sf('2', source), sf('0', uri(x))]));
  };
  rda('336', get(work, 'content'), 'contentTypes', 'rdacontent');
  rda('337', get(instance, 'media'), 'mediaTypes', 'rdamedia');
  rda('338', get(instance, 'carrier'), 'carriers', 'rdacarrier');
  // A series statement given in both scripts is one series with an 880; otherwise one 490 per statement.
  const series = get(instance, 'seriesStatement');
  if (scripts(series).alt) pfield('490', '0', ' ', [ps('a', series)]);
  else for (const s of texts(series)) push(field('490', '0', ' ', [sf('a', s)]));

  // ---- Notes ----
  // Typed notes go to their own fields (546 language, 588 source of description, 586 awards); the rest are 500.
  const NOTE_TAG: Record<string, string> = { language: '546', 'description source': '588', awards: '586' };
  for (const n of [...all(get(work, 'note')), ...all(get(instance, 'note'))]) {
    const noteType = text(get(n, 'noteType')).toLowerCase();
    push(field(NOTE_TAG[noteType] || '500', ' ', ' ', [sf('a', text(n))]));
  }
  for (const d of all(get(work, 'dissertation'))) {
    push(field('502', ' ', ' ', [sf('a', text(d['rdfs:label'])), sf('b', text(get(d, 'degree'))), sf('c', text(get(d, 'grantingInstitution'))), sf('d', text(get(d, 'date')))]));
  }
  for (const s of all(get(instance, 'supplementaryContent'))) {
    if (/bibliograph/i.test(`${uri(s)} ${text(s['rdfs:label'])}`)) push(field('504', ' ', ' ', [sf('a', text(get(s, 'note')) || text(s))]));
  }
  for (const p of all(get(instance, 'usageAndAccessPolicy'))) push(field(isA(p, 'bf:UsePolicy') ? '540' : '506', ' ', ' ', [sf('a', text(p))]));
  for (const s of all(get(work, 'summary'))) push(field('520', ' ', ' ', [sf('a', text(s))]));
  // Contents and audience, as LC's bibframe2marc writes them.
  for (const t of [...all(get(work, 'tableOfContents')), ...all(get(instance, 'tableOfContents'))]) push(field('505', '0', ' ', [sf('a', text(t))]));
  for (const a of all(get(work, 'intendedAudience'))) push(field('521', ' ', ' ', [sf('a', text(a))]));

  // ---- Subjects and genre (LCSH / LCGFT when the link says so) ----
  for (const s of all(get(work, 'subject'))) {
    const node = resolve(s, graph);
    const link = uri(node);
    const lcsh = /id\.loc\.gov\/authorities\/(subjects|names)\//.test(link);
    if (/^uncontrolled$/i.test(text(get(node, 'source')))) { push(field('653', ' ', ' ', [sf('a', text(node))])); continue; }
    if (isA(node, 'bf:Temporal')) { push(field('648', ' ', lcsh ? '0' : '4', [sf('a', text(node)), sf('0', link)])); continue; }
    const tag = isA(node, 'bf:Place') ? '651' : isA(node, 'bf:Person') ? '600' : isA(node, 'bf:Organization') ? '610' : '650';
    push(field(tag, tag === '600' ? '1' : tag === '610' ? '2' : ' ', lcsh ? '0' : '4', [sf('a', text(node)), sf('0', link)]));
  }
  for (const g of all(get(work, 'genreForm'))) {
    const node = resolve(g, graph);
    const link = uri(node);
    const lcgft = /authorities\/genreForms\//.test(link);
    push(field('655', ' ', lcgft ? '7' : '4', [sf('a', text(node)), lcgft ? sf('2', 'lcgft') : null, sf('0', link)]));
  }

  // Series the Work belongs to (830), from its series relations, with the volume ($v) and the series' URI.
  for (const rel of all(get(work, 'relation'))) {
    if (!/relationship\/series$|^series$/.test(uri(get(rel, 'relationship')) || text(get(rel, 'relationship')))) continue;
    const hub = resolve(get(rel, 'associatedResource'), graph);
    const name = text(get(get(hub, 'title'), 'mainTitle')) || text(hub?.['bflc:aap']);
    push(field('830', ' ', '0', [sf('a', name), sf('v', text(get(rel, 'seriesEnumeration'))), sf('1', uri(hub))]));
  }

  // The Work this Instance is an instance of, by its URI (758), as LC's bibframe2marc writes it.
  const workUri = typeof work['@id'] === 'string' && /^https?:\/\//.test(work['@id']) ? work['@id'] : '';
  if (workUri) push(field('758', ' ', ' ', [sf('4', 'http://id.loc.gov/ontologies/bibframe/instanceOf'), sf('a', text(get(work, 'title'))), sf('1', workUri)]));
  for (const loc of all(get(item, 'electronicLocator'))) push(field('856', '4', '0', [sf('u', uri(loc) || text(loc))]));

  // A manuscript's notes recorded as events on its copies (ijāzah, samāʿ, ownership, waqf …): 561 and 500
  // notes and a 700 for each person, placed among the other fields by tag (880s stay where they are).
  const events = graph.filter((n) => isA(n, 'bf:Item')).flatMap((n) => all(n['moon:transmission']).map(nodeToEvent).filter((e): e is TransmissionEvent => !!e));
  for (const f of eventsToMarc(events)) {
    const at = fields.findIndex((x) => x.tag > f.tag && x.tag !== '880');
    if (at < 0) fields.push(f); else fields.splice(at, 0, f);
  }

  return { leader, fields };
}

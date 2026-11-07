/**
 * The linked-data audit (Phase 12): published Moon data (N-Triples) measured against BIBFRAME 3.0.1 and
 * linked-data rules. The same code runs in CI (records the code makes), every night on the live dump (and
 * fails when a number gets worse), and on the Super Admin's scorecard page.
 *
 * Measures: terms outside BIBFRAME 3.0.1 / BFLC, properties holding the wrong kind of value, Work and Instance
 * cores, how many contributors, subjects, places and publishers point at an entity, Arabic text with a language
 * tag, typed (EDTF) dates, empty or junk values, placeholder addresses, and the entity file's outside links.
 * No imports: the vocabulary lists are passed in.
 */

export interface Vocabulary {
  bfClasses: Set<string>; bfObject: Set<string>; bfData: Set<string>;
  bflcClasses: Set<string>; bflcObject: Set<string>; bflcData: Set<string>;
}
export interface EntityStats { total: number; withOutsideLinks: number }

const BF = 'http://id.loc.gov/ontologies/bibframe/';
const BFLC = 'http://id.loc.gov/ontologies/bflc/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SAME_AS = /owl#sameAs|hasExactExternalAuthority|skos\/core#exactMatch/;
const ENTITY = /^https:\/\/mooon\.site\/resource\/(agent|place|topic|genre|hub|period)\//;
const ARABIC = /[؀-ۿ]/;

type Term = { kind: 'iri' | 'bnode' | 'lit'; v: string; lang?: string; dt?: string };

function parseTerm(raw: string): Term {
  if (raw.startsWith('<')) return { kind: 'iri', v: raw.slice(1, -1) };
  if (raw.startsWith('_:')) return { kind: 'bnode', v: raw };
  const m = raw.match(/^"((?:[^"\\]|\\.)*)"(?:@([\w-]+)|\^\^<([^>]+)>)?$/);
  if (!m) return { kind: 'lit', v: raw };
  let v = m[1];
  try { v = JSON.parse(`"${m[1]}"`); } catch { /* keep as written */ }
  return { kind: 'lit', v, lang: m[2], dt: m[3] };
}

export interface Measure { key: string; en: string; ar: string; value: number; total: number; target: 'all' | 'none' }
export interface AuditReport {
  at: string;
  counts: { triples: number; works: number; instances: number; items: number; entities: number };
  measures: Measure[];
  unknownTerms: Record<string, number>;
  rangeErrors: Record<string, number>;
  unlinked: { contributors: string[]; subjects: string[] };
}

/** Audits N-Triples (or N-Quads) text. */
export function auditNTriples(nt: string, vocab: Vocabulary, entities?: EntityStats): AuditReport {
  const bySubject = new Map<string, { p: string; o: Term }[]>();
  const triples: { s: Term; p: string; o: Term }[] = [];
  for (const line of nt.split('\n')) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const m = l.match(/^(\S+)\s+<([^>]+)>\s+(.+?)(?:\s+<[^>]*>)?\s*\.$/);
    if (!m) continue;
    const t = { s: parseTerm(m[1]), p: m[2], o: parseTerm(m[3]) };
    triples.push(t);
    const list = bySubject.get(t.s.v) || [];
    list.push({ p: t.p, o: t.o });
    bySubject.set(t.s.v, list);
  }
  const vals = (s: string, p: string) => (bySubject.get(s) || []).filter((x) => x.p === p).map((x) => x.o);
  const has = (s: string, p: string) => vals(s, p).length > 0;
  const types = (s: string) => vals(s, RDF_TYPE).map((o) => o.v);
  const isA = (s: string, c: string) => types(s).includes(BF + c);
  const subjects = [...bySubject.keys()];
  const count = (m: Record<string, number>, k: string) => { m[k] = (m[k] || 0) + 1; };

  // Vocabulary and ranges
  const unknownTerms: Record<string, number> = {};
  const rangeErrors: Record<string, number> = {};
  for (const t of triples) {
    for (const iri of [t.p, t.p === RDF_TYPE && t.o.kind === 'iri' ? t.o.v : '']) {
      if (iri.startsWith(BF)) {
        const n = iri.slice(BF.length);
        if (!vocab.bfClasses.has(n) && !vocab.bfObject.has(n) && !vocab.bfData.has(n)) count(unknownTerms, `bf:${n}`);
      } else if (iri.startsWith(BFLC)) {
        const n = iri.slice(BFLC.length);
        if (!vocab.bflcClasses.has(n) && !vocab.bflcObject.has(n) && !vocab.bflcData.has(n)) count(unknownTerms, `bflc:${n}`);
      }
    }
    if (t.p.startsWith(BF)) {
      const n = t.p.slice(BF.length);
      if (vocab.bfObject.has(n) && t.o.kind === 'lit') count(rangeErrors, `bf:${n} (text where a node belongs)`);
      if (vocab.bfData.has(n) && t.o.kind !== 'lit') count(rangeErrors, `bf:${n} (node where text belongs)`);
    }
  }

  // Works and Instances
  // A record's own Works: addressed (not blank nodes such as a translated-from work), not an Expression of another.
  const works = subjects.filter((s) => isA(s, 'Work') && !s.startsWith('_:') && !types(s).includes('https://mooon.site/ontology/Expression'));
  const instances = subjects.filter((s) => isA(s, 'Instance'));
  const items = subjects.filter((s) => isA(s, 'Item'));
  const titled = (s: string) => vals(s, BF + 'title').some((t) => has(t.v, BF + 'mainTitle'));
  const linkedBothWays = works.filter((w) => has(w, BF + 'hasInstance') && instances.some((i) => vals(i, BF + 'instanceOf').some((o) => o.v === w))).length;
  let agents = 0, agentsLinked = 0, subs = 0, subsLinked = 0, places = 0, placesLinked = 0, pubs = 0, pubsLinked = 0, dated = 0, edtf = 0;
  const unlinkedContributors = new Set<string>(), unlinkedSubjects = new Set<string>();
  const labelOf = (s: string) => vals(s, 'http://www.w3.org/2000/01/rdf-schema#label').map((l) => l.v)[0] || '';
  for (const w of works) {
    for (const c of vals(w, BF + 'contribution')) for (const a of vals(c.v, BF + 'agent')) {
      agents++;
      if (a.kind === 'iri') agentsLinked++; else unlinkedContributors.add(labelOf(a.v));
    }
    for (const s of vals(w, BF + 'subject')) {
      subs++;
      if (s.kind === 'iri') subsLinked++; else unlinkedSubjects.add(labelOf(s.v));
    }
  }
  for (const i of instances) {
    const pas = vals(i, BF + 'provisionActivity');
    if (pas.some((p) => has(p.v, BF + 'date'))) dated++;
    if (pas.some((p) => vals(p.v, BF + 'date').some((d) => /edtf/i.test(d.dt || '')))) edtf++;
    for (const p of pas) {
      for (const pl of vals(p.v, BF + 'place')) { places++; if (pl.kind === 'iri') placesLinked++; }
      for (const ag of vals(p.v, BF + 'agent')) { pubs++; if (ag.kind === 'iri') pubsLinked++; }
    }
  }

  // Literals and addresses
  let arabic = 0, arabicTagged = 0, junk = 0, placeholders = 0;
  for (const t of triples) {
    for (const x of [t.s, t.o]) if (x.kind === 'iri' && /moonlib\.org|example\.(org|com)/.test(x.v)) placeholders++;
    if (t.o.kind !== 'lit') continue;
    const v = t.o.v.trim();
    if (!v || /^(undefined|null|\[object Object\]|NaN)$/i.test(v) || (/^[[{].*[\]}]$/.test(v) && v.includes('"'))) junk++;
    if (ARABIC.test(v)) { arabic++; if (t.o.lang) arabicTagged++; }
  }
  const entityIris = new Set(triples.flatMap((t) => [t.s, t.o]).filter((x) => x.kind === 'iri' && ENTITY.test(x.v)).map((x) => x.v.replace(/#.*$/, '')));
  const entitiesWithLinks = entities?.withOutsideLinks ?? [...entityIris].filter((e) => (bySubject.get(e) || []).some((x) => SAME_AS.test(x.p))).length;
  const entityTotal = entities?.total ?? entityIris.size;
  const sameAsInData = triples.filter((t) => SAME_AS.test(t.p)).length;
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

  const M = (key: string, en: string, ar: string, value: number, total: number, target: 'all' | 'none' = 'all'): Measure => ({ key, en, ar, value, total, target });
  return {
    at: new Date().toISOString(),
    counts: { triples: triples.length, works: works.length, instances: instances.length, items: items.length, entities: entityTotal },
    measures: [
      M('workInstance', 'Work ↔ Instance linked both ways', 'العمل والطبعة مرتبطان في الاتجاهين', linkedBothWays, works.length),
      M('workTitle', 'Works with a title', 'أعمال لها عنوان', works.filter(titled).length, works.length),
      M('instanceTitle', 'Instances with a title', 'طبعات لها عنوان', instances.filter(titled).length, instances.length),
      M('adminMetadata', 'Records with admin metadata', 'تسجيلات لها بيانات إدارية', works.filter((w) => has(w, BF + 'adminMetadata')).length, works.length),
      M('contributorsLinked', 'Contributors linked to an entity', 'المساهمون المرتبطون بكيان', agentsLinked, agents),
      M('subjectsLinked', 'Subjects linked to an entity', 'الموضوعات المرتبطة بكيان', subsLinked, subs),
      M('placesLinked', 'Places of publication linked', 'أماكن النشر المرتبطة', placesLinked, places),
      M('publishersLinked', 'Publishers linked', 'الناشرون المرتبطون', pubsLinked, pubs),
      M('entitiesOutward', 'Entities linked to LC, VIAF or Wikidata', 'كيانات مرتبطة بمكتبة الكونغرس أو VIAF أو ويكي بيانات', entitiesWithLinks, entityTotal),
      M('sameAsInData', 'Entity outside links in the published data', 'روابط الكيانات الخارجية في البيانات المنشورة', sameAsInData > 0 ? 1 : 0, 1),
      M('arabicTagged', 'Arabic text with a language tag', 'نصوص عربية بوسم لغة', arabicTagged, arabic),
      M('edtfDates', 'Publications dated in EDTF', 'تواريخ نشر بصيغة EDTF', edtf, instances.length),
      M('unknownTerms', 'Uses of terms outside BIBFRAME 3.0.1', 'مصطلحات خارج BIBFRAME 3.0.1', sum(unknownTerms), 0, 'none'),
      M('rangeErrors', 'Values of the wrong kind', 'قيم من نوع خاطئ', sum(rangeErrors), 0, 'none'),
      M('junk', 'Empty or junk values', 'قيم فارغة أو تالفة', junk, 0, 'none'),
      M('placeholders', 'Placeholder addresses', 'عناوين مؤقتة', placeholders, 0, 'none'),
    ],
    unknownTerms,
    rangeErrors,
    unlinked: { contributors: [...unlinkedContributors].filter(Boolean).slice(0, 50), subjects: [...unlinkedSubjects].filter(Boolean).slice(0, 50) },
  };
}

/** The share a measure reaches (1 = target met). "none" measures are met at 0. */
export const score = (m: Measure) => (m.target === 'none' ? (m.value === 0 ? 1 : 0) : m.total ? m.value / m.total : 1);

/** Measures that got worse than a baseline: a lower share, or more of what should be none. */
export function regressions(now: AuditReport, baseline: Record<string, { value: number; total: number }>): string[] {
  const out: string[] = [];
  for (const m of now.measures) {
    const b = baseline[m.key];
    if (!b) continue;
    if (m.target === 'none' ? m.value > b.value : (m.total ? m.value / m.total : 1) < (b.total ? b.value / b.total : 1) - 1e-9) {
      out.push(`${m.en}: ${m.value}${m.total ? `/${m.total}` : ''} (was ${b.value}${b.total ? `/${b.total}` : ''})`);
    }
  }
  return out;
}

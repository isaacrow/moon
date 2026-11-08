/**
 * OPAC knowledge pages (Phase 13 S14), from the catalogue's own records, never made up:
 * - aboutPerson: works whose subject is the person;
 * - teachersAndStudents: who taught them and whom they taught, from the ijāzāt, samāʿ and qirāʾa notes
 *   recorded on manuscript copies (Phase 11 transmission events);
 * - personPlaces: where their works were published and where their transmission events took place;
 * - shelfNeighbours: works next to this one on the shelf, by real call numbers or class numbers only;
 * - subjectsAlongside: the subjects most often given together with a subject.
 * No React here, so it is tested on plain records.
 */
import { sameNameScore, foldArabic, foldLatin } from '../services/arabicNames';

interface Person { id?: string; uri?: string; name?: string; nameArabic?: string; nameEnglish?: string; authorityLinks?: string[] }
interface Participant { role: string; label: string; uri?: string }
interface KWork {
  id: string;
  title: string;
  subjects?: Array<{ id?: string; label: string; uri?: string }>;
  primaryCreator?: Person;
  contributors?: Person[];
  instances?: Array<{ publicationPlace?: string; callNumber?: string }>;
  classificationLcc?: string;
  classificationDdc?: string;
  holdingItems?: Array<{ synthetic?: boolean; shelfMark?: string; events?: Array<{ kind: string; participants: Participant[]; place?: { label: string; uri?: string }; date?: string }> }>;
}

const ARABIC = /[؀-ۿ]/;
const fold = (s: string) => (ARABIC.test(s) ? foldArabic(s) : foldLatin(s)).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The person's names and addresses, to recognise them in subjects and notes. */
export interface Who { names: string[]; uris: string[] }
export function whoOf(p: Person, extraNames: string[] = [], extraUris: string[] = []): Who {
  return {
    names: [p.nameArabic, p.name, p.nameEnglish, ...extraNames].map((s) => String(s || '').trim()).filter(Boolean),
    uris: [p.uri, ...(p.authorityLinks || []), ...extraUris].map((s) => String(s || '').trim()).filter((u) => /^https?:\/\//.test(u)),
  };
}

/** Whether a name (and address) given somewhere is this person: the same address, or a sure name match. */
export function isThem(who: Who, label: string | undefined, uri?: string): boolean {
  if (uri && who.uris.includes(uri)) return true;
  const l = String(label || '').trim();
  if (!l) return false;
  return who.names.some((n) => fold(n) === fold(l) || (ARABIC.test(n) === ARABIC.test(l) && sameNameScore(n, l) >= 0.85));
}

/** Works whose subject is the person (books about them). */
export function aboutPerson<W extends KWork>(who: Who, works: W[]): W[] {
  return works.filter((w) => (w.subjects || []).some((s) => isThem(who, s.label.replace(/\s*--.*$/, ''), s.uri)));
}

export interface Link { label: string; uri?: string; kind: string; workId: string; date?: string }

const TEACHING = new Set(['ijazah', 'sama', 'qiraa']);
const LEARNERS = new Set(['student', 'reader', 'listener']);

/** Teachers and students, each once (by address, else by name), from the transmission notes on copies. */
export function teachersAndStudents(who: Who, works: KWork[]): { teachers: Link[]; students: Link[] } {
  const teachers = new Map<string, Link>();
  const students = new Map<string, Link>();
  const key = (p: Participant) => p.uri || fold(p.label);
  for (const w of works) {
    for (const copy of w.holdingItems || []) {
      if (copy.synthetic) continue;
      for (const e of copy.events || []) {
        if (!TEACHING.has(e.kind)) continue;
        const me = e.participants.filter((p) => isThem(who, p.label, p.uri));
        if (!me.length) continue;
        const asTeacher = me.some((p) => p.role === 'teacher');
        const asLearner = me.some((p) => LEARNERS.has(p.role));
        for (const p of e.participants) {
          if (!p.label?.trim() || isThem(who, p.label, p.uri)) continue;
          const link = { label: p.label, ...(p.uri ? { uri: p.uri } : {}), kind: e.kind, workId: w.id, ...(e.date ? { date: e.date } : {}) };
          if (asLearner && p.role === 'teacher' && !teachers.has(key(p))) teachers.set(key(p), link);
          if (asTeacher && LEARNERS.has(p.role) && !students.has(key(p))) students.set(key(p), link);
        }
      }
    }
  }
  return { teachers: [...teachers.values()], students: [...students.values()] };
}

/** Places tied to the person: where their works were published, where their transmission events took place. */
export function personPlaces(who: Who, theirWorks: KWork[], allWorks: KWork[]): Array<{ label: string; count: number }> {
  const n = new Map<string, { label: string; count: number }>();
  const add = (raw?: string) => {
    const label = String(raw || '').replace(/[\[\]]/g, '').replace(/\s*[:;,]\s*$/, '').trim();
    if (!label || /^(s\.l|n\.p|د\.م|بلا مكان)/i.test(label)) return;
    const k = fold(label);
    const cur = n.get(k) || { label, count: 0 };
    cur.count++;
    n.set(k, cur);
  };
  theirWorks.forEach((w) => (w.instances || []).forEach((i) => add(i.publicationPlace)));
  allWorks.forEach((w) => (w.holdingItems || []).forEach((c) => (c.events || []).forEach((e) => {
    if (e.place?.label && e.participants.some((p) => isThem(who, p.label, p.uri))) add(e.place.label);
  })));
  return [...n.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// ---- Shelf ----

/** The work's own call number or class number, if it has one (nothing made up). */
export function shelfMarkOf(w: KWork): string | undefined {
  const real = (w.holdingItems || []).find((c) => !c.synthetic && c.shelfMark)?.shelfMark;
  return [w.instances?.[0]?.callNumber, real, w.classificationLcc, w.classificationDdc].map((s) => String(s || '').trim()).find(Boolean);
}

/** A call number made sortable: "PJ7755 .A5" < "PJ7755.2" < "PJ7756"; Dewey "892.7" < "892.71". */
export function shelfKey(mark: string): string {
  const m = mark.toUpperCase().replace(/\s+/g, ' ').trim();
  const lc = m.match(/^([A-Z]{1,3})\s?(\d+)(\.\d+)?\s*(.*)$/);
  if (lc) return `1 ${lc[1].padEnd(3, ' ')} ${lc[2].padStart(5, '0')}${(lc[3] || '.').padEnd(8, '0')} ${lc[4]}`;
  const ddc = m.match(/^(\d{3})(\.\d+)?\s*(.*)$/);
  if (ddc) return `2 ${ddc[1]}${(ddc[2] || '.').padEnd(10, '0')} ${ddc[3]}`;
  return `3 ${m}`;
}

/** Up to `size` works around this one on the shelf, in call-number order; none when it has no call number. */
export function shelfNeighbours<W extends KWork>(work: W, all: W[], size = 6): W[] {
  const own = shelfMarkOf(work);
  if (!own) return [];
  const shelf = all.map((w) => ({ w, mark: shelfMarkOf(w) })).filter((x): x is { w: W; mark: string } => !!x.mark)
    .sort((a, b) => shelfKey(a.mark).localeCompare(shelfKey(b.mark)) || a.w.title.localeCompare(b.w.title));
  const at = shelf.findIndex((x) => x.w.id === work.id);
  const half = Math.floor(size / 2);
  const start = Math.max(0, Math.min(at - half, shelf.length - size - 1));
  return shelf.slice(start, start + size + 1).map((x) => x.w).filter((w) => w.id !== work.id).slice(0, size);
}

/** The subjects most often given together with this one, with how often. */
export function subjectsAlongside(label: string, works: KWork[], limit = 8): Array<{ label: string; count: number }> {
  const me = fold(label);
  const n = new Map<string, { label: string; count: number }>();
  for (const w of works) {
    const labels = (w.subjects || []).map((s) => s.label);
    if (!labels.some((l) => fold(l) === me)) continue;
    for (const l of new Set(labels)) {
      const k = fold(l);
      if (k === me || !k) continue;
      const cur = n.get(k) || { label: l, count: 0 };
      cur.count++;
      n.set(k, cur);
    }
  }
  return [...n.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

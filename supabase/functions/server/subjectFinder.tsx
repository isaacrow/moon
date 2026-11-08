/**
 * Subject finder (Phase 13 S16, the part that needs no AI): "Suggest subjects" compares the record being
 * catalogued with every published record in Moon, finds the 10 nearest by their words (title, subtitle,
 * summary, contents, people; weighted so rare words count more: TF-IDF with cosine similarity, Arabic folded
 * and the article removed), and ranks the subjects those neighbours carry. The cataloguer picks; nothing is
 * added by itself. Each suggestion says which nearby records use it.
 * No imports: the server passes the records; the tests run it in Node.
 */

export interface FinderRecord { id: string; title: string; text: string; subjects: Array<{ label: string; uri?: string; type?: string }> }
export interface SubjectSuggestion { label: string; uri?: string; type?: string; score: number; records: Array<{ id: string; title: string }> }

const STOP = new Set([
  "في", "من", "على", "الى", "إلى", "عن", "مع", "او", "أو", "و", "ثم", "هذا", "هذه", "ذلك", "التي", "الذي", "كتاب", "دراسة", "تحقيق",
  "al", "el", "the", "a", "an", "of", "and", "in", "on", "to", "for", "by", "with", "from", "at", "as", "or", "is", "its", "book", "study",
]);

/** Words of a text, folded: Arabic letter forms and diacritics, ال/al-, case. */
export function words(s: string): string[] {
  return String(s || "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ؤئ]/g, "ء")
    .normalize("NFKD").replace(/[̀-ًͯ-ٰٕـ]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.replace(/^(و|ف|ب|ل)?ال(?=..)/, "").replace(/^(al|el)-?(?=...)/, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));
}

type Vec = Map<string, number>;

function tf(ws: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of ws) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

/** An index of the catalogue: each record's weighted word vector. */
export function buildIndex(records: FinderRecord[]) {
  const docs = records.map((r) => ({ r, tf: tf(words(`${r.title} ${r.title} ${r.text}`)) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
  const n = Math.max(1, docs.length);
  const idf = (w: string) => Math.log((n + 1) / ((df.get(w) || 0) + 1)) + 1;
  const vec = (t: Map<string, number>): Vec => {
    const v: Vec = new Map();
    let norm = 0;
    for (const [w, c] of t) { const x = (1 + Math.log(c)) * idf(w); v.set(w, x); norm += x * x; }
    norm = Math.sqrt(norm) || 1;
    for (const [w, x] of v) v.set(w, x / norm);
    return v;
  };
  return { items: docs.map((d) => ({ r: d.r, v: vec(d.tf) })), vec: (text: string) => vec(tf(words(text))) };
}

const cosine = (a: Vec, b: Vec) => {
  let s = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [w, x] of small) { const y = big.get(w); if (y) s += x * y; }
  return s;
};

/** The nearest records to a draft, best first (only those that share some words). */
export function nearest(index: ReturnType<typeof buildIndex>, draftText: string, k = 10, excludeId?: string) {
  const q = index.vec(draftText);
  return index.items
    .filter((it) => it.r.id !== excludeId)
    .map((it) => ({ r: it.r, score: cosine(q, it.v) }))
    .filter((x) => x.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const key = (s: { label: string; uri?: string }) => s.uri || words(s.label).join(" ");

/** Subjects of the nearest records, ranked by how close the records that carry them are; minus those the draft already has. */
export function suggestSubjects(index: ReturnType<typeof buildIndex>, draftText: string, have: Array<{ label: string; uri?: string }> = [], excludeId?: string, limit = 12): SubjectSuggestion[] {
  const already = new Set(have.map(key));
  const out = new Map<string, SubjectSuggestion>();
  for (const { r, score } of nearest(index, draftText, 10, excludeId)) {
    for (const s of r.subjects) {
      if (!s.label?.trim() || already.has(key(s))) continue;
      const k = key(s);
      const cur = out.get(k) || { label: s.label, ...(s.uri ? { uri: s.uri } : {}), ...(s.type ? { type: s.type } : {}), score: 0, records: [] };
      cur.score += score;
      if (!cur.records.some((x) => x.id === r.id)) cur.records.push({ id: r.id, title: r.title });
      out.set(k, cur);
    }
  }
  return [...out.values()].map((s) => ({ ...s, score: Math.round(s.score * 100) / 100 })).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit);
}

// ---- From stored records ----

const list = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const text = (v: any): string => {
  for (const x of list(v)) {
    if (typeof x === "string" && x.trim()) return x.trim();
    if (x && typeof x === "object") {
      const t = typeof x["@value"] === "string" ? x["@value"].trim() : text(x["rdfs:label"] ?? x["bf:mainTitle"] ?? x["mainTitle"]);
      if (t) return t;
    }
  }
  return "";
};
const all = (v: any): string[] => list(v).flatMap((x) => (typeof x === "string" ? [x] : x && typeof x === "object" ? [text(x)] : [])).filter(Boolean);
const get = (n: any, k: string) => n?.[`bf:${k}`] ?? n?.[k];
const typed = (n: any, t: string) => list(n?.["@type"]).some((x: any) => String(x).endsWith(t));

/** A Work node (and its Instance) as the finder sees it: words and subjects. */
export function finderText(work: any, instance?: any): string {
  const title = get(work, "title") ?? get(instance, "title");
  const people = list(get(work, "contribution")).map((c) => text(get(c, "agent")));
  return [
    text(get(title, "mainTitle") ?? title), text(get(title, "subtitle")),
    ...all(get(work, "summary")), ...all(get(work, "tableOfContents")), ...people, ...all(get(work, "genreForm")),
  ].filter(Boolean).join(" ");
}

export function subjectsOf(work: any): Array<{ label: string; uri?: string; type?: string }> {
  return list(get(work, "subject")).map((s) => {
    const label = text(s);
    const uri = typeof s?.["@id"] === "string" && /^https?:/.test(s["@id"]) ? s["@id"] : undefined;
    const type = list(s?.["@type"]).map(String).find((t) => /Topic|Person|Place|Organization|Temporal|Family/.test(t));
    return { label, ...(uri ? { uri } : {}), ...(type ? { type } : {}) };
  }).filter((s) => s.label);
}

export function finderRecordOf(r: { id: string; title?: string; document?: any }): FinderRecord {
  const graph: any[] = Array.isArray(r.document?.["@graph"]) ? r.document["@graph"] : [];
  const work = graph.find((n) => typed(n, "Work")) || {};
  const instance = graph.find((n) => typed(n, "Instance"));
  return { id: r.id, title: r.title || text(get(instance, "title")) || r.id, text: finderText(work, instance), subjects: subjectsOf(work) };
}

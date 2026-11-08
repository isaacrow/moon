/**
 * Ask Moon (Phase 13 S15): a reader asks in Arabic or English; Moon answers only from its own published
 * records, with links, and says how it searched. If no record answers, it says so and points to the library.
 *
 *   1. plan    — Claude turns the question into an "ideal record" and a few catalogue searches;
 *   2. search  — Moon's own search finds the real records (published, openly licensed);
 *   3. answer  — Claude answers from those records only, citing each by its id; nothing else counts.
 *
 * Switched on by the ANTHROPIC_API_KEY secret; a daily cap (MOON_ASK_DAILY_LIMIT, default 200 questions)
 * keeps the cost bounded. No imports: index.tsx passes the Claude calls and the search; tests run it in Node.
 */

export interface AskPlan { language: "ar" | "en"; queries: string[]; ideal: { titles: string[]; people: string[]; subjects: string[] } }
export interface AskRecord { id: string; title: string; url: string; creator?: string; year?: string; subjects?: string[]; summary?: string; language?: string }
export interface AskDraft { found: boolean; answer: string; cited: string[] }
export interface AskReply { answer: string; sources: Array<{ id: string; title: string; url: string }>; searched: string[]; noSource: boolean; language: "ar" | "en" }

export interface AskDeps {
  plan(question: string): Promise<AskPlan | null>;
  search(query: string): Promise<AskRecord[]>;
  answer(question: string, language: "ar" | "en", records: AskRecord[]): Promise<AskDraft | null>;
}

export const MAX_QUESTION = 500;
export const MAX_RECORDS = 10;
const ARABIC = /[؀-ۿ]/;

export const languageOf = (q: string): "ar" | "en" => (ARABIC.test(q) ? "ar" : "en");

/** What Claude sees of one record: short, factual, with its id to cite. */
export function digest(r: AskRecord): string {
  return [
    `[${r.id}] ${r.title}`,
    r.creator ? `by ${r.creator}` : "",
    r.year ? `(${r.year})` : "",
    r.language ? `language: ${r.language}` : "",
    r.subjects?.length ? `subjects: ${r.subjects.slice(0, 8).join("; ")}` : "",
    r.summary ? `summary: ${r.summary.slice(0, 600)}` : "",
  ].filter(Boolean).join(" — ");
}

export const PLAN_SYSTEM = [
  "You turn a library reader's question into searches of Moon, a library catalogue strong in Arabic books and manuscripts.",
  "Describe the ideal record that would answer it (titles, people, subjects), then give 1 to 4 short catalogue searches:",
  "names and title words as they would appear in a record, in Arabic script and, where useful, in English or ALA-LC romanization.",
  "Searches match words in titles, names, subjects and publishers; keep each to a few words.",
].join(" ");

export const ANSWER_SYSTEM = [
  "You answer library readers' questions using ONLY the catalogue records you are given, in the reader's language.",
  "Cite every record you rely on by its id in square brackets, like [s9780394740676], and list those ids in `cited`.",
  "Do not use outside knowledge to add facts the records do not contain; you may explain how the records relate to the question.",
  "If the records do not answer the question, set found to false and say briefly that Moon has no record on it.",
  "Keep the answer short: a few sentences, plain words.",
].join(" ");

/** The whole exchange; never throws (a failure is a polite answer). */
export async function askMoon(question: string, deps: AskDeps): Promise<AskReply> {
  const q = question.trim().slice(0, MAX_QUESTION);
  const lang0 = languageOf(q);
  const plan = await deps.plan(q).catch(() => null);
  const language = plan?.language || lang0;
  const queries = [...new Set((plan?.queries?.length ? plan.queries : [q]).map((s) => s.trim()).filter(Boolean))].slice(0, 4);

  const seen = new Map<string, AskRecord>();
  for (const query of queries) {
    for (const r of await deps.search(query).catch(() => [])) if (!seen.has(r.id) && seen.size < MAX_RECORDS) seen.set(r.id, r);
  }
  const records = [...seen.values()];
  const none = (): AskReply => ({
    answer: language === "ar"
      ? "لم أجد في فهرس مون تسجيلة تجيب عن هذا السؤال. اسأل أمين المكتبة، فقد يكون في المكتبة ما لم يُفهرس بعد."
      : "I found no record in Moon that answers this. Please ask a librarian: the library may hold something not catalogued yet.",
    sources: [], searched: queries, noSource: true, language,
  });
  if (!records.length) return none();

  const draft = await deps.answer(q, language, records).catch(() => null);
  if (!draft || !draft.found) return none();
  // Only records Moon actually gave count as sources; an id Claude made up is dropped.
  const cited = draft.cited.filter((id) => seen.has(id));
  const used = (cited.length ? cited : records.slice(0, 3).map((r) => r.id)).map((id) => seen.get(id)!);
  return {
    answer: draft.answer.replace(/\[([^\]]+)\]/g, (m, id) => (seen.has(id) ? m : "")).trim(),
    sources: used.map((r) => ({ id: r.id, title: r.title, url: r.url })),
    searched: queries, noSource: false, language,
  };
}

// ---- The daily cap ----

export const dayKey = (now: Date) => `ask-count:${now.toISOString().slice(0, 10)}`;
/** Whether one more question fits today's cap. */
export const underCap = (count: number, limit: number) => count < Math.max(0, limit);

// ---- From a stored record ----

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
const typed = (n: any, t: string) => list(n?.["@type"]).some((x: any) => String(x).endsWith(t));
const get = (n: any, k: string) => n?.[`bf:${k}`] ?? n?.[k];

/** The facts Ask Moon shows Claude about one record, read from its BIBFRAME document. */
export function askRecordOf(r: { id: string; title?: string; document?: any }, site = "https://mooon.site"): AskRecord {
  const graph: any[] = Array.isArray(r.document?.["@graph"]) ? r.document["@graph"] : [];
  const byId = new Map(graph.map((n) => [n?.["@id"], n]));
  const deref = (v: any) => (v && typeof v === "object" && v["@id"] && byId.has(v["@id"]) && Object.keys(v).length === 1 ? byId.get(v["@id"]) : v);
  const work = graph.find((n) => typed(n, "Work")) || {};
  const instance = graph.find((n) => typed(n, "Instance")) || {};
  const agent = deref(get(list(get(work, "contribution")).map(deref)[0], "agent"));
  const date = list(get(instance, "provisionActivity")).map(deref).map((p) => text(get(p, "date"))).find(Boolean) || text(get(work, "originDate"));
  const subjects = list(get(work, "subject")).map(deref).map(text).filter(Boolean);
  const lang = list(get(work, "language")).map((l) => String(deref(l)?.["@id"] || text(l)).split("/").pop()).find(Boolean);
  return {
    id: r.id,
    title: r.title || text(get(instance, "title")) || text(get(work, "title")) || r.id,
    url: `${site}/opac.html?work=${encodeURIComponent(r.id)}`,
    ...(text(agent) ? { creator: text(agent) } : {}),
    ...(date ? { year: date } : {}),
    ...(subjects.length ? { subjects } : {}),
    ...(text(get(work, "summary")) ? { summary: text(get(work, "summary")) } : {}),
    ...(lang ? { language: lang } : {}),
  };
}

/**
 * W3C Reconciliation Service API (https://www.w3.org/community/reports/reconciliation/CG-FINAL-specs-0.2-20230410/)
 * over Moon's authority file, so OpenRefine and other tools can match a column of names, places or topics
 * to Moon's people, places and topics (mooon.site/resource/agent|place|topic/<id>).
 * The search is passed in, so this is tested without a database.
 */

export type ReconKind = "agent" | "place" | "topic";
export interface ReconEntry { id: string; kind: ReconKind | string; label: string; variants: string[] }
export type ReconSearch = (query: string, kind: ReconKind | null, limit: number) => Promise<ReconEntry[]>;

const TYPES: { id: ReconKind; name: string }[] = [
  { id: "agent", name: "Person or organization" },
  { id: "place", name: "Place" },
  { id: "topic", name: "Topic" },
];

/** Compares names the way the authority file does: no diacritics, alef/hamza and taa marbuta folded. */
export function normalizeName(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ـ/g, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function manifest(base: string) {
  return {
    versions: ["0.2"],
    name: "Moon authority file",
    identifierSpace: `${base}/`,
    schemaSpace: "http://id.loc.gov/ontologies/bibframe/",
    defaultTypes: TYPES,
    view: { url: `${base}/{{id}}` },
  };
}

/** Score 0–100: exact name or variant 100, a name that starts with the query 80, otherwise by word overlap. */
function score(query: string, e: ReconEntry): number {
  const q = normalizeName(query);
  const names = [e.label, ...e.variants].map(normalizeName);
  if (names.includes(q)) return 100;
  if (names.some((n) => n.startsWith(q) || q.startsWith(n))) return 80;
  const words = new Set(q.split(" "));
  const best = Math.max(0, ...names.map((n) => n.split(" ").filter((w) => words.has(w)).length / Math.max(words.size, 1)));
  return Math.round(60 * best);
}

export async function reconcile(queries: Record<string, any>, search: ReconSearch) {
  const out: Record<string, { result: any[] }> = {};
  for (const [key, q] of Object.entries(queries || {})) {
    const query = typeof q?.query === "string" ? q.query.trim() : "";
    const type = (Array.isArray(q?.type) ? q.type[0] : q?.type) as string | undefined;
    const kind = TYPES.some((t) => t.id === type) ? (type as ReconKind) : null;
    const limit = Math.min(25, Math.max(1, Number(q?.limit) || 5));
    if (!query) { out[key] = { result: [] }; continue; }
    const entries = await search(query.slice(0, 200), kind, limit);
    const results = entries
      .map((e) => ({ e, s: score(query, e) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(({ e, s }) => ({
        id: `${e.kind}/${e.id}`,
        name: e.label,
        score: s,
        match: false,
        type: TYPES.filter((t) => t.id === e.kind),
        ...(e.variants.length ? { description: e.variants.slice(0, 3).join(" · ") } : {}),
      }));
    // A sure match: the only exact one (OpenRefine then links it without asking).
    const exact = results.filter((r) => r.score === 100);
    if (exact.length === 1) exact[0].match = true;
    out[key] = { result: results };
  }
  return out;
}

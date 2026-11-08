/**
 * Cataloguers' decisions on Work groups (Phase 13 S11): "these two records are the same Work" or "they are
 * not" (which is how a group is taken apart). Kept in the kv store as one list; the OPAC and the review queue
 * read it and src/services/workClustering.ts applies it, so a person's decision always wins over a score.
 * No imports: the tests run it in Node.
 */
export interface WorkDecision { a: string; b: string; verdict: "same" | "different"; by?: string; at?: string }
export const DECISIONS_KEY = "work-cluster-decisions";
export const MAX_DECISIONS = 20000;

const ID = /^[\w.:\-]{1,200}$/;

/** The list after one decision: a new one replaces any earlier decision on the same two records; "clear" removes it. */
export function applyDecision(list: WorkDecision[], input: any, by: string, at: string): { list: WorkDecision[]; error?: string } {
  const a = String(input?.a ?? ""), b = String(input?.b ?? ""), verdict = String(input?.verdict ?? "");
  if (!ID.test(a) || !ID.test(b) || a === b) return { list, error: "a and b must be two different record ids" };
  if (!["same", "different", "clear"].includes(verdict)) return { list, error: "verdict must be same, different or clear" };
  const rest = list.filter((d) => !((d.a === a && d.b === b) || (d.a === b && d.b === a)));
  if (verdict === "clear") return { list: rest };
  if (rest.length >= MAX_DECISIONS) return { list, error: "Too many decisions stored" };
  return { list: [...rest, { a, b, verdict: verdict as WorkDecision["verdict"], by, at }] };
}

export function parseDecisions(raw: unknown): WorkDecision[] {
  const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  return Array.isArray(v) ? v.filter((d: any) => d && typeof d.a === "string" && typeof d.b === "string" && (d.verdict === "same" || d.verdict === "different")) : [];
}

// OPAC visitor counts. A visitor is counted once a day per page they open, under a key made from their
// address and browser that cannot be turned back into either and changes every day, so no visitor can be
// followed from one day to the next. Robots and signed-in staff are not counted.

export const VISIT_KINDS = ["home", "search", "work", "person", "subject", "hub", "place", "authors", "subjects"] as const;
export type VisitKind = typeof VISIT_KINDS[number];

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|httpclient|okhttp|java\//i;
export const isBot = (userAgent: string) => !userAgent || BOTS.test(userAgent);

/** The page a visit is to, from the OPAC's report, or null when the report is not one. */
export function visitFrom(body: unknown): { kind: VisitKind; ref: string; path: string } | null {
  const b = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const kind = String(b.kind ?? "") as VisitKind;
  if (!VISIT_KINDS.includes(kind)) return null;
  let ref = typeof b.ref === "string" ? b.ref.normalize("NFC").trim() : "";
  if (kind === "search") ref = ref.toLowerCase().replace(/\s+/g, " ");
  ref = ref.slice(0, 200);
  if (["home", "authors", "subjects"].includes(kind)) ref = "";
  else if (!ref) return null;
  return { kind, ref, path: `${kind}|${ref}` };
}

/** The day in Baghdad, as YYYY-MM-DD. */
export const visitDay = (now = new Date()) => new Date(now.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

/** One visitor's key for one day: a hash of address, browser, day and a server secret. */
export async function visitorKey(ip: string, userAgent: string, day: string, secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${day}|${ip}|${userAgent}|${secret}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash.slice(0, 16), (x) => x.toString(16).padStart(2, "0")).join("");
}

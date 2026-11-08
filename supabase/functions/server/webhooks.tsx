/**
 * Webhooks on save (Phase 13 S19): another system (a discovery layer, a union catalogue, a cache) gives Moon
 * an address, and Moon POSTs a small JSON message there whenever a record is saved, published or returned.
 * Each message is signed (X-Moon-Signature: sha256=HMAC of the body with the hook's secret, as GitHub signs
 * its webhooks), so the receiver can check it came from Moon. Only https addresses on the public internet are
 * accepted. The Super Admin adds and removes hooks; the secret is shown once.
 * No imports: index.tsx stores the hooks; the tests run it in Node.
 */

export type HookEvent = "record.saved" | "record.published" | "record.returned";
export const EVENTS: HookEvent[] = ["record.saved", "record.published", "record.returned"];
export interface Webhook { id: string; url: string; secret: string; events: HookEvent[]; by: string; at: string }
export const HOOKS_KEY = "webhooks";
export const MAX_HOOKS = 10;

/** Why an address cannot be a webhook, if it cannot: https only, no private, local or metadata addresses. */
export function hookUrlProblem(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "Not an address"; }
  if (u.protocol !== "https:") return "Only https addresses";
  if (u.username || u.password) return "No user name or password in the address";
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") && !h.includes(":")) return "Not a public address";
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return "Not a public address";
  }
  if (h.includes(":") && (h === "::1" || /^(fc|fd|fe80)/.test(h) || h.startsWith("::ffff:"))) return "Not a public address";
  if (raw.length > 500) return "The address is too long";
  return null;
}

/** The message for one event. */
export function hookPayload(event: HookEvent, record: { id: string; title?: string; version?: number; status?: string }, base: string, at: string) {
  return {
    event,
    at,
    record: {
      id: record.id,
      ...(record.title ? { title: record.title } : {}),
      ...(record.version !== undefined ? { version: record.version } : {}),
      ...(record.status ? { status: record.status } : {}),
      uri: `${base}/instance/${record.id}`,
      jsonld: `${base}/instance/${record.id}.jsonld`,
    },
  };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** sha256=<hex HMAC of the body>, the X-Moon-Signature header. */
export async function sign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `sha256=${hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))}`;
}

export function newSecret(): string {
  return hex(crypto.getRandomValues(new Uint8Array(24)).buffer);
}

/** Sends the event to every hook that wants it; never throws. Returns each hook's HTTP status (0 = failed). */
export async function deliver(
  hooks: Webhook[], event: HookEvent, payload: unknown,
  send: (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ status: number }> = fetch as any,
): Promise<Array<{ id: string; status: number }>> {
  const body = JSON.stringify(payload);
  return Promise.all(hooks.filter((h) => h.events.includes(event) && !hookUrlProblem(h.url)).map(async (h) => {
    try {
      const res = await send(h.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "Moon-Webhook/1", "X-Moon-Event": event, "X-Moon-Signature": await sign(h.secret, body) },
        body,
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? (AbortSignal as any).timeout(5000) : undefined,
      });
      return { id: h.id, status: res.status };
    } catch {
      return { id: h.id, status: 0 };
    }
  }));
}

/** Hooks as the Super Admin's list shows them: the secret is never sent back. */
export const publicHook = ({ secret: _s, ...rest }: Webhook) => rest;

export function parseHooks(raw: unknown): Webhook[] {
  const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  return Array.isArray(v) ? v.filter((h: any) => h && typeof h.url === "string" && typeof h.secret === "string" && Array.isArray(h.events)) : [];
}

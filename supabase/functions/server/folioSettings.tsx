/**
 * The library's FOLIO connection, entered by the Super Admin in Moon (gateway address, tenant, account,
 * password). The password is sealed with AES-GCM under a key derived from a server-only secret before it is
 * stored, and is never sent back to a browser. Secrets set on the server (MOON_FOLIO_*) still win.
 */

export interface FolioSettings { url: string; tenant: string; username: string; uiUrl?: string; sealedPassword?: string; updatedBy?: string; updatedAt?: string }

/** What is wrong with the connection details as typed. */
export function settingsProblems(s: { url?: string; tenant?: string; username?: string; uiUrl?: string }): string[] {
  const out: string[] = [];
  let u: URL | null = null;
  try { u = new URL(String(s.url || "")); } catch { /* reported below */ }
  if (!u || u.protocol !== "https:") out.push("The FOLIO address must be an https:// link (the Okapi or Kong gateway).");
  else if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/.test(u.hostname)) out.push("The FOLIO address must be on the internet, not a private address.");
  if (!/^[a-z0-9_]{1,64}$/i.test(String(s.tenant || ""))) out.push("The tenant is letters, digits or _ (for example: diku, fs00001000).");
  if (!String(s.username || "").trim() || String(s.username).length > 200) out.push("The FOLIO username is required.");
  if (s.uiUrl) { try { if (new URL(s.uiUrl).protocol !== "https:") out.push("The FOLIO web address must be https://."); } catch { out.push("The FOLIO web address is not a link."); } }
  return out;
}

async function keyFrom(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`moon-folio|${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** The password, sealed: base64 of a fresh 12-byte nonce + the AES-GCM ciphertext. */
export async function seal(password: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(secret), new TextEncoder().encode(password)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64(out);
}

export async function unseal(sealed: string, secret: string): Promise<string> {
  const all = unb64(sealed);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, await keyFrom(secret), all.slice(12));
  return new TextDecoder().decode(pt);
}

/** The settings as a browser may see them: everything but the password. */
export const publicSettings = (s: FolioSettings | null) =>
  s ? { url: s.url, tenant: s.tenant, username: s.username, uiUrl: s.uiUrl || "", hasPassword: !!s.sealedPassword, updatedBy: s.updatedBy, updatedAt: s.updatedAt } : null;

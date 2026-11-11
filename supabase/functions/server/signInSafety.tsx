// 🔐 Safe sign-in (Phase 15, wave 1): the rules, kept apart from the routes so the tests can run them.
//
// 1. Passwords are stored with PBKDF2-HMAC-SHA256 (600,000 rounds, a random salt per account), not one
//    round of SHA-256. An account saved the old way still signs in, and is saved the new way when it does.
// 2. Wrong tries are counted: 5 wrong passwords for one account from one address locks that pair for
//    15 minutes; 50 for one account from anywhere, or 30 from one address, locks for 15 minutes too.
//    (The pair rule comes first so a stranger cannot easily lock a cataloguer out of their own account.)
// 3. Invite codes live in the database, made by the Super Admin, with a number of uses and an end date.
//    Only a hash of each code is kept; the code itself is shown once, when it is made.

const enc = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(text: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text))));
}

export function randomHex(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return hex(buf);
}

/** Compares two strings without stopping at the first different character. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── Passwords ───────────────────────────────────────────────

export const PASSWORD_KDF = "pbkdf2-sha256";
export const PASSWORD_ITERATIONS = 600_000;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

export interface PasswordRecord {
  passwordHash: string;
  salt: string;
  /** Missing on accounts saved before this change: one round of SHA-256 over "salt:password". */
  kdf?: string;
  iterations?: number;
}

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
  return hex(new Uint8Array(bits));
}

/** The fields to store for a new or changed password. */
export async function hashPassword(password: string, iterations = PASSWORD_ITERATIONS): Promise<Required<PasswordRecord>> {
  const salt = randomHex(16);
  return { passwordHash: await pbkdf2(password, salt, iterations), salt, kdf: PASSWORD_KDF, iterations };
}

/**
 * Checks a password against what is stored. `upgrade` is true when it is right but stored the old way
 * (or with fewer rounds than today), so the caller saves it again with hashPassword().
 */
export async function verifyPassword(password: string, stored: PasswordRecord): Promise<{ ok: boolean; upgrade: boolean }> {
  if (!stored?.passwordHash || !stored.salt) return { ok: false, upgrade: false };
  if (stored.kdf === PASSWORD_KDF && stored.iterations) {
    const ok = safeEqual(await pbkdf2(password, stored.salt, stored.iterations), stored.passwordHash);
    return { ok, upgrade: ok && stored.iterations < PASSWORD_ITERATIONS };
  }
  if (stored.kdf) return { ok: false, upgrade: false }; // a method this code does not know
  const ok = safeEqual(await sha256Hex(`${stored.salt}:${password}`), stored.passwordHash);
  return { ok, upgrade: ok };
}

// ─── Wrong tries ─────────────────────────────────────────────

export const TRY_WINDOW_MS = 15 * 60_000;
export const LOCK_MS = 15 * 60_000;
export const LIMITS = { pair: 5, account: 50, address: 30 } as const;
export type TryScope = keyof typeof LIMITS;

export interface TryState {
  /** Wrong tries in the current window. */
  count: number;
  /** When the current window started (ms). */
  since: number;
  /** Locked until this time (ms), when the limit was reached. */
  lockedUntil?: number;
}

/** Milliseconds left on a lock; 0 when not locked. */
export function lockedFor(state: TryState | null | undefined, now: number): number {
  return state?.lockedUntil && state.lockedUntil > now ? state.lockedUntil - now : 0;
}

/** The state after one more wrong try. Reaching the limit locks for LOCK_MS and starts a fresh count. */
export function afterWrongTry(state: TryState | null | undefined, limit: number, now: number): TryState {
  const fresh = !state || now - state.since >= TRY_WINDOW_MS || lockedFor(state, now) > 0 || (state.lockedUntil !== undefined && state.lockedUntil <= now);
  const count = fresh ? 1 : state!.count + 1;
  const since = fresh ? now : state!.since;
  return count >= limit ? { count: 0, since: now, lockedUntil: now + LOCK_MS } : { count, since };
}

/** KV keys for the three counters. Names and addresses are hashed, so the store holds neither. */
export async function tryKeys(identifier: string, address: string): Promise<Record<TryScope, string>> {
  const id = identifier.trim().toLowerCase();
  const [pair, account, addr] = await Promise.all([sha256Hex(`${id}\n${address}`), sha256Hex(id), sha256Hex(address)]);
  return { pair: `moon:tries:pair:${pair}`, account: `moon:tries:account:${account}`, address: `moon:tries:address:${addr}` };
}

/** "Too many wrong tries. Try again in 12 minutes." */
export function lockMessage(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** The caller's address as the platform reports it (first entry of X-Forwarded-For). */
export function clientAddress(header: string | undefined | null): string {
  const first = (header || "").split(",")[0].trim();
  return first && first.length <= 64 ? first : "unknown";
}

// ─── Invite codes ────────────────────────────────────────────

export interface InviteCode {
  /** Short id shown in the list (not the code). */
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
  /** No more uses after this time; missing = no end date. */
  expiresAt?: string;
  maxUses: number;
  uses: number;
  usedBy: string[];
  revoked?: boolean;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O, 1/I/L or U, so it reads aloud safely

/** A new code, 16 characters shown as XXXX-XXXX-XXXX-XXXX (about 78 bits). */
export function newInviteCode(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const chars = Array.from(buf, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

/** A code as typed, made comparable: no spaces or dashes, upper case. */
export function normalizeInviteCode(code: string): string {
  return String(code || "").replace(/[\s\-_]/g, "").toUpperCase();
}

export async function inviteKey(code: string): Promise<string> {
  return `moon:invite:${await sha256Hex(normalizeInviteCode(code))}`;
}

/** Why a code cannot be used now, or null when it can. */
export function inviteProblem(invite: InviteCode | null | undefined, now: number): string | null {
  if (!invite) return "This invite code is not valid.";
  if (invite.revoked) return "This invite code was cancelled.";
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= now) return "This invite code has ended.";
  if (invite.uses >= invite.maxUses) return "This invite code has been used up.";
  return null;
}

/** The code after one person used it. */
export function useInvite(invite: InviteCode, username: string): InviteCode {
  return { ...invite, uses: invite.uses + 1, usedBy: [...invite.usedBy, username].slice(-200) };
}

/** What the Super Admin's list shows: never the code or its hash. */
export function invitePublic(invite: InviteCode, now: number) {
  return { ...invite, usable: inviteProblem(invite, now) === null };
}

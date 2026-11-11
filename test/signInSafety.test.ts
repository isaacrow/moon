import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, sha256Hex, PASSWORD_ITERATIONS, PASSWORD_KDF,
  afterWrongTry, lockedFor, lockMessage, tryKeys, clientAddress, LIMITS, LOCK_MS, TRY_WINDOW_MS,
  newInviteCode, normalizeInviteCode, inviteKey, inviteProblem, useInvite, invitePublic, type InviteCode,
} from '../supabase/functions/server/signInSafety.tsx';

test('passwords are stored with PBKDF2 and a salt of their own', async () => {
  const a = await hashPassword('correct horse battery', 1000);
  const b = await hashPassword('correct horse battery', 1000);
  assert.equal(a.kdf, PASSWORD_KDF);
  assert.equal(a.passwordHash.length, 64);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.passwordHash, b.passwordHash, 'the same password never gives the same stored value');
  assert.deepEqual(await verifyPassword('correct horse battery', a), { ok: true, upgrade: true }); // 1000 rounds < today's
  assert.deepEqual(await verifyPassword('wrong', a), { ok: false, upgrade: false });
  assert.ok(PASSWORD_ITERATIONS >= 600_000);
});

test('a password stored at today\'s strength needs no upgrade', async () => {
  const rec = await hashPassword('كلمة سر عربية 123');
  assert.equal(rec.iterations, PASSWORD_ITERATIONS);
  assert.deepEqual(await verifyPassword('كلمة سر عربية 123', rec), { ok: true, upgrade: false });
});

test('an account saved the old way still signs in, and is marked for upgrade', async () => {
  const salt = 'abcd1234';
  const old = { salt, passwordHash: await sha256Hex(`${salt}:secret6`) };
  assert.deepEqual(await verifyPassword('secret6', old), { ok: true, upgrade: true });
  assert.deepEqual(await verifyPassword('secret7', old), { ok: false, upgrade: false });
  assert.deepEqual(await verifyPassword('x', { salt, passwordHash: old.passwordHash, kdf: 'something-else' }), { ok: false, upgrade: false });
  assert.deepEqual(await verifyPassword('x', { salt: '', passwordHash: '' }), { ok: false, upgrade: false });
});

test('five wrong tries lock for 15 minutes, then the count starts again', () => {
  const t0 = 1_000_000;
  let s = afterWrongTry(null, LIMITS.pair, t0);
  for (let i = 1; i < 4; i++) s = afterWrongTry(s, LIMITS.pair, t0 + i * 1000);
  assert.equal(s.count, 4);
  assert.equal(lockedFor(s, t0 + 5000), 0, 'four wrong tries: not locked yet');
  s = afterWrongTry(s, LIMITS.pair, t0 + 5000);
  assert.equal(lockedFor(s, t0 + 5000), LOCK_MS);
  assert.equal(lockedFor(s, t0 + 5000 + LOCK_MS), 0, 'the lock ends');
  // After the lock, one wrong try is one, not six.
  s = afterWrongTry(s, LIMITS.pair, t0 + 5000 + LOCK_MS + 1);
  assert.deepEqual([s.count, s.lockedUntil], [1, undefined]);
});

test('wrong tries spread over more than 15 minutes do not add up', () => {
  let s = afterWrongTry(null, LIMITS.pair, 0);
  for (let i = 1; i <= 10; i++) s = afterWrongTry(s, LIMITS.pair, i * (TRY_WINDOW_MS + 1));
  assert.equal(s.count, 1);
  assert.equal(lockedFor(s, 11 * TRY_WINDOW_MS), 0);
});

test('lock messages, counter keys and the caller\'s address', async () => {
  assert.equal(lockMessage(LOCK_MS), 'Too many wrong tries. Try again in 15 minutes.');
  assert.equal(lockMessage(20_000), 'Too many wrong tries. Try again in 1 minute.');
  const k = await tryKeys(' Mara ', '203.0.113.9');
  assert.deepEqual(k, await tryKeys('mara', '203.0.113.9'), 'the name is compared without case or spaces');
  assert.notEqual(k.pair, (await tryKeys('mara', '203.0.113.10')).pair);
  assert.ok(!JSON.stringify(k).includes('mara') && !JSON.stringify(k).includes('203.0'), 'neither the name nor the address is stored');
  assert.equal(clientAddress('203.0.113.9, 10.0.0.1'), '203.0.113.9');
  assert.equal(clientAddress(undefined), 'unknown');
  assert.equal(clientAddress('x'.repeat(100)), 'unknown');
});

test('invite codes: made at random, compared loosely, kept only as a hash', async () => {
  const code = newInviteCode();
  assert.match(code, /^[A-HJKMNP-TV-Z2-9]{4}(-[A-HJKMNP-TV-Z2-9]{4}){3}$/);
  assert.notEqual(code, newInviteCode());
  assert.equal(normalizeInviteCode(` ${code.toLowerCase().replace(/-/g, ' ')} `), code.replace(/-/g, ''));
  const key = await inviteKey(code);
  assert.equal(key, await inviteKey(code.toLowerCase()));
  assert.ok(!key.includes(code.replace(/-/g, '')));
});

test('an invite code stops working when used up, ended or cancelled', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const base: InviteCode = { id: 'ab12cd34', label: 'Karbala pilot', createdBy: 'isaac', createdAt: '2026-11-10T00:00:00Z', maxUses: 2, uses: 0, usedBy: [] };
  assert.equal(inviteProblem(null, now), 'This invite code is not valid.');
  assert.equal(inviteProblem(base, now), null);
  const once = useInvite(base, 'mara');
  assert.deepEqual([once.uses, once.usedBy], [1, ['mara']]);
  assert.equal(inviteProblem(useInvite(once, 'ali'), now), 'This invite code has been used up.');
  assert.equal(inviteProblem({ ...base, expiresAt: '2026-11-10T11:59:59Z' }, now), 'This invite code has ended.');
  assert.equal(inviteProblem({ ...base, expiresAt: '2026-11-11T00:00:00Z' }, now), null);
  assert.equal(inviteProblem({ ...base, revoked: true }, now), 'This invite code was cancelled.');
  assert.equal(invitePublic(base, now).usable, true);
});

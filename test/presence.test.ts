import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLastSeen, sortByPresence } from '../src/app/utils/presence.ts';

// Local time, so "yesterday" means the same calendar day wherever the tests run.
const now = new Date(2026, 10, 5, 15, 0).getTime();
const at = (d: Date) => d.toISOString();

test('never seen', () => {
  assert.equal(formatLastSeen(null, false, now), 'Never seen');
  assert.equal(formatLastSeen(undefined, true, now), 'لم يظهر بعد');
  assert.equal(formatLastSeen('not a date', false, now), 'Never seen');
});

test('minutes and hours ago', () => {
  assert.equal(formatLastSeen(at(new Date(now - 20_000)), false, now), 'Last seen just now');
  assert.equal(formatLastSeen(at(new Date(now - 5 * 60_000)), false, now), 'Last seen 5 minutes ago');
  assert.equal(formatLastSeen(at(new Date(now - 3 * 3_600_000)), false, now), 'Last seen 3 hours ago');
  assert.ok(formatLastSeen(at(new Date(now - 5 * 60_000)), true, now).startsWith('آخر ظهور: '));
});

test('yesterday with the time, older with the date', () => {
  assert.equal(formatLastSeen(at(new Date(2026, 10, 4, 14, 20)), false, now), 'Last seen yesterday 14:20');
  assert.match(formatLastSeen(at(new Date(2026, 10, 4, 14, 20)), true, now), /^آخر ظهور: أمس /);
  assert.equal(formatLastSeen(at(new Date(2026, 9, 28, 9, 5)), false, now), 'Last seen Oct 28 09:05');
  assert.equal(formatLastSeen(at(new Date(2025, 9, 28, 9, 5)), false, now), 'Last seen Oct 28, 2025 09:05');
});

test('online first, then most recently seen, never-seen last in their order', () => {
  const users = [
    { username: 'never1' },
    { username: 'old', lastSeenAt: at(new Date(now - 86_400_000)) },
    { username: 'live', lastSeenAt: at(new Date(now - 30_000)), online: true },
    { username: 'never2', lastSeenAt: null },
    { username: 'recent', lastSeenAt: at(new Date(now - 600_000)) },
  ];
  assert.deepEqual(sortByPresence(users).map(u => u.username), ['live', 'recent', 'old', 'never1', 'never2']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCursorMessage, toFraction, fromFraction, shouldSend, springStep, isSettled, cursorOpacity,
  SEND_GAP_MS, IDLE_FADE_MS,
} from '../src/app/utils/liveCursors.ts';
// @ts-ignore plain JS module from the Cloudflare Worker
import { parseClientMessage } from '../workers/resource-router/liveRoomCore.js';

test('a pointer is sent as a place inside the field, and lands on the same place on another screen', () => {
  // Mara's screen: the Title field is wide and near the top.
  const mine = { left: 100, top: 200, width: 600, height: 40 };
  const pos = toFraction(mine, 400, 210);
  assert.deepEqual(pos, { x: 0.5, y: 0.25 });
  // Ali's screen is narrower and scrolled: the same field is somewhere else, so the arrow follows it.
  const theirs = { left: 20, top: 640, width: 300, height: 52 };
  assert.deepEqual(fromFraction(theirs, pos.x, pos.y), { x: 170, y: 653 });
  // Outside the box is held to its edge; an empty box gives 0.
  assert.deepEqual(toFraction(mine, 50, 999), { x: 0, y: 1 });
  assert.deepEqual(toFraction({ left: 0, top: 0, width: 0, height: 0 }, 5, 5), { x: 0, y: 0 });
});

test('positions go out at most 20 times a second, and only when they change', () => {
  const p = { f: 'Work:title', x: 0.5, y: 0.5 };
  assert.equal(shouldSend(null, p, 1000), true);
  const last = { ...p, at: 1000 };
  assert.equal(shouldSend(last, { ...p, x: 0.6 }, 1000 + SEND_GAP_MS - 1), false);
  assert.equal(shouldSend(last, { ...p, x: 0.6 }, 1000 + SEND_GAP_MS), true);
  assert.equal(shouldSend(last, p, 5000), false); // not moved
  assert.equal(shouldSend(last, { ...p, f: 'Work:subject' }, 5000), true);
});

test('cursor messages move, hide and remove arrows', () => {
  let c = applyCursorMessage({}, { t: 'cursor', id: 'a', f: 'Work:title', x: 0.2, y: 0.4 }, 10);
  assert.deepEqual(c, { a: { f: 'Work:title', x: 0.2, y: 0.4, at: 10 } });
  c = applyCursorMessage(c, { t: 'cursor', id: 'b', f: 'editor', x: 2, y: -1 }, 11);
  assert.deepEqual(c.b, { f: 'editor', x: 1, y: 0, at: 11 });
  const same = applyCursorMessage(c, { t: 'join', peer: {} }, 12);
  assert.equal(same, c);
  c = applyCursorMessage(c, { t: 'hide', id: 'a' }, 13);
  assert.deepEqual(Object.keys(c), ['b']);
  c = applyCursorMessage(c, { t: 'leave', id: 'b' }, 14);
  assert.deepEqual(c, {});
  assert.equal(applyCursorMessage(c, { t: 'cursor', id: 'x', f: 'a', x: '1', y: 0 }, 15), c);
});

test('the room passes on "pointer left the editor"', () => {
  assert.deepEqual(parseClientMessage('{"t":"hide","extra":1}'), { t: 'hide' });
});

test('the arrow glides to where the pointer is and then stops', () => {
  let s = { x: 0, y: 0, vx: 0, vy: 0 };
  const seen: number[] = [];
  for (let i = 0; i < 120 && !isSettled(s, 300, 100); i++) {
    s = springStep(s, 300, 100, 16);
    seen.push(s.x);
  }
  assert.ok(isSettled(s, 300, 100), 'settles within two seconds');
  assert.ok(seen[0] > 0 && seen[0] < 100, 'starts gently, no jump');
  // A very slow frame (tab in the background) does not throw it far past the target.
  const slow = springStep({ x: 0, y: 0, vx: 0, vy: 0 }, 300, 100, 5000);
  assert.ok(slow.x <= 300 && slow.x > 0);
});

test('a pointer that has not moved for half a minute fades out', () => {
  assert.equal(cursorOpacity(0, IDLE_FADE_MS), 1);
  assert.equal(cursorOpacity(0, IDLE_FADE_MS + 1000), 0.5);
  assert.equal(cursorOpacity(0, IDLE_FADE_MS + 5000), 0);
});

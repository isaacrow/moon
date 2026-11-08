// Phase 13 S19: signed webhooks on save, to public https addresses only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { hookUrlProblem, hookPayload, sign, deliver, publicHook, parseHooks, type Webhook } from '../supabase/functions/server/webhooks.tsx';

test('only public https addresses', () => {
  assert.equal(hookUrlProblem('https://example.org/hooks/moon'), null);
  for (const bad of ['http://example.org/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.1.2.3/', 'https://192.168.1.1/', 'https://169.254.169.254/latest', 'https://172.20.0.1/', 'https://[::1]/', 'https://user:pw@example.org/', 'https://intranet/', 'https://db.internal/', 'not a url']) {
    assert.ok(hookUrlProblem(bad), bad);
  }
});

test('the signature is the HMAC-SHA256 of the body, as a receiver checks it', async () => {
  const body = JSON.stringify(hookPayload('record.published', { id: 'r1', title: 'المقدمة', version: 3 }, 'https://mooon.site/resource', '2026-11-08T00:00:00Z'));
  assert.equal(await sign('s3cret', body), `sha256=${createHmac('sha256', 's3cret').update(body).digest('hex')}`);
  assert.deepEqual(JSON.parse(body).record, { id: 'r1', title: 'المقدمة', version: 3, uri: 'https://mooon.site/resource/instance/r1', jsonld: 'https://mooon.site/resource/instance/r1.jsonld' });
});

test('delivery: only hooks that want the event, failures reported not thrown, secrets never listed', async () => {
  const hooks: Webhook[] = [
    { id: 'a', url: 'https://a.example/h', secret: 'x', events: ['record.published'], by: 'admin', at: 't' },
    { id: 'b', url: 'https://b.example/h', secret: 'y', events: ['record.saved'], by: 'admin', at: 't' },
    { id: 'c', url: 'https://c.example/h', secret: 'z', events: ['record.published'], by: 'admin', at: 't' },
  ];
  const sent: any[] = [];
  const out = await deliver(hooks, 'record.published', { hi: 1 }, async (url, init) => {
    sent.push({ url, headers: init.headers });
    if (url.startsWith('https://c.')) throw new Error('down');
    return { status: 204 };
  });
  assert.deepEqual(out, [{ id: 'a', status: 204 }, { id: 'c', status: 0 }]);
  assert.equal(sent[0].headers['X-Moon-Event'], 'record.published');
  assert.match(sent[0].headers['X-Moon-Signature'], /^sha256=[0-9a-f]{64}$/);
  assert.ok(!('secret' in publicHook(hooks[0])));
  assert.deepEqual(parseHooks('[{"url":"https://x"}]'), [], 'a hook without a secret is not used');
});

// The LC half of the label cache refresh (Phase 13 S19), run by the nightly GitHub workflow. id.loc.gov
// refuses the Moon server's shared addresses (429), so the runner reads LC's change feed and records itself,
// gently, and hands the labels to the server. Wikidata is refreshed by the server.
//   MOON_API=https://<project>.supabase.co/functions/v1/make-server-49c0e13c MOON_KEY=<anon key> MOON_JOB_TOKEN=… npx tsx scripts/label-cache-lc.mts
import { refreshLabels, type CachedLabels } from '../supabase/functions/server/labelCache.tsx';

const api = process.env.MOON_API!, key = process.env.MOON_KEY!, token = process.env.MOON_JOB_TOKEN!;
const headers = { Authorization: `Bearer ${key}`, 'X-Moon-Job-Token': token, 'Content-Type': 'application/json' };
const state = await (await fetch(`${api}/jobs/label-cache/lc`, { headers })).json() as { uris: string[]; cached: CachedLabels[]; since: string };
if (!Array.isArray(state.uris)) { console.error('Could not read the LC list:', state); process.exit(1); }

const failed: string[] = [];
const fetchJson = async (url: string): Promise<any> => {
  const https = url.replace(/^http:\/\/id\.loc\.gov\//, 'https://id.loc.gov/');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(https, { headers: { Accept: 'application/json', 'User-Agent': 'Moon/1 (https://mooon.site; catalogue label cache)' }, signal: AbortSignal.timeout(20_000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return [];
      if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, (Number(r.headers.get('retry-after')) || 5) * 1000)); continue; }
      failed.push(`${r.status} ${https}`);
      return null;
    } catch (e) { if (attempt === 2) failed.push(`${e} ${https}`); }
  }
  return null;
};
const result = await refreshLabels(state.uris, new Map(state.cached.map((r) => [r.uri, r])), { fetchJson, now: new Date(), since: state.since, sources: ['lc'], lcBatch: 2, lcPause: 500 });
const stored = await (await fetch(`${api}/jobs/label-cache/lc`, { method: 'POST', headers, body: JSON.stringify({ rows: result.rows, lcFeedRead: result.lcFeedRead }) })).json();
console.log(JSON.stringify({ lcAddresses: state.uris.length, fetched: result.rows.length, lcFeedPages: result.lcFeedRead, ...stored, failed: failed.slice(0, 5) }));

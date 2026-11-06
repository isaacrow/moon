// Phase 10, step 3: copying a person, place or subject from LC, Wikidata or VIAF into a Moon entity.
// The fixtures are real responses saved from id.loc.gov and Wikidata (Wikidata trimmed to the claims used).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  outsideRef, draftFromLc, draftFromWikidata, combineDrafts, fetchOutsideEntity, formFromDraft, mergeDraftIntoForm, SAME_AS_HOSTS,
} from '../src/services/entityImport';
import { emptyForm, formProblems, payloadFrom } from '../src/app/utils/entityForm';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/entity-import/${name}`, import.meta.url), 'utf8'));
const IBN_KHALDUN_LC = 'http://id.loc.gov/authorities/names/n50052785';

/** Answers like id.loc.gov and Wikidata would, from the fixtures; records which addresses were asked for. */
function stubFetch() {
  const asked: string[] = [];
  const fetchJson = async (url: string) => {
    asked.push(url);
    const lc = url.match(/id\.loc\.gov\/authorities\/(\w+)\/(\w+)\.json$/);
    if (lc) return fixture(`lc-${lc[1]}-${lc[2]}.json`);
    const u = new URL(url);
    if (u.searchParams.get('list') === 'search') {
      return { query: { search: u.searchParams.get('srsearch') === 'haswbstatement:P214=41841661' ? [{ title: 'Q9294' }] : [] } };
    }
    const ids = u.searchParams.get('ids') || '';
    if (u.searchParams.get('props') === 'labels') {
      const names: Record<string, string> = { Q4773904: 'anthropologist', Q201788: 'historian', Q16533: 'judge', Q18814623: 'autobiographer' };
      return { entities: Object.fromEntries(ids.split('|').map((q) => [q, { labels: names[q] ? { en: { value: names[q] } } : {} }])) };
    }
    return fixture(`wd-${ids}.json`);
  };
  return { fetchJson, asked };
}

test('LC, Wikidata and VIAF addresses are recognized in every common form', () => {
  assert.deepEqual(outsideRef('https://www.wikidata.org/wiki/Q9294'), { source: 'wikidata', id: 'Q9294', uri: 'http://www.wikidata.org/entity/Q9294' });
  assert.equal(outsideRef('https://id.loc.gov/authorities/names/n50052785.html')?.uri, IBN_KHALDUN_LC);
  assert.equal(outsideRef('http://id.loc.gov/authorities/subjects/sh85100934')?.source, 'lc');
  assert.equal(outsideRef('https://viaf.org/viaf/41841661/')?.uri, 'http://viaf.org/viaf/41841661');
  assert.equal(outsideRef('https://example.org/person/1'), null);
});

test('an LC name record gives LC\'s authorized form, its variants (Arabic script too), dates and links', () => {
  const d = draftFromLc(fixture('lc-names-n50052785.json'), IBN_KHALDUN_LC);
  assert.equal(d.kind, 'agent');
  assert.equal(d.agentType, 'person');
  assert.equal(d.label, 'Ibn Khaldūn, 1332-1406');
  assert.ok(d.variants.includes('Ibn Chaldun, 1332-1406'));
  assert.ok(d.variants.some((v) => /[؀-ۿ]/.test(v)), 'LC\'s Arabic-script form is kept');
  assert.equal(d.details.birthDate, '1332-05-27');
  assert.equal(d.details.deathDate, '1406-03-17');
  for (const u of [IBN_KHALDUN_LC, 'http://viaf.org/viaf/41841661', 'http://www.wikidata.org/entity/Q9294', 'http://id.worldcat.org/fast/17753']) {
    assert.ok(d.sameAs.includes(u), `links ${u}`);
  }
  assert.ok(d.sameAs.every((u) => SAME_AS_HOSTS.test(u)), 'only links Moon\'s server accepts (no NDL, BnF …)');
});

test('LC subjects, places and corporate names get the right kind', () => {
  const topic = draftFromLc(fixture('lc-subjects-sh85100934.json'), 'http://id.loc.gov/authorities/subjects/sh85100934');
  assert.equal(topic.kind, 'topic');
  assert.equal(topic.label, 'Islamic philosophy');
  assert.equal(topic.details.source, 'http://id.loc.gov/authorities/subjects');
  assert.match(topic.details.broader, /sh85100864/);
  const place = draftFromLc(fixture('lc-names-n80006292.json'), 'http://id.loc.gov/authorities/names/n80006292');
  assert.equal(place.kind, 'place');
  assert.equal(place.label, 'Baghdad (Iraq)');
  assert.ok(place.variants.includes('بغداد (عراق)'));
  const corp = draftFromLc(fixture('lc-names-n94051820.json'), 'http://id.loc.gov/authorities/names/n94051820');
  assert.equal(corp.kind, 'agent');
  assert.equal(corp.agentType, 'organization');
});

test('a Wikidata item gives Arabic and English names, occupations, coordinates and every identifier', () => {
  const person = draftFromWikidata(fixture('wd-Q9294.json'), 'Q9294', { Q201788: 'historian' });
  assert.equal(person.kind, 'agent');
  assert.equal(person.label, 'Ibn Khaldun');
  assert.ok(person.variants.includes('ابن خلدون'));
  assert.equal(person.details.birthDate, '1332-05-27');
  assert.equal(person.details.occupation, 'historian');
  for (const u of [IBN_KHALDUN_LC, 'http://viaf.org/viaf/41841661', 'https://isni.org/isni/0000000121296275', 'http://id.worldcat.org/fast/17753']) {
    assert.ok(person.sameAs.includes(u), `links ${u}`);
  }
  assert.ok(!person.sameAs.some((u) => u.includes('9657158792863939040001')), 'withdrawn long VIAF numbers are left out');

  const place = draftFromWikidata(fixture('wd-Q1530.json'), 'Q1530');
  assert.equal(place.kind, 'place');
  assert.match(String(place.data.coordinates), /^33\.3\d+, 44\.3\d+$/);
  const topic = draftFromWikidata(fixture('wd-Q193104.json'), 'Q193104');
  assert.equal(topic.kind, 'topic');
  assert.ok(topic.sameAs.includes('http://id.loc.gov/authorities/subjects/sh85100934'));
});

test('copying from LC also reads the linked Wikidata item, and the two make one entity', async () => {
  const { fetchJson, asked } = stubFetch();
  const d = await fetchOutsideEntity('https://id.loc.gov/authorities/names/n50052785.html', { fetchJson });
  assert.deepEqual(d.sources, ['lc', 'wikidata']);
  assert.equal(d.label, 'Ibn Khaldūn, 1332-1406', 'LC\'s authorized form leads');
  assert.ok(d.variants.includes('ابن خلدون') && d.variants.includes('Ibn Khaldun'));
  assert.equal(d.details.birthDate, '1332-05-27');
  assert.match(d.details.occupation, /historian/);
  assert.ok(d.sameAs.includes('https://isni.org/isni/0000000121296275'));
  assert.ok(asked.some((u) => u.includes('wbgetentities') && u.includes('Q9294')));
});

test('copying from Wikidata or VIAF reaches the same person, with LC\'s form', async () => {
  const fromWd = await fetchOutsideEntity('https://www.wikidata.org/wiki/Q9294', { fetchJson: stubFetch().fetchJson });
  const fromViaf = await fetchOutsideEntity('https://viaf.org/viaf/41841661', { fetchJson: stubFetch().fetchJson });
  for (const d of [fromWd, fromViaf]) {
    assert.equal(d.label, 'Ibn Khaldūn, 1332-1406');
    assert.ok(d.sameAs.includes('http://viaf.org/viaf/41841661'));
  }
  assert.ok(fromViaf.sources.includes('viaf'));
  // A VIAF number no Wikidata item carries is still copied, as a name with its VIAF link.
  const bare = await fetchOutsideEntity('https://viaf.org/viaf/999', { fetchJson: stubFetch().fetchJson, fallbackLabel: 'Some name' });
  assert.deepEqual([bare.label, bare.sameAs], ['Some name', ['http://viaf.org/viaf/999']]);
  await assert.rejects(fetchOutsideEntity('https://viaf.org/viaf/999', { fetchJson: stubFetch().fetchJson }));
});

test('a copy fills a form that saves as it is, and merging never overwrites the cataloguer', async () => {
  const d = await fetchOutsideEntity(IBN_KHALDUN_LC, { fetchJson: stubFetch().fetchJson });
  const form = formFromDraft(d);
  assert.deepEqual(formProblems(form), []);
  const body = payloadFrom(form, d.data);
  assert.equal(body.data.agentType, 'person');
  assert.ok(body.variants.length > 5 && body.variants.length <= 50);
  assert.ok(body.sameAs.length <= 20);

  const mine = { ...emptyForm('agent'), label: 'ابن خلدون', note: 'My note', details: { birthDate: '1332' } };
  const merged = mergeDraftIntoForm(mine, d);
  assert.equal(merged.label, 'ابن خلدون');
  assert.equal(merged.note, 'My note');
  assert.equal(merged.details.birthDate, '1332', 'a filled detail is kept');
  assert.equal(merged.details.deathDate, '1406-03-17', 'an empty one is filled');
  assert.ok(merged.variants.split('\n').includes('Ibn Khaldūn, 1332-1406'));
  assert.ok(merged.sameAs.split('\n').includes(IBN_KHALDUN_LC));
});

test('the outside-link rule matches the server\'s', () => {
  const server = readFileSync(new URL('../supabase/functions/server/index.tsx', import.meta.url), 'utf8');
  const rule = server.match(/const SAME_AS_HOSTS = (\/.+\/);/)?.[1];
  assert.equal(rule, SAME_AS_HOSTS.toString());
});

test('combining keeps LC\'s kind and puts both sources\' links together', () => {
  const lc = draftFromLc(fixture('lc-subjects-sh85100934.json'), 'http://id.loc.gov/authorities/subjects/sh85100934');
  const wd = draftFromWikidata(fixture('wd-Q193104.json'), 'Q193104');
  const both = combineDrafts(lc, wd);
  assert.equal(both.kind, 'topic');
  assert.ok(both.variants.includes('فلسفة إسلامية'));
  assert.ok(both.sameAs.includes('http://www.wikidata.org/entity/Q193104'));
});

// Manuscript notes as events: an ijāzah, a samāʿ, ownership and waqf are stored on the copy as linked data,
// read back unchanged, summed up for custodial history, and exported to MARC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventToNode, nodeToEvent, summary, custodialHistory, eventsToMarc, type TransmissionEvent } from '../src/services/transmission';
import { copyToNode, nodeToCopy, hasCopyData } from '../src/services/itemCopies';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';

const ITEM = 'https://mooon.site/resource/item/ms1-a';
const IJAZAH: TransmissionEvent = {
  id: `${ITEM}#event-1`, kind: 'ijazah',
  participants: [
    { role: 'teacher', label: 'نصير الدين الطوسي', uri: 'http://www.wikidata.org/entity/Q298905' },
    { role: 'student', label: 'العلامة الحلي' },
  ],
  place: { label: 'بغداد', uri: 'http://id.loc.gov/authorities/names/n80006292' },
  date: 'رجب 670 هـ', locator: 'الورقة 120ب', text: 'أجزت له أن يروي عني هذا الكتاب',
};
const OWNED: TransmissionEvent = { id: `${ITEM}#event-2`, kind: 'ownership', participants: [{ role: 'owner', label: 'محمد باقر المجلسي' }], date: '1090 هـ' };
const WAQF: TransmissionEvent = { id: `${ITEM}#event-3`, kind: 'waqf', participants: [{ role: 'endower', label: 'السيد حسين' }, { role: 'beneficiary', label: 'طلبة العلم في النجف' }] };

test('an event is linked data and reads back the same', () => {
  const node = eventToNode(IJAZAH);
  assert.deepEqual(node['@type'], ['moon:TransmissionEvent', 'moon:Ijazah']);
  const teacher = node['moon:participant'][0];
  assert.equal(teacher['bf:agent']['@id'], 'http://www.wikidata.org/entity/Q298905');
  assert.equal(teacher['bf:role']['@id'], 'http://id.loc.gov/vocabulary/relators/tch');
  assert.equal(node['bf:place']['@id'], 'http://id.loc.gov/authorities/names/n80006292');
  assert.deepEqual(node['bf:date'][1], { '@value': '[1271,1272]', '@type': 'http://id.loc.gov/datatypes/edtf' }, 'the AH date read as its Gregorian years');
  assert.deepEqual(nodeToEvent(node), IJAZAH);
});

test('summaries say who did what, where and when, in both calendars', () => {
  assert.equal(summary(IJAZAH), 'إجازة من نصير الدين الطوسي لـ العلامة الحلي، بغداد، رجب 670 هـ (670 هـ / 1271–1272 م)، الورقة 120ب');
  assert.match(summary(IJAZAH, false), /^Ijāzah from نصير الدين الطوسي to العلامة الحلي/);
  assert.equal(summary(WAQF), 'وقفه السيد حسين على طلبة العلم في النجف');
  assert.equal(custodialHistory([IJAZAH, OWNED, WAQF]).split(' ؛ ').length, 2, 'ownership and waqf only');
});

test('a copy keeps its events, and an empty note is not saved', () => {
  const copy = { id: ITEM, library: 'مكتبة الروضة', location: '', shelfMark: 'MS 12', barcode: '', copyNumber: '', referenceOnly: true, note: '', events: [IJAZAH, OWNED, { id: `${ITEM}#e`, kind: 'sama' as const, participants: [{ role: 'reader' as const, label: '' }] }] };
  const node = copyToNode(copy, 'https://mooon.site/resource/instance/ms1');
  assert.equal(node['moon:transmission'].length, 2);
  assert.match(node['bf:custodialHistory'], /المجلسي/);
  const back = nodeToCopy(node);
  assert.deepEqual(back.events, [IJAZAH, OWNED]);
  assert.ok(hasCopyData({ ...back, library: '', shelfMark: '' }), 'a copy known only by its notes is still a copy');
});

test('MARC: 561 for ownership and waqf, 500 for the other notes, a 700 for each person with relator', () => {
  const f = eventsToMarc([IJAZAH, OWNED, WAQF]);
  assert.deepEqual(f.map((x) => x.tag), ['500', '561', '561', '700', '700', '700', '700', '700']);
  assert.match(f[0].subfields[0][1], /«أجزت له/);
  const tusi = f.find((x) => x.tag === '700' && x.subfields[0][1] === 'نصير الدين الطوسي')!;
  assert.deepEqual(tusi.subfields, [['a', 'نصير الدين الطوسي'], ['e', 'teacher.'], ['0', 'http://www.wikidata.org/entity/Q298905'], ['4', 'tch']]);
});

test('a record\'s MARC export carries the notes of its copies, in tag order', () => {
  const doc = { '@graph': [
    { '@id': 'https://mooon.site/resource/work/ms1', '@type': 'bf:Work', 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'تجريد الاعتقاد' } },
    { '@id': 'https://mooon.site/resource/instance/ms1', '@type': ['bf:Instance', 'bf:Manuscript'], 'bf:instanceOf': { '@id': 'https://mooon.site/resource/work/ms1' }, 'bf:title': { '@type': 'bf:Title', 'bf:mainTitle': 'تجريد الاعتقاد' } },
    copyToNode({ id: ITEM, library: 'مكتبة الروضة', location: '', shelfMark: '', barcode: '', copyNumber: '', referenceOnly: false, note: '', events: [IJAZAH, OWNED] }, 'https://mooon.site/resource/instance/ms1'),
  ] };
  const marc = bibframeToMarc(doc as any, { recordId: 'ms1' });
  const tags = marc.fields.map((f) => f.tag);
  assert.ok(tags.includes('561') && tags.includes('500') && tags.filter((t) => t === '700').length === 3);
  const sorted = tags.filter((t) => t !== '880');
  assert.deepEqual(sorted, [...sorted].sort(), 'fields stay in tag order');
});

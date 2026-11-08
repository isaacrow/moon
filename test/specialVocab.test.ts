// Phase 13 S24: maqām as SKOS concepts through bf:mode; ARM 1.0 markings, condition and binding on copies;
// item actions as small events, not notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAQAMAT, vocabDocument, maqamNode, maqamOf, withCondition, conditionOf, isBindingNote } from '../src/services/specialVocab';
import { copyToNode, nodeToCopy, emptyCopy } from '../src/services/itemCopies';

const BASE = 'https://mooon.site/resource';

test('maqām: concepts in a scheme, with families, used through bf:mode', () => {
  const doc = vocabDocument(BASE, 'maqam');
  const scheme = doc['@graph'][0];
  assert.equal(scheme['@type'], 'skos:ConceptScheme');
  assert.equal(scheme['skos:hasTopConcept'].length, MAQAMAT.filter((m) => !m.broader).length);
  const husayni = doc['@graph'].find((n: any) => n['@id'].endsWith('/maqam/husayni'));
  assert.deepEqual(husayni['skos:broader'], { '@id': `${BASE}/vocab/maqam/bayati` });
  assert.ok(husayni['skos:prefLabel'].some((l: any) => l['@language'] === 'ar-Latn-t-ar-m0-alaloc' && l['@value'] === 'Ḥusaynī'));
  assert.equal(vocabDocument(BASE, 'maqam', 'nope'), null);
  const work = { 'bf:mode': maqamNode(BASE, 'saba') };
  assert.equal(maqamOf(work)?.en, 'Saba');
  assert.equal(maqamOf({ 'bf:mode': { 'rdfs:label': 'بياتي' } })?.id, 'bayati', 'a label alone is recognised too');
});

test('a copy keeps its markings, condition, binding and actions through save and load', () => {
  const copy = {
    ...emptyCopy(`${BASE}/instance/m1`), library: 'مكتبة العتبة', note: 'نسخة جيدة',
    binding: 'جلد بني مذهّب، مع لسان', condition: 'أثر أرضة في الأوراق الأخيرة',
    marks: [{ kind: 'seal', text: 'ختم وقف المدرسة', place: 'ق 1أ' }, { kind: 'marginalia', text: 'حواشٍ بخط مغاير' }],
    actions: [{ kind: 'digitised', date: '2026-10-01', by: 'وحدة الرقمنة' }, { kind: 'retention-committed', date: '2026-11-01' }],
  };
  const node = copyToNode(copy as any, `${BASE}/instance/m1`);
  assert.deepEqual(node['arm:markedBy'][0]['@type'], ['arm:Seal', 'arm:Marking']);
  assert.equal(node['arm:hasPhysicalCondition']['@type'], 'arm:PhysicalCondition');
  assert.ok(node['bf:note'].some(isBindingNote));
  assert.equal(node['arm:hasItemHistory'][0]['arm:hasType']['@id'], `${BASE}/vocab/item-action/digitised`);
  const back = nodeToCopy(node);
  assert.equal(back.note, 'نسخة جيدة', 'the general note is not the binding');
  assert.deepEqual(conditionOf(node), { binding: copy.binding, condition: copy.condition, marks: copy.marks, actions: copy.actions });
  assert.deepEqual({ binding: back.binding, condition: back.condition, marks: back.marks, actions: back.actions }, { binding: copy.binding, condition: copy.condition, marks: copy.marks, actions: copy.actions });
});

test('nothing is written for an empty description', () => {
  assert.deepEqual(withCondition({ '@id': 'x' }, {}, BASE), { '@id': 'x' });
  assert.deepEqual(conditionOf({}), {});
});

test('the maqām picker shows on music records only', async () => {
  const { isMusic } = await import('../src/app/components/MaqamPanel');
  assert.ok(isMusic({ '@type': ['bf:Work', 'bf:NotatedMusic'] }));
  assert.ok(isMusic({ 'bf:content': { '@id': 'http://id.loc.gov/vocabulary/contentTypes/prm' } }));
  assert.ok(isMusic({ 'bf:genreForm': { 'rdfs:label': 'موسيقى عربية' } }));
  assert.ok(!isMusic({ '@type': 'bf:Text', 'bf:content': { '@id': 'http://id.loc.gov/vocabulary/contentTypes/txt' } }));
});

test('MARC export: 563 binding, 583 actions with the condition, 590 marks, each naming the copy', async () => {
  const { bibframeToMarc } = await import('../src/services/marc/bibframeToMarc');
  const item = copyToNode({ ...emptyCopy(`${BASE}/instance/m1`), shelfMark: 'MS 12', binding: 'جلد مذهّب', condition: 'أثر أرضة',
    marks: [{ kind: 'seal', text: 'ختم وقف', place: 'ق 1أ' }], actions: [{ kind: 'condition-reviewed', date: '2026-10-01', by: 'أمين المخطوطات' }] } as any, `${BASE}/instance/m1`);
  const doc = { '@graph': [{ '@id': 'w', '@type': 'bf:Work' }, { '@id': `${BASE}/instance/m1`, '@type': 'bf:Instance', 'bf:instanceOf': { '@id': 'w' }, 'bf:title': { 'bf:mainTitle': 'مخطوط' } }, item] };
  const f = bibframeToMarc(doc, { recordId: 'm1' }).fields;
  const sub = (tag: string) => f.filter((x: any) => x.tag === tag).map((x: any) => x.subfields);
  assert.deepEqual(sub('563'), [[['3', 'MS 12'], ['a', 'جلد مذهّب']]]);
  assert.deepEqual(sub('583'), [[['3', 'MS 12'], ['a', 'condition reviewed'], ['c', '2026-10-01'], ['k', 'أمين المخطوطات'], ['l', 'أثر أرضة']]]);
  assert.deepEqual(sub('590'), [[['3', 'MS 12'], ['a', 'Seal: ختم وقف (ق 1أ)']]]);
});

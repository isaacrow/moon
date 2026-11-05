import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyToNode, nodeToCopy, hasCopyData, newCopyId, emptyCopy, REFERENCE_ONLY } from '../src/services/itemCopies';

const inst = 'https://mooon.site/resource/instance/record-1';

test('a copy round-trips through its bf:Item node', () => {
  const copy = { id: 'https://mooon.site/resource/item/record-1-abc', library: 'مكتبة العتبة العباسية', location: 'القاعة الرئيسية', shelfMark: 'BP193.1 .A2 2020', barcode: '30001234', copyNumber: '2', referenceOnly: true, note: 'إهداء' };
  const node = copyToNode(copy, inst);
  assert.equal(node['@type'], 'bf:Item');
  assert.deepEqual(node['bf:itemOf'], { '@id': inst });
  assert.equal(node['bf:identifiedBy'][0]['@type'], 'bf:Barcode');
  assert.equal(node['bf:enumerationAndChronology']['rdfs:label'], 'c. 2');
  assert.equal(node['bf:usageAndAccessPolicy']['rdfs:label'], REFERENCE_ONLY);
  assert.deepEqual(nodeToCopy(node), copy);
});

test('empty fields are left out, and an empty Item is not a copy', () => {
  const node = copyToNode({ id: 'x', library: ' ', location: '', shelfMark: '', barcode: '', copyNumber: '', referenceOnly: false, note: '' }, inst);
  assert.deepEqual(Object.keys(node).sort(), ['@id', '@type', 'bf:itemOf']);
  assert.equal(hasCopyData(nodeToCopy(node)), false);
});

test('older and imported shapes are read too', () => {
  const c = nodeToCopy({ '@id': 'i', 'bf:heldBy': { '@id': 'http://id.loc.gov/vocabulary/organizations/dlc', 'rdfs:label': 'Library of Congress' }, shelfMark: 'PJ7800', barcode: '99', status: 'reference_only', 'bf:physicalLocation': 'Stacks' });
  assert.equal(c.library, 'Library of Congress');
  assert.equal(c.shelfMark, 'PJ7800');
  assert.equal(c.barcode, '99');
  assert.equal(c.location, 'Stacks');
  assert.equal(c.referenceOnly, true);
  assert.equal(nodeToCopy({ 'bf:shelfMark': [{ 'rdfs:label': { '@value': 'X1' } }] }).shelfMark, 'X1');
});

test('new copies get an item URI beside the instance and follow the previous copy', () => {
  assert.match(newCopyId(inst), /^https:\/\/mooon\.site\/resource\/item\/record-1-[a-z0-9]{1,6}$/);
  const next = emptyCopy(inst, { id: 'a', library: 'L', location: 'R', shelfMark: 'S', barcode: 'B', copyNumber: '1', referenceOnly: true, note: 'n' });
  assert.equal(next.library, 'L');
  assert.equal(next.shelfMark, 'S');
  assert.equal(next.copyNumber, '2');
  assert.equal(next.barcode, '');
  assert.equal(next.referenceOnly, false);
});

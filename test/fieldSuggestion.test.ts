// Phase 13 S4, "suggest a change": a suggestion starts from the field's text, and an accepted one goes back
// into the field in the shape it already had (language tag kept); a linked entity is left for a person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldText, withSuggested } from '../src/app/utils/fieldSuggestion';

test('the text a field holds now', () => {
  assert.equal(fieldText(undefined), '');
  assert.equal(fieldText('180 p.'), '180 p.');
  assert.equal(fieldText({ '@value': 'الوعد الحق', '@language': 'ar' }), 'الوعد الحق');
  assert.equal(fieldText(['one']), 'one');
  assert.equal(fieldText(['one', 'two']), null);
  assert.equal(fieldText({ '@id': 'https://mooon.site/resource/agent/x' }), null);
});

test('an accepted suggestion keeps the field\'s shape', () => {
  assert.equal(withSuggested('180 p.', '182 pages'), '182 pages');
  assert.equal(withSuggested(undefined, '182 pages'), '182 pages');
  assert.deepEqual(withSuggested({ '@value': 'old', '@language': 'ar' }, 'جديد'), { '@value': 'جديد', '@language': 'ar' });
  assert.deepEqual(withSuggested(['old'], 'new'), ['new']);
  assert.deepEqual(withSuggested([], 'new'), ['new']);
  assert.equal(withSuggested({ '@id': 'https://mooon.site/resource/agent/x' }, 'Someone'), null);
  assert.equal(withSuggested(['a', 'b'], 'c'), null);
});

// A tab from before a deploy asks for chunk files the deploy removed: those errors (Chrome, Firefox and
// Safari wording) trigger one reload; other errors still show the error screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStaleChunkError } from '../src/app/utils/staleChunkReload';

test('stale chunk errors are recognised in each browser wording', () => {
  assert.ok(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://mooon.site/assets/AuthorFinder-oJLtsEx6.js')));
  assert.ok(isStaleChunkError(new TypeError('error loading dynamically imported module: https://mooon.site/assets/x.js')));
  assert.ok(isStaleChunkError(new TypeError('Importing a module script failed.')));
  assert.ok(!isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'title')")));
  assert.ok(!isStaleChunkError(undefined));
});

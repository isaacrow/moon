// The Standard MARC Fields layout reads the same registry as Category Cards: same required fields (the
// profile's, i.e. the publish gate's), only real BIBFRAME properties, MARC tags kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPropertiesForDomain } from '../src/services/standardFields';
import { getPropertiesByDomain } from '../src/services/ontologyRegistry';
import { MONOGRAPH_PROFILE, profileRequired } from '../supabase/functions/server/profiles.tsx';
import { BF_OBJECT_PROPERTIES, BF_DATATYPE_PROPERTIES } from '../src/services/bibframeTerms.generated';

const BF = 'http://id.loc.gov/ontologies/bibframe/';

for (const entity of ['Work', 'Instance'] as const) {
  test(`${entity}: required fields match Category Cards and the publish gate`, () => {
    const fields = getPropertiesForDomain(`bf:${entity}`);
    assert.ok(fields.length > 5);
    const gate = profileRequired(MONOGRAPH_PROFILE, entity);
    const cards = new Set(getPropertiesByDomain(entity).filter((p) => p.required).map((p) => p.uri));
    for (const f of fields) {
      const short = `bf:${f.uri.slice(BF.length)}`;
      assert.equal(!!f.required, gate.has(short), `${short}: Standard says ${!!f.required}, the gate says ${gate.has(short)}`);
      assert.equal(!!f.required, cards.has(f.uri), `${short}: Standard and Category Cards disagree`);
    }
    // The gate's typed fields all appear (bf:instanceOf is built by Moon, not typed).
    for (const g of gate) if (g !== 'bf:instanceOf') assert.ok(fields.some((f) => f.uri === BF + g.slice(3)), `${g} missing from the Standard layout`);
  });
}

test('only real BIBFRAME properties, each with its MARC tags and a label', () => {
  for (const f of [...getPropertiesForDomain('bf:Work'), ...getPropertiesForDomain('bf:Instance')]) {
    const local = f.uri.slice(BF.length);
    assert.ok(f.uri.startsWith(BF) && (BF_OBJECT_PROPERTIES.has(local) || BF_DATATYPE_PROPERTIES.has(local)), `${f.uri} is not a BIBFRAME property`);
    assert.ok(f.marc.length > 0, `${local} has no MARC tags`);
    assert.ok(f.label, `${local} has no label`);
  }
  const title = getPropertiesForDomain('bf:Work').find((f) => f.uri === `${BF}title`)!;
  assert.deepEqual(title.marc, ['130', '240'], 'a Work title is the uniform title');
  assert.deepEqual(getPropertiesForDomain('bf:Instance').find((f) => f.uri === `${BF}title`)!.marc, ['245', '246'], 'an Instance title is the title proper');
  assert.equal(title.labelAr, 'العنوان');
});

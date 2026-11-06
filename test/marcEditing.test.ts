// MARC 21 cataloguing: the text cataloguers type is read in every common form, the checks point at the
// line to fix, and the record becomes BIBFRAME at once (and back to the same MARC).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarcText, marcToText, checkMarc, marcTextToBibframe, BOOK_TEMPLATE, fieldName } from '../src/services/marc/marcEditing';
import { bibframeToMarc } from '../src/services/marc/bibframeToMarc';
import { buildW3CJsonLd } from '../src/services/w3cJsonLdBuilder';
import { mintUriSet } from '../src/services/uriMintingService';

const TEXT = `LDR 00000nam\\a2200000\\i\\4500
008 961206s1995\\\\\\\\ua\\\\\\\\\\\\\\\\\\\\\\000\\1\\ara\\d
020 ## $a 9789770144084
100 1# $a حسين، طه، $d 1889-1973, $e author.
245 10 $a الوعد الحق / $c طه حسين.
264 #1 $a القاهرة : $b الهيئة المصرية العامة للكتاب, $c 1995.
300 ## $a 180 صفحة ; $c 20 سم
650 #0 $a Islam $x History $v Fiction.`;

test('reads the cataloguer form, MarcEdit lines and ‡ delimiters the same way', () => {
  const a = parseMarcText(TEXT);
  assert.deepEqual(a.issues, []);
  assert.equal(a.record.fields.length, 7);
  const f245: any = a.record.fields.find((f) => f.tag === '245');
  assert.deepEqual([f245.ind1, f245.ind2, f245.subfields], ['1', '0', [['a', 'الوعد الحق /'], ['c', 'طه حسين.']]]);
  const f264: any = a.record.fields.find((f) => f.tag === '264');
  assert.deepEqual([f264.ind1, f264.ind2], [' ', '1'], '# is a blank indicator');
  const marcEdit = parseMarcText('=245  10$aالوعد الحق /$cطه حسين.\n=264  \\1$aالقاهرة');
  assert.deepEqual((marcEdit.record.fields[0] as any).subfields, f245.subfields);
  assert.deepEqual([(marcEdit.record.fields[1] as any).ind1, (marcEdit.record.fields[1] as any).ind2], [' ', '1']);
  const dagger = parseMarcText('245 10 ‡a Title ‡b sub');
  assert.deepEqual((dagger.record.fields[0] as any).subfields, [['a', 'Title'], ['b', 'sub']]);
});

test('text → record → text is stable', () => {
  const { record } = parseMarcText(TEXT);
  const again = parseMarcText(marcToText(record)).record;
  assert.deepEqual(again, record);
});

test('checks name the line and the problem', () => {
  const p = parseMarcText('LDR 00000nam\\a2200000\\i\\4500\n24X 10 $a x\n100 1# $a A\n110 2# $a B\n245 00 $a\n245 10 $a Again\n650 #9x $a t\nhello');
  const all = [...p.issues, ...checkMarc(p.record, p.lineOf)];
  const has = (re: RegExp, line?: number) => all.some((i) => re.test(i.en) && (line === undefined || i.line === line));
  assert.ok(has(/must be three digits/, 2));
  assert.ok(has(/only once/, 6), 'second 245');
  assert.ok(has(/Only one main entry/));
  assert.ok(has(/two indicators/, 7));
  assert.ok(has(/Not a MARC field/, 8));
  assert.ok(has(/245 is empty/, 5));
  assert.ok(has(/first indicator is 1/, 5));
  const ok = parseMarcText(TEXT);
  assert.deepEqual(checkMarc(ok.record, ok.lineOf).filter((i) => i.level === 'error'), []);
  const noTitle = parseMarcText('100 1# $a X');
  assert.ok(checkMarc(noTitle.record).some((i) => i.tag === '245' && i.level === 'error'));
});

test('MARC becomes BIBFRAME at once, and the BIBFRAME gives the same MARC back', () => {
  const { bibframe, issues } = marcTextToBibframe(TEXT);
  assert.deepEqual(issues.filter((i) => i.level === 'error'), []);
  assert.ok(bibframe);
  const uriSet = mintUriSet('marcedit1');
  const graph = buildW3CJsonLd({ workData: bibframe!.work, instanceData: bibframe!.instance, uriSet: uriSet as any });
  const back = bibframeToMarc(graph as any, { recordId: 'marcedit1' });
  const sub = (tag: string, code: string) => ((back.fields.find((f) => f.tag === tag) as any)?.subfields || []).find(([c]: string[]) => c === code)?.[1];
  assert.match(sub('245', 'a') || '', /الوعد الحق/);
  assert.match(sub('100', 'a') || '', /حسين، طه/);
  assert.equal(sub('020', 'a'), '9789770144084');
  assert.match(sub('264', 'b') || '', /الهيئة المصرية العامة للكتاب/);
});

test('the book template is valid to start from, and fields have names', () => {
  const p = parseMarcText(BOOK_TEMPLATE);
  assert.deepEqual(p.issues, []);
  assert.ok(p.record.fields.some((f) => f.tag === '336'));
  assert.ok(checkMarc(p.record).some((i) => i.tag === '245' && i.level === 'error'), 'an empty template title (only ISBD punctuation) is not a title');
  assert.equal(fieldName('245', false), 'Title statement');
  assert.equal(fieldName('245', true), 'بيان العنوان');
});

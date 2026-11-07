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

// Records pasted from other catalogues (the Gilgamesh record that showed "13 to fix"), each layout read the same.
const sub = (p: ReturnType<typeof parseMarcText>, tag: string) => (p.record.fields.find((f) => f.tag === tag) as any);
test('reads records pasted from the Library of Congress, Alma and OCLC Connexion', () => {
  const lc = parseMarcText([
    '000\t03106cam a2200505 i 4500',
    '020\t  |a 9781786562159',
    '100\t1 |a Jastrow, Morris, |c Jr., |d 1861-1921, |e translator.',
    '245\t14 |a The epic of Gilgamesh / |c translated by Morris Jastrow.',
    '650\t 0 |a Epic poetry, Assyro-Babylonian |v Translations into English.',
  ].join('\n'));
  assert.deepEqual(lc.issues.filter((i) => i.level === 'error'), []);
  assert.equal(lc.record.leader, '03106cam a2200505 i 4500');
  assert.deepEqual(sub(lc, '245').subfields, [['a', 'The epic of Gilgamesh /'], ['c', 'translated by Morris Jastrow.']]);
  assert.deepEqual([sub(lc, '650').ind1, sub(lc, '650').ind2], [' ', '0']);
  assert.deepEqual([sub(lc, '245').ind1, sub(lc, '245').ind2], ['1', '4']);

  const alma = parseMarcText('245 1 4 $$a The epic of Gilgamesh / $$c translated by Morris Jastrow.');
  assert.deepEqual(alma.issues, []);
  assert.deepEqual(sub(alma, '245').subfields, sub(lc, '245').subfields);
  assert.deepEqual([sub(alma, '245').ind1, sub(alma, '245').ind2], ['1', '4']);

  const oclc = parseMarcText('245 14 The epic of Gilgamesh / ǂc translated by Morris Jastrow.\n650  0 Epic poetry, Assyro-Babylonian ǂv Translations into English.');
  assert.deepEqual(oclc.issues, []);
  assert.deepEqual(sub(oclc, '245').subfields, sub(lc, '245').subfields, 'the first subfield is $a without its code');
  assert.deepEqual([sub(oclc, '650').ind1, sub(oclc, '650').ind2], [' ', '0'], 'a blank first indicator is kept');
});

test('a field that ran onto the next line is joined to it; other stray text is still an error', () => {
  const p = parseMarcText('500 ## $a Originally published in 1898 as part of\n    The religion of Babylonia and Assyria.\n650 #0 $a Babylonia\n$x History $v Sources.\nhello');
  assert.equal(sub(p, '500').subfields[0][1], 'Originally published in 1898 as part of The religion of Babylonia and Assyria.');
  assert.deepEqual(sub(p, '650').subfields, [['a', 'Babylonia'], ['x', 'History'], ['v', 'Sources.']]);
  assert.equal(p.issues.filter((i) => i.level === 'warning').length, 2);
  assert.ok(p.issues.some((i) => i.level === 'error' && i.line === 5 && /Not a MARC field/.test(i.en)));
});

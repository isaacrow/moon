/**
 * ALA-LC romanization back to Arabic script (Phase 13 S9: transliteration both ways). LC's ScriptShifter
 * turns Arabic into ALA-LC; records copied from LC or OCLC, or MARC without its 880s, often hold only the
 * romanization ("Kitāb al-ʻibar"). This proposes the Arabic ("كتاب العبر") for a person to check: ALA-LC
 * writes the long vowels, the consonants and the article, so those come back exactly; short vowels are not
 * written in Arabic anyway; hamza seats and a few spellings (الرحمن، هذا) need the reader, so every
 * suggestion is shown for review and nothing is added unchecked.
 */

const DIGRAPHS: Array<[string, string]> = [['sh', 'ش'], ['th', 'ث'], ['kh', 'خ'], ['dh', 'ذ'], ['gh', 'غ']];
const LETTERS: Record<string, string> = {
  b: 'ب', t: 'ت', j: 'ج', ḥ: 'ح', d: 'د', r: 'ر', z: 'ز', s: 'س', ṣ: 'ص', ḍ: 'ض', ṭ: 'ط', ẓ: 'ظ',
  ʻ: 'ع', f: 'ف', q: 'ق', k: 'ك', l: 'ل', m: 'م', n: 'ن', h: 'ه', w: 'و', y: 'ي', p: 'پ', v: 'ڤ', g: 'گ', č: 'چ', ż: 'ذ',
};
/** Words Arabic spells otherwise than they sound (dagger alif, old spellings). */
const SPELLINGS: Record<string, string> = {
  'allāh': 'الله', 'al-raḥmān': 'الرحمن', 'raḥmān': 'رحمن', 'hādhā': 'هذا', 'hādhihi': 'هذه', 'dhālika': 'ذلك',
  'hāʼulāʼ': 'هؤلاء', 'lākin': 'لكن', 'lākinna': 'لكن', 'ilāh': 'إله', 'ibn': 'ابن', 'bint': 'بنت', 'ʻamr': 'عمرو',
  'ṭāhā': 'طه', 'yāsīn': 'يس', 'isḥāq': 'إسحاق', 'ismāʻīl': 'إسماعيل', 'ibrāhīm': 'إبراهيم', 'dāwūd': 'داود',
};
const VOWEL = /[aiuāīūáe o]/;

/** One word (no spaces, no prefixes) in Arabic script. */
function word(w: string): string {
  const known = SPELLINGS[w];
  if (known) return known;
  let s = w.replace(/[ʹ′]/g, '|'); // ALA-LC's prime separates letters that are not a digraph (adʹham)
  let out = '';
  let i = 0;
  // A word-initial vowel is written on alif.
  if (/^[aiuāīū]/.test(s)) {
    out += s[0] === 'ā' ? 'آ' : 'ا';
    i = 1;
  }
  while (i < s.length) {
    const c = s[i];
    const rest = s.slice(i);
    if (c === '|' || c === '-') { i++; continue; }
    // tāʾ marbūṭa: a final "ah" / "at" after a short a.
    if (/^a[ht]$/.test(rest) && i > 0 && !VOWEL.test(s[i - 1])) { out += 'ة'; break; }
    const di = DIGRAPHS.find(([d]) => rest.startsWith(d));
    if (di) {
      const letter = di[1];
      // A doubled digraph (shsh) is one letter with shadda.
      out += letter;
      i += 2;
      if (s.slice(i).startsWith(di[0])) i += 2;
      continue;
    }
    if (c === 'ʼ') {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';
      out += next === 'ū' || prev === 'u' ? 'ؤ' : next === 'ī' || prev === 'i' || next === 'i' ? 'ئ' : i === s.length - 1 || prev === 'ā' ? 'ء' : 'أ';
      i++;
      continue;
    }
    if (c === 'ā') { out += 'ا'; i++; continue; }
    if (c === 'á') { out += 'ى'; i++; continue; }
    if (c === 'ī') { out += 'ي'; i++; if (s[i] === 'y') i++; continue; }
    if (c === 'ū') { out += 'و'; i++; if (s[i] === 'w') i++; continue; }
    if (/[aiueo]/.test(c)) {
      // Short vowels are not written; "iyy" / "uww" are one long letter with shadda.
      if ((c === 'i' && s.slice(i + 1, i + 3) === 'yy') || (c === 'u' && s.slice(i + 1, i + 3) === 'ww')) { out += c === 'i' ? 'ي' : 'و'; i += 3; continue; }
      i++;
      continue;
    }
    const letter = LETTERS[c];
    if (letter) {
      out += letter;
      i++;
      // A doubled consonant is written once (with shadda, which Arabic usually leaves out).
      if (s[i] === c && !VOWEL.test(c)) i++;
      continue;
    }
    out += c; // digits, punctuation
    i++;
  }
  return out;
}

/** Inseparable prefixes ALA-LC joins with a hyphen: wa-, fa-, bi-, li-, ka-, and the article al-. */
function withPrefixes(w: string): string {
  let rest = w;
  let out = '';
  for (;;) {
    const m = rest.match(/^(wa|fa|bi|li|ka|la|sa)-(.+)$/);
    if (!m) break;
    out += { wa: 'و', fa: 'ف', bi: 'ب', li: 'ل', ka: 'ك', la: 'ل', sa: 'س' }[m[1]]!;
    rest = m[2];
  }
  // ALA-LC writes li- + al- as lil- and bi- + al- as bil- (rare): لل، بال.
  const lil = rest.match(/^(lil|bil)-(.+)$/);
  if (lil) return out + (lil[1] === 'lil' ? 'لل' : 'بال') + word(lil[2]);
  const art = rest.match(/^(al|el)-(.+)$/);
  if (art) {
    const known = SPELLINGS[`al-${art[2]}`];
    if (known) return out + known;
    // li- + al- is written لل (the alif drops).
    return out + (out.endsWith('ل') ? 'ل' : 'ال') + word(art[2]);
  }
  return out + word(rest);
}

/** The Arabic-script form of an ALA-LC romanization, for a person to check. */
export function toArabicScript(romanized: string): string {
  const text = String(romanized || '').normalize('NFC').toLowerCase()
    .replace(/[ʿ‘]/g, 'ʻ').replace(/[ʾ’']/g, 'ʼ');
  return text.split(/(\s+|[,.;:()[\]"«»/])/).map((part) => {
    if (!part || /^\s+$/.test(part)) return part;
    if (part === ',') return '،';
    if (part === ';') return '؛';
    if (/^[.:()[\]"«»/]$/.test(part)) return part;
    return withPrefixes(part);
  }).join('');
}

/** Whether a Latin text is ALA-LC romanization of Arabic (it carries ALA-LC's marks). */
export const looksAlaLc = (s: string) => /[āīūḥṣḍṭẓʻʼá]/i.test(s) && !/[؀-ۿ]/.test(s);

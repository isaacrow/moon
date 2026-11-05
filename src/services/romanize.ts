/**
 * Romanization of a record's Arabic-script names and titles, as LC catalogues them: each Arabic value
 * gets its ALA-LC romanization beside it on the same property ("القبسات" and "al-Qabasāt"), which the
 * export then tags "@ar-Arab" / "@ar-Latn" (see finishForExport in bibframeNormalizer).
 *
 * The romanization itself comes from LC's ScriptShifter (bibframe.org/scriptshifter), through Moon's
 * server proxy. Nothing changes until the cataloger reviews the suggestions and accepts them.
 */

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/;

/** The properties LC romanizes: titles, names and labels, statements, places and publishers — not notes or summaries. */
const ROMANIZED_KEYS = new Set([
  'mainTitle', 'subtitle', 'partName', 'partNumber', 'label', 'responsibilityStatement', 'editionStatement',
  'simplePlace', 'simpleAgent', 'seriesStatement', 'variantTitle',
]);
/** Free text that LC leaves in its own script (summaries, notes, contents), and controlled terms that carry
 *  their own URIs (language, role, content, carrier, genre, subject, classification …): never romanized. */
const SKIPPED_KEYS = new Set([
  'summary', 'note', 'tableOfContents', 'comment', 'adminMetadata', 'description',
  'language', 'role', 'content', 'media', 'carrier', 'genreForm', 'subject', 'classification', 'identifiedBy',
  'notation', 'intendedAudience', 'issuance', 'baseMaterial', 'colorContent', 'supplementaryContent', 'status',
  'relationship', 'relation', 'relatedTo', 'translationOf', 'hasInstance', 'instanceOf', 'hasItem', 'itemOf',
  'expressionOf', 'hasExpression', 'derivedFrom', 'source', 'geographicCoverage', 'originPlace',
]);
/** A plain label (rdfs:label) is romanized only when it names a title, an agent, a place, a publication or a series. */
const LABEL_PARENTS = new Set(['title', 'agent', 'place', 'provisionActivity', 'hasSeries', 'seriesStatement', 'variantTitle', 'contribution']);
const keyName = (k: string) => k.replace(/^.*[:#/]/, '');

export interface RomanizeCandidate {
  /** Where the value sits: keys and array indexes from the node down. */
  path: Array<string | number>;
  /** Which node it belongs to (work, instance …), for showing the cataloger. */
  node: string;
  field: string;
  arabic: string;
}

const textOf = (v: any): string | null =>
  typeof v === 'string' ? v : v && typeof v === 'object' && typeof v['@value'] === 'string' ? v['@value'] : null;

const isArabicOnly = (s: string) => ARABIC.test(s) && !LATIN.test(s);

/** Every Arabic-script value in the romanized properties that has no Latin partner yet. */
export function findRomanizable(node: any, nodeName: string): RomanizeCandidate[] {
  const out: RomanizeCandidate[] = [];
  const walk = (v: any, path: Array<string | number>, field: string | null, labelOk: boolean) => {
    if (Array.isArray(v)) {
      const hasLatinPartner = field && v.some((x) => { const t = textOf(x); return t !== null && LATIN.test(t) && !ARABIC.test(t); });
      v.forEach((x, i) => {
        const t = textOf(x);
        if (t !== null) {
          if (field && !hasLatinPartner && isArabicOnly(t.trim())) out.push({ path: [...path, i], node: nodeName, field, arabic: t.trim() });
        } else walk(x, [...path, i], field, labelOk);
      });
      return;
    }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('@')) continue;
      const name = keyName(k);
      if (SKIPPED_KEYS.has(name)) continue;
      const f = ROMANIZED_KEYS.has(name) && (name !== 'label' || labelOk) ? name : null;
      const t = textOf(x);
      if (t !== null) {
        if (f && isArabicOnly(t.trim())) out.push({ path: [...path, k], node: nodeName, field: name, arabic: t.trim() });
      } else walk(x, [...path, k], f, labelOk || LABEL_PARENTS.has(name));
    }
  };
  walk(node, [], null, false);
  return out;
}

/** The node with the romanization added beside the Arabic value (a single value becomes [Arabic, Latin]). */
export function addRomanization(node: any, path: Array<string | number>, latin: string): any {
  const clone = structuredClone(node);
  const latinValue = latin.trim();
  if (!latinValue || !path.length) return clone;
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  let parent: any = clone;
  for (const p of parentPath) parent = parent?.[p as any];
  if (!parent) return clone;
  if (typeof last === 'number' && Array.isArray(parent)) {
    if (!parent.some((x) => textOf(x) === latinValue)) parent.splice(last + 1, 0, latinValue);
  } else {
    const cur = parent[last];
    parent[last] = Array.isArray(cur) ? [...cur, latinValue] : [cur, latinValue];
  }
  return clone;
}

/** ALA-LC romanizations from LC's ScriptShifter, one per text (empty when the service has none). */
export async function romanizeAll(texts: string[], endpoint: string, headers: Record<string, string>): Promise<string[]> {
  const unique = [...new Set(texts)];
  const results = new Map<string, string>();
  // A few at a time, so a long record does not flood LC's service.
  for (let i = 0; i < unique.length; i += 4) {
    await Promise.all(unique.slice(i, i + 4).map(async (text) => {
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang: 'arabic', text, t_dir: 's2r', capitalize: 'first', options: {} }),
        });
        const d = r.ok ? await r.json() : null;
        results.set(text, typeof d?.output === 'string' ? d.output.trim() : '');
      } catch {
        results.set(text, '');
      }
    }));
  }
  return texts.map((t) => results.get(t) || '');
}

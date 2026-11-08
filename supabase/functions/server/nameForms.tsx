/**
 * Name forms by script (Phase 13 S10), as LC's PCC non-Latin preferred-variant work does: every form of an
 * agent's name carries a language/script tag, and a person (never a guess) marks the preferred form for each
 * script. The OPAC and the MARC export then use the Arabic-script form for a book in Arabic script, with
 * the ALA-LC romanization beside it (MARC 100 + 880), and the romanized form for other books.
 * Agent records keep only public facts about a person: private details are refused on save.
 * No imports, so the editor, the OPAC, the server and the tests all use it.
 */

export type NameScript = 'arabic' | 'latin';
export interface PreferredForms { arabic?: string; latin?: string }

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
/** ALA-LC romanization of Arabic shows itself by its letters: ā ī ū ḥ ṣ ḍ ṭ ẓ ʻ ʼ. */
const ALALC = /[āīūḥṣḍṭẓʻʼ]/i;

export const scriptOf = (form: string): NameScript => (ARABIC.test(form) ? 'arabic' : 'latin');

/** The BCP 47 tag of one form: "ar" (Arabic script), "ar-Latn-t-ar-m0-alaloc" (ALA-LC), else "und-Latn". */
export function formTag(form: string, lang = 'ar'): string {
  if (ARABIC.test(form)) return lang;
  return ALALC.test(form) ? `${lang}-Latn-t-${lang}-m0-alaloc` : 'und-Latn';
}

/** Every form of the name (heading first), each with its tag and whether it is the preferred one for its script. */
export function taggedForms(label: string, variants: string[], preferred: PreferredForms = {}, lang = 'ar') {
  const forms = [...new Set([label, ...variants].map((s) => String(s || '').trim()).filter(Boolean))];
  return forms.map((form) => {
    const script = scriptOf(form);
    return { form, script, tag: formTag(form, lang), preferred: preferred[script] === form };
  });
}

/** Keeps only preferred forms that are still among the entity's names and in the right script. */
export function cleanPreferred(raw: unknown, label: string, variants: string[]): PreferredForms {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const names = new Set([label, ...variants].map((s) => String(s || '').trim()));
  const out: PreferredForms = {};
  for (const script of ['arabic', 'latin'] as const) {
    const v = typeof p[script] === 'string' ? (p[script] as string).trim() : '';
    if (v && names.has(v) && scriptOf(v) === script) out[script] = v;
  }
  return out;
}

/** The form to show: the preferred one for the script the reader or the book is in, else the heading. */
export function displayName(label: string, preferred: PreferredForms | undefined, script: NameScript): string {
  return preferred?.[script] || label;
}

// ---- Private data ----

/** Details an agent record never keeps: contact details and identity documents are not authority data. */
const PRIVATE_KEY = /(e-?mail|phone|mobile|tel(ephone)?|whats-?app|address|street|postcode|zip|passport|national.?id|id.?card|ssn|social.?security|bank|iban|salary|password|religion|health|medical)/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;

/** The details without private keys or values that look like an e-mail address or a phone number; and what was removed. */
export function withoutPrivateData(data: Record<string, unknown>): { data: Record<string, unknown>; removed: string[] } {
  const out: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [k, v] of Object.entries(data || {})) {
    const s = typeof v === 'string' ? v : '';
    if (PRIVATE_KEY.test(k) || (s && (EMAIL.test(s) || (PHONE.test(s) && !/date|year|born|died|dates/i.test(k))))) { removed.push(k); continue; }
    out[k] = v;
  }
  return { data: out, removed };
}

// ---- Records ----

/** The script a record's Work is written in: Arabic for Arabic, Persian, Urdu, Ottoman Turkish …, else Latin. */
const ARABIC_SCRIPT_LANGS = /^(ara|per|fas|urd|ota|kur|ckb|pus|snd|uig|bal|kas|pan)$/;
export function bookScript(doc: { '@graph'?: any[] } | undefined): NameScript {
  const graph = Array.isArray(doc?.['@graph']) ? doc!['@graph']! : [];
  const list = (v: any) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  for (const n of graph) {
    if (!list(n?.['@type']).some((t: any) => /(^|\/|:)Work$/.test(String(t)))) continue;
    for (const l of list(n['bf:language'] ?? n['http://id.loc.gov/ontologies/bibframe/language'])) {
      const code = String(l?.['@id'] ?? l ?? '').replace(/\/+$/, '').split('/').pop() || '';
      if (ARABIC_SCRIPT_LANGS.test(code)) return 'arabic';
    }
  }
  return 'latin';
}

/**
 * The record with each linked agent named by its preferred forms. In a book in Arabic script, the agent
 * gets both forms (the export then writes the romanization in 100/700 and the Arabic in a linked 880, as LC
 * does); in other books, the preferred romanized form. Agents without preferred forms are left as they are.
 */
export function withPreferredNames<D extends { '@graph'?: any[] }>(doc: D, byUri: Map<string, PreferredForms>): D {
  const graph = Array.isArray(doc?.['@graph']) ? doc['@graph']! : [];
  if (!byUri.size || !graph.length) return doc;
  const script = bookScript(doc);
  const rename = (agent: any) => {
    const p = agent && typeof agent === 'object' ? byUri.get(String(agent['@id'] || '')) : undefined;
    if (!p || (!p.arabic && !p.latin)) return agent;
    const label = script === 'arabic' && p.arabic && p.latin
      ? [{ '@value': p.latin, '@language': 'ar-Latn' }, { '@value': p.arabic, '@language': 'ar-Arab' }]
      : script === 'arabic' ? (p.arabic || p.latin) : (p.latin || p.arabic);
    const { 'bflc:marcKey': _key, ...rest } = agent;
    return { ...rest, 'rdfs:label': label };
  };
  const fix = (node: any): any => {
    if (Array.isArray(node)) return node.map(fix);
    if (!node || typeof node !== 'object') return node;
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === 'bf:agent' || k === 'http://id.loc.gov/ontologies/bibframe/agent'
        ? (Array.isArray(v) ? v.map(rename) : rename(v))
        : fix(v);
    }
    return out;
  };
  // An agent can also be its own node in the graph, which contributions point at by @id.
  return { ...doc, '@graph': graph.map((n) => (byUri.has(String(n?.['@id'] || '')) && !n['bf:contribution'] ? rename(n) : fix(n))) };
}

/** The Moon entity URIs of a record's agents (mooon.site/resource/agent/…), to look their forms up. */
export function agentUris(doc: { '@graph'?: any[] } | undefined): string[] {
  const out = new Set<string>();
  JSON.stringify(doc?.['@graph'] || [], (_k, v) => {
    if (typeof v === 'string' && /\/resource\/agent\/[^/#\s]+$/.test(v)) out.add(v);
    return v;
  });
  return [...out];
}

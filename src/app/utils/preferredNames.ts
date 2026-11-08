/**
 * The preferred name forms (S10) of a record's linked agents, read from their Moon entities, so the MARC
 * shown, downloaded and sent to FOLIO, and the OPAC, name each person by the form a cataloguer chose for the
 * book's script. Cached per page; a failed lookup leaves the record as it is.
 */
import { useEffect, useMemo, useState } from 'react';
import { MOON_API, moonHeaders } from './moonApi';
import { agentUris, withPreferredNames, type PreferredForms } from '../../services/nameForms';

const cache = new Map<string, Promise<PreferredForms | null>>();

function formsOf(uri: string): Promise<PreferredForms | null> {
  if (!cache.has(uri)) {
    const id = uri.split('/').pop() || '';
    cache.set(uri, fetch(`${MOON_API}/authorities/${encodeURIComponent(id)}`, { headers: moonHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.authority?.data?.preferredForms;
        return p && (p.arabic || p.latin) ? { arabic: p.arabic, latin: p.latin } : null;
      })
      .catch(() => null));
  }
  return cache.get(uri)!;
}

/** Preferred forms by Moon entity URI, for the given URIs (only those that have some). */
export async function loadPreferredForms(uris: string[]): Promise<Map<string, PreferredForms>> {
  const found = await Promise.all(uris.slice(0, 40).map(async (u) => [u, await formsOf(u)] as const));
  return new Map(found.filter((x): x is readonly [string, PreferredForms] => !!x[1]));
}

export function usePreferredForms(uris: string[]): Map<string, PreferredForms> {
  const key = [...new Set(uris)].sort().join(' ');
  const [map, setMap] = useState<Map<string, PreferredForms>>(new Map());
  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    let live = true;
    loadPreferredForms(key.split(' ')).then((m) => { if (live) setMap(m); });
    return () => { live = false; };
  }, [key]);
  return map;
}

/** The record with its agents named by their preferred forms (the record itself until they are loaded). */
export function usePreferredNames<D extends { '@graph'?: any[] }>(doc: D | null | undefined): D | null | undefined {
  const uris = useMemo(() => (doc ? agentUris(doc) : []), [doc]);
  const forms = usePreferredForms(uris);
  return useMemo(() => (doc && forms.size ? withPreferredNames(doc, forms) : doc), [doc, forms]);
}

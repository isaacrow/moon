// Where an entity's outside link came from (Phase 13 S18), in plain words for the entity page:
// "Moon match 98% · accepted by isaac · 7 Nov 2026" / "Added by mara · 7 Nov 2026". Kept free of React.

export interface LinkSource {
  uri: string;
  addedBy: string;
  addedAt: string;
  method: 'person' | 'reconcile' | 'record' | 'import';
  confidence?: number | null;
  evidence?: string | null;
}

const when = (iso: string, ar: boolean) =>
  new Date(iso).toLocaleDateString(ar ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function describeLinkSource(s: LinkSource, ar: boolean): string {
  const pct = typeof s.confidence === 'number' ? `${Math.round(s.confidence * 100)}%` : '';
  const date = when(s.addedAt, ar);
  switch (s.method) {
    case 'reconcile':
      return ar ? `مطابقة مون ${pct} · قبلها ${s.addedBy} · ${date}` : `Moon match ${pct} · accepted by ${s.addedBy} · ${date}`;
    case 'import':
      return ar ? `من تقرير الاستيراد · ${s.addedBy} · ${date}` : `From an import report · ${s.addedBy} · ${date}`;
    case 'record':
      return ar ? `من تسجيلة · ${s.addedBy} · ${date}` : `From a record · ${s.addedBy} · ${date}`;
    default:
      return ar ? `أضافه ${s.addedBy} · ${date}` : `Added by ${s.addedBy} · ${date}`;
  }
}

/** The source of each of an entity's links; a link added before sources were kept has none ("earlier"). */
export function sourcesByLink(links: string[], sources: LinkSource[]): Array<{ uri: string; source: LinkSource | null }> {
  const by = new Map(sources.map((s) => [s.uri, s]));
  return links.map((uri) => ({ uri, source: by.get(uri) || null }));
}

/**
 * Authority-link report (Phase 7, after a MARC import): how many names and subjects of the imported records
 * reach LC / VIAF / Wikidata, how many only Moon's own entry, and the to-do list. "Find matches" searches
 * LC (Latin script), VIAF and Wikidata (any script); one click links Moon's entry to the match (owl:sameAs),
 * which fixes every record that uses it at once.
 */
import { useEffect, useState } from 'react';
import { Link2, Search, Check, ExternalLink } from 'lucide-react';
import { moonFetch } from '../../utils/moonApi';
import { searchLOCAuthorities, searchVIAF, searchWikidata, type AuthorityResult } from '../../../services/authoritySearch';

type Status = 'international' | 'moon-linked' | 'moon-only' | 'none';
interface Row { kind: 'agent' | 'place' | 'topic'; label: string; uri: string | null; entryId: string | null; status: Status; sameAs: string[]; records: { id: string; title: string }[] }
interface Report { records: number; headings: number; counts: Record<Status, number>; rows: Row[] }

const STATUS_TEXT: Record<Status, [string, string]> = {
  international: ['مرتبط بملف استناد دولي', 'Linked to LC / VIAF / Wikidata'],
  'moon-linked': ['مدخل مون مرتبط دولياً', 'Moon entry, linked internationally'],
  'moon-only': ['مدخل مون فقط', 'Moon entry only'],
  none: ['غير مرتبط', 'Not linked'],
};
const COLORS: Record<Status, string> = { international: 'bg-emerald-500', 'moon-linked': 'bg-emerald-300', 'moon-only': 'bg-amber-400', none: 'bg-rose-500' };

async function findMatches(row: Row): Promise<AuthorityResult[]> {
  const q = row.label;
  const [lc, viaf, wd] = await Promise.all([
    searchLOCAuthorities(q, row.kind === 'topic' ? 'subjects' : 'names'),
    row.kind === 'agent' ? searchVIAF(q) : Promise.resolve([]),
    searchWikidata(q),
  ]);
  return [...lc.slice(0, 3), ...viaf.slice(0, 3), ...wd.slice(0, 3)];
}

export function AuthorityReportPanel({ recordIds, rtl }: { recordIds: string[]; rtl: boolean }) {
  const t = (ar: string, en: string) => (rtl ? ar : en);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, AuthorityResult[] | 'loading'>>({});
  const [linked, setLinked] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    moonFetch<Report>('/authorities/report', { method: 'POST', body: { ids: recordIds } })
      .then((r) => { if (!live) return; if (r.ok) setReport(r.data); else setError((r.data as any)?.error || `HTTP ${r.status}`); })
      .catch((e) => live && setError(String(e)));
    return () => { live = false; };
  }, [recordIds.join(',')]);

  const keyOf = (r: Row) => r.uri || `${r.kind}|${r.label}`;
  const search = async (r: Row) => {
    const k = keyOf(r);
    setOpen(k);
    if (matches[k]) return;
    setMatches((m) => ({ ...m, [k]: 'loading' }));
    const found = await findMatches(r);
    setMatches((m) => ({ ...m, [k]: found }));
  };
  const link = async (r: Row, m: AuthorityResult) => {
    if (!r.entryId) return;
    const res = await moonFetch(`/authorities/${encodeURIComponent(r.entryId)}/same-as`, { method: 'POST', body: { uri: m.uri, method: 'import', evidence: 'Chosen from the authority report after a MARC import' } });
    if (res.ok) { setLinked((l) => ({ ...l, [keyOf(r)]: m.uri })); setOpen(null); }
    else setError((res.data as any)?.error || `HTTP ${res.status}`);
  };

  if (error) return <p className="text-xs text-red-600">{t('تعذّر إعداد تقرير الاستناد: ', 'Could not build the authority report: ')}{error}</p>;
  if (!report) return <p className="text-xs text-slate-500">{t('جارٍ فحص روابط الاستناد…', 'Checking authority links…')}</p>;
  const todo = report.rows.filter((r) => (r.status === 'moon-only' || r.status === 'none'));
  const total = Math.max(1, report.headings);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800" dir={rtl ? 'rtl' : 'ltr'}>
      <div className="mb-2 flex items-center gap-2 font-bold"><Link2 className="h-3.5 w-3.5" /> {t('روابط الاستناد', 'Authority links')} — {report.headings} {t('مدخلاً في', 'headings in')} {report.records} {t('تسجيلة', 'records')}</div>
      <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {(['international', 'moon-linked', 'moon-only', 'none'] as Status[]).map((s) => (
          <div key={s} className={COLORS[s]} style={{ width: `${(report.counts[s] / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mb-2 grid grid-cols-2 gap-1">
        {(['international', 'moon-linked', 'moon-only', 'none'] as Status[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5"><span className={`inline-block h-2 w-2 rounded-full ${COLORS[s]}`} />{t(...STATUS_TEXT[s])}: <b>{report.counts[s]}</b></li>
        ))}
      </ul>
      {todo.length === 0 ? <p className="text-emerald-700">{t('كل الأسماء والموضوعات مرتبطة.', 'Every name and subject is linked.')}</p> : (
        <>
          <p className="mb-1 text-slate-600">{t('للربط (الأكثر استعمالاً أولاً). ربط مدخل مون يصلح كل التسجيلات التي تستعمله.', 'To link (most used first). Linking a Moon entry fixes every record that uses it.')}</p>
          <ul className="max-h-64 space-y-1 overflow-auto">
            {todo.slice(0, 100).map((r) => {
              const k = keyOf(r);
              const done = linked[k];
              const m = matches[k];
              return (
                <li key={k} className="rounded border border-slate-100 p-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${done ? COLORS['moon-linked'] : COLORS[r.status]}`} />
                    <span className="flex-1 truncate" dir="auto" title={r.records.map((x) => x.title).join(' · ')}>{r.label}</span>
                    <span className="text-slate-400">{r.records.length}×</span>
                    {done ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" />{t('رُبط', 'Linked')}</span>
                      : r.entryId ? <button type="button" onClick={() => (open === k ? setOpen(null) : search(r))} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><Search className="h-3 w-3" />{t('ابحث عن مطابقات', 'Find matches')}</button>
                      : <span className="text-slate-400">{t('يُربط عند الحفظ التالي', 'Linked on next save')}</span>}
                  </div>
                  {open === k && (
                    <div className="mt-1 space-y-1 ps-4">
                      {m === 'loading' && <p className="text-slate-500">{t('جارٍ البحث في LC وVIAF وويكي بيانات…', 'Searching LC, VIAF and Wikidata…')}</p>}
                      {Array.isArray(m) && m.length === 0 && <p className="text-slate-500">{t('لا مطابقات. جرّب لاحقاً أو اربط من محرر الاستناد.', 'No matches. Try later or link it from the authority editor.')}</p>}
                      {Array.isArray(m) && m.map((x) => (
                        <div key={x.uri} className="flex items-center gap-2">
                          <span className="w-16 shrink-0 text-slate-400">{x.source}</span>
                          <span className="flex-1 truncate" dir="auto">{x.label}{x.description ? ` — ${x.description}` : ''}</span>
                          <a href={x.uri} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-700" aria-label={t('افتح', 'Open')}><ExternalLink className="h-3 w-3" /></a>
                          <button type="button" onClick={() => link(r, x)} className="rounded bg-blue-600 px-2 py-0.5 text-white">{t('اربط', 'Link')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

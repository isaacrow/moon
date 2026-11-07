/**
 * Linking Moon's entities to LC, VIAF and Wikidata (Phase 12, step 5). Every entity without an outside link
 * is searched (LC with the ALA-LC romanization of an Arabic name, Wikidata, VIAF through both); sure matches
 * (same name, same dates for a person, no close second) are listed to link in one click, the rest with their
 * candidates and the reasons, for the cataloguer to choose. Linking adds every outside address the match's
 * records carry (LC, VIAF, Wikidata, FAST, ISNI …) to the entity.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Loader2, Search, CheckCircle2, X } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';
import { searchLOCAuthorities, searchWikidata, romanizeQuery } from '../../services/authoritySearch';
import { fetchOutsideEntity, SAME_AS_HOSTS } from '../../services/entityImport';
import { reconcileEntity, type Candidate, type ReconcileEntity } from '../../services/reconcile';

interface Row { entity: ReconcileEntity & { uri?: string; sameAs?: string[] }; state: 'waiting' | 'searching' | 'sure' | 'review' | 'none' | 'linked' | 'error'; candidates: Candidate[]; sure: Candidate | null }

const KIND: Record<string, [string, string]> = { agent: ['شخص أو هيئة', 'person or body'], place: ['مكان', 'place'], topic: ['موضوع', 'subject'], genre: ['نوع', 'genre'], hub: ['عمل', 'work'], period: ['فترة', 'period'] };
const deps = {
  searchLc: (q: string, scheme: 'names' | 'subjects') => searchLOCAuthorities(q, scheme),
  searchWikidata: (q: string) => searchWikidata(q, 'item'),
  romanize: (q: string) => romanizeQuery(q),
  details: (uri: string) => fetchOutsideEntity(uri).catch(() => null),
};

export function ReconcilePanel({ ar, onClose, onLinked }: { ar: boolean; onClose: () => void; onLinked?: () => void }) {
  const t = (a: string, e: string) => (ar ? a : e);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [linking, setLinking] = useState(false);
  const set = (id: string, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r) => (r.entity.id === id ? { ...r, ...patch } : r)));

  const start = async () => {
    setRunning(true);
    // Every entity with no outside link yet (each kind, up to 100 each).
    const lists = await Promise.all(['agent', 'place', 'topic', 'genre'].map((k) => moonFetch<any>(`/authorities?kind=${k}&limit=100`).catch(() => null)));
    const entities = lists.flatMap((r) => (r?.ok ? r.data.authorities || [] : [])).filter((e: any) => !(e.sameAs || []).length);
    const initial: Row[] = entities.map((e: any) => ({ entity: e, state: 'waiting', candidates: [], sure: null }));
    setRows(initial);
    // Two at a time, so LC and Wikidata are not flooded.
    let next = 0;
    const work = async () => {
      while (next < initial.length) {
        const e = initial[next++].entity;
        set(e.id, { state: 'searching' });
        try {
          const r = await reconcileEntity(e, deps);
          set(e.id, { state: r.sure ? 'sure' : r.candidates.length ? 'review' : 'none', candidates: r.candidates, sure: r.sure });
        } catch {
          set(e.id, { state: 'error' });
        }
      }
    };
    await Promise.all([work(), work()]);
    setRunning(false);
  };

  /** Adds the match's outside addresses to the entity. */
  const link = async (row: Row, c: Candidate) => {
    const links = c.links.filter((u) => SAME_AS_HOSTS.test(u) && u.length <= 300).slice(0, 12);
    let ok = 0;
    for (const uri of links) {
      const r = await moonFetch<any>(`/authorities/${encodeURIComponent(row.entity.id)}/same-as`, { method: 'POST', body: { uri } }).catch(() => null);
      if (r?.ok) ok++;
    }
    if (ok) set(row.entity.id, { state: 'linked', sure: c });
    return ok;
  };

  const linkAllSure = async () => {
    if (!rows) return;
    setLinking(true);
    const sure = rows.filter((r) => r.state === 'sure' && r.sure);
    let done = 0;
    for (const r of sure) if (await link(r, r.sure!)) done++;
    setLinking(false);
    toast.success(t(`رُبط ${done} كياناً`, `${done} entities linked`));
    onLinked?.();
  };

  const count = (s: Row['state']) => (rows || []).filter((r) => r.state === s).length;
  const box: React.CSSProperties = { background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.9)', borderRadius: 24 };

  return (
    <div className="p-5 space-y-4" style={box} dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="me-auto">
          <div className="text-base font-bold text-slate-800">{t('ربط الكيانات بمكتبة الكونغرس وVIAF وويكي بيانات', 'Link entities to LC, VIAF and Wikidata')}</div>
          <div className="text-xs text-slate-500">{t('يُبحث عن كل كيان لا رابط خارجياً له. المؤكد: الاسم نفسه، والتواريخ نفسها للأشخاص، ولا منافس قريب.', 'Every entity with no outside link is searched. Sure: the same name, the same dates for a person, and no close second.')}</div>
        </div>
        {!rows && (
          <button type="button" onClick={start} disabled={running} className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Search className="h-4 w-4" /> {t('ابحث عن الروابط', 'Find the links')}
          </button>
        )}
        {rows && count('sure') > 0 && (
          <button type="button" onClick={linkAllSure} disabled={linking || running} className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} {t(`اربط المؤكد (${count('sure')})`, `Link all sure matches (${count('sure')})`)}
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white" aria-label={t('إغلاق', 'Close')}><X className="h-4 w-4" /></button>
      </div>

      {rows && (
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {running && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-sky-800"><Loader2 className="h-3 w-3 animate-spin" /> {t(`يبحث… ${rows.length - count('waiting') - count('searching')} من ${rows.length}`, `Searching… ${rows.length - count('waiting') - count('searching')} of ${rows.length}`)}</span>}
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{t(`مؤكد ${count('sure')}`, `Sure ${count('sure')}`)}</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{t(`للمراجعة ${count('review')}`, `To review ${count('review')}`)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{t(`لم يوجد ${count('none')}`, `Not found ${count('none')}`)}</span>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">{t(`رُبط ${count('linked')}`, `Linked ${count('linked')}`)}</span>
        </div>
      )}

      {rows && (
        <ul className="divide-y divide-slate-200/70 max-h-[60vh] overflow-auto">
          {rows.filter((r) => r.state !== 'waiting').map((r) => (
            <li key={r.entity.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-slate-800" dir="auto">{r.entity.label}</span>
                <span className="text-xs text-slate-500">{ar ? KIND[r.entity.kind]?.[0] : KIND[r.entity.kind]?.[1]}</span>
                <span className="ms-auto text-xs">
                  {r.state === 'searching' && <Loader2 className="h-4 w-4 animate-spin text-sky-600" />}
                  {r.state === 'linked' && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {t('رُبط', 'linked')}</span>}
                  {r.state === 'none' && <span className="text-slate-500">{t('لم يوجد', 'not found')}</span>}
                  {r.state === 'error' && <span className="text-rose-600">{t('تعذّر البحث', 'search failed')}</span>}
                </span>
              </div>
              {(r.state === 'sure' || r.state === 'review') && (
                <div className="mt-2 space-y-1.5">
                  {(r.state === 'sure' ? [r.sure!] : r.candidates).map((c) => (
                    <div key={c.uri} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm ${r.state === 'sure' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700">{c.source === 'LOC' ? 'LC' : c.source}</span>
                      <a href={c.uri} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:underline" dir="auto">{c.label}</a>
                      <span className="text-xs text-slate-500">{Math.round(c.score * 100)}% · {c.reasons.join(', ')}</span>
                      <span className="text-[11px] text-slate-400" dir="ltr">{c.links.length} {t('روابط', 'links')}</span>
                      <button type="button" onClick={async () => { if (await link(r, c)) { toast.success(t('رُبط', 'Linked')); onLinked?.(); } }}
                        className="ms-auto inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-sky-800 hover:bg-sky-50">
                        <Link2 className="h-3.5 w-3.5" /> {t('اربط', 'Link')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

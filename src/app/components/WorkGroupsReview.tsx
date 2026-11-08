/**
 * Work groups review (Phase 13 S11): what Moon's Work clustering is not sure of, for a person to decide,
 * and the groups it made, each with its reasons and a way to take a record out. Decisions are stored on the
 * server (who and when) and the OPAC applies them, so a person's word always beats a score.
 */
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, X, Undo2, Layers, Loader2 } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';
import { wolfMoonOpacService, type OpacWorkEntity } from '../../services/wolfMoonOpacService';
import { clusterPipeline, type WorkDecision, type PairScore } from '../../services/workClustering';

const box = 'rounded-2xl bg-white/60 border border-white p-4';
const btn = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border border-white disabled:opacity-50';

export function WorkGroupsReview({ ar, onClose }: { ar: boolean; onClose: () => void }) {
  const t = (a: string, e: string) => (ar ? a : e);
  const [works, setWorks] = useState<OpacWorkEntity[] | null>(null);
  const [decisions, setDecisions] = useState<WorkDecision[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      await wolfMoonOpacService.initDatabase(true).catch(() => {});
      const all = wolfMoonOpacService.getAllWorks().filter((w) => w.source !== 'seed');
      const r = await moonFetch<{ decisions?: WorkDecision[] }>('/work-clusters/decisions').catch(() => null);
      if (!live) return;
      setWorks(all);
      setDecisions(r?.data?.decisions || []);
    })();
    return () => { live = false; };
  }, []);

  const result = useMemo(() => (works ? clusterPipeline(works, decisions) : null), [works, decisions]);
  const byId = useMemo(() => new Map((works || []).map((w) => [w.id, w])), [works]);
  const groups = (result?.groups || []).filter((g) => g.members.length > 1);

  const send = async (pairs: Array<{ a: string; b: string; verdict: 'same' | 'different' | 'clear' }>) => {
    setBusy(true);
    let last: WorkDecision[] | null = null;
    for (const p of pairs) {
      const r = await moonFetch<{ decisions?: WorkDecision[]; error?: string }>('/work-clusters/decisions', { body: p }).catch(() => null);
      if (!r?.ok) { toast.error(r?.data?.error || t('تعذّر الحفظ', 'Could not save')); break; }
      last = r.data.decisions || null;
    }
    setBusy(false);
    if (last) { setDecisions(last); toast.success(t('حُفظ. يظهر في الفهرس العام خلال دقيقة.', 'Saved. The OPAC shows it within a minute.')); }
  };

  const title = (id: string) => byId.get(id)?.title || id;
  const who = (id: string) => byId.get(id)?.primaryCreator?.nameArabic || byId.get(id)?.primaryCreator?.name || '';
  const line = (id: string) => {
    const w = byId.get(id);
    const i = w?.instances?.[0];
    return [who(id), i?.publisher, i?.publicationYear].filter(Boolean).join(' · ');
  };

  return (
    <section className={`${box} mb-4`} aria-label={t('مجموعات الأعمال', 'Work groups')}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-slate-900 flex items-center gap-2"><Layers className="h-4 w-4" /> {t('مجموعات الأعمال (الطبعات والترجمات)', 'Work groups (editions and translations)')}</h2>
        <button onClick={onClose} className={`${btn} bg-white/80`} aria-label={t('إغلاق', 'Close')}><X className="h-3 w-3" /></button>
      </div>
      <p className="text-xs text-slate-600 mb-3">
        {t('يجمع Moon تسجيلات العمل الواحد بالعنوان والمؤلف (مع مراعاة العربية) والمحور وروابط الترجمة. لا يجمع المخطوطات والدوريات ذات العناوين العامة وحده. قرارك يغلب دائمًا.',
          'Moon groups the records of one Work by title and creator (Arabic-aware), hub and translation links. It never joins manuscripts or serials with generic titles by itself. Your decision always wins.')}
      </p>
      {!result ? <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t('جارٍ التحميل…', 'Loading…')}</p> : (
        <>
          <h3 className="text-sm font-bold text-slate-800 mt-2 mb-1">{t(`غير متأكد (${result.unsure.length})`, `Not sure (${result.unsure.length})`)}</h3>
          {!result.unsure.length && <p className="text-xs text-slate-500">{t('لا شيء ينتظر قرارًا.', 'Nothing waiting for a decision.')}</p>}
          <ul className="space-y-2">
            {result.unsure.slice(0, 50).map((p: PairScore) => (
              <li key={`${p.a}|${p.b}`} className="rounded-xl bg-white/70 p-3 text-sm">
                <div dir="auto"><b>{title(p.a)}</b> <span className="text-slate-500">{line(p.a)}</span></div>
                <div dir="auto"><b>{title(p.b)}</b> <span className="text-slate-500">{line(p.b)}</span></div>
                <div className="text-xs text-slate-600 mt-1">{t('الدرجة', 'Score')} {Math.round(p.score * 100)}% · {p.evidence.join('; ')}</div>
                <div className="flex gap-2 mt-2">
                  <button disabled={busy} onClick={() => send([{ a: p.a, b: p.b, verdict: 'same' }])} className={`${btn} bg-emerald-100 text-emerald-900`}><Check className="h-3 w-3" /> {t('العمل نفسه', 'Same Work')}</button>
                  <button disabled={busy} onClick={() => send([{ a: p.a, b: p.b, verdict: 'different' }])} className={`${btn} bg-white/80 text-slate-800`}><X className="h-3 w-3" /> {t('عملان مختلفان', 'Different Works')}</button>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="text-sm font-bold text-slate-800 mt-4 mb-1">{t(`المجموعات (${groups.length})`, `Groups (${groups.length})`)}</h3>
          <ul className="space-y-2">
            {groups.slice(0, 100).map((g) => (
              <li key={g.key} className="rounded-xl bg-white/70 p-3 text-sm">
                <div className="text-xs text-slate-600 mb-1">{Math.round(g.confidence * 100)}% · {g.evidence.join('; ')}</div>
                <ul>
                  {g.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span dir="auto"><b>{m.title}</b> <span className="text-slate-500">{line(m.id)}</span></span>
                      <button disabled={busy} title={t('ليس من هذا العمل', 'Not this Work')}
                        onClick={() => send(g.members.filter((o) => o.id !== m.id).map((o) => ({ a: m.id, b: o.id, verdict: 'different' as const })))}
                        className={`${btn} bg-white/80 text-slate-700`}>{t('أخرجه', 'Take out')}</button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {!!decisions.length && (
            <>
              <h3 className="text-sm font-bold text-slate-800 mt-4 mb-1">{t(`قرارات المفهرسين (${decisions.length})`, `Cataloguers' decisions (${decisions.length})`)}</h3>
              <ul className="space-y-1">
                {decisions.slice(-50).reverse().map((d) => (
                  <li key={`${d.a}|${d.b}`} className="flex items-center justify-between gap-2 text-xs">
                    <span dir="auto">{title(d.a)} {d.verdict === 'same' ? '=' : '≠'} {title(d.b)} <span className="text-slate-500">{d.by}{d.at ? ` · ${d.at.slice(0, 10)}` : ''}</span></span>
                    <button disabled={busy} onClick={() => send([{ a: d.a, b: d.b, verdict: 'clear' }])} className={`${btn} bg-white/80 text-slate-700`}><Undo2 className="h-3 w-3" /> {t('تراجع', 'Undo')}</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

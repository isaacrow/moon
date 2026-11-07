/**
 * The Super Admin's linked-data scorecard (Phase 12): the published catalogue measured against BIBFRAME 3.0.1
 * and linked-data rules, live from /admin/ld-audit (the same audit CI and the nightly job run). With a button
 * that links every record's names, subjects, places and publishers to entities, as each save does.
 */
import React, { useEffect, useState } from 'react';
import { RefreshCw, Link2, ShieldCheck, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { moonFetch } from '../utils/moonApi';

interface Measure { key: string; en: string; ar: string; value: number; total: number; target: 'all' | 'none' }
interface Report {
  at: string;
  counts: { triples: number; works: number; instances: number; items: number; entities: number };
  measures: Measure[];
  unknownTerms: Record<string, number>;
  rangeErrors: Record<string, number>;
  unlinked: { contributors: string[]; subjects: string[] };
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.58)', borderRadius: '28px',
  boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.78)',
};

const share = (m: Measure) => (m.target === 'none' ? (m.value === 0 ? 1 : 0) : m.total ? m.value / m.total : 1);
const colour = (s: number) => (s >= 0.999 ? '#047857' : s >= 0.8 ? '#b45309' : '#be123c');

export function LinkedDataHealthCard({ isAr }: { isAr: boolean }) {
  const t = (a: string, e: string) => (isAr ? a : e);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [details, setDetails] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await moonFetch<Report & { error?: string }>('/admin/ld-audit').catch((e) => ({ ok: false, status: 0, data: { error: String(e) } as any }));
    setLoading(false);
    if (res.ok) { setReport(res.data); setError(null); } else setError(res.data?.error || `Error ${res.status}`);
  };
  useEffect(() => { load(); }, []);

  // Every record, in batches, as the account menu's "link records" does; then the scorecard again.
  const relinkAll = async () => {
    setLinking(true);
    const id = toast.loading(t('جارٍ ربط التسجيلات…', 'Linking records…'));
    let offset: number | null = 0, changed = 0, linked = 0, total = 0;
    try {
      while (offset !== null) {
        const r: { ok: boolean; status: number; data: any } = await moonFetch<any>(`/authorities/link-records?offset=${offset}&limit=50`, { method: 'POST', body: {} });
        if (!r.ok) throw new Error(r.data?.error || 'The server refused the request.');
        changed += r.data.changed; linked += r.data.linked; total = r.data.total; offset = r.data.next;
        toast.loading(t(`جارٍ الربط… ${Math.min(offset ?? total, total)} من ${total}`, `Linking… ${Math.min(offset ?? total, total)} of ${total}`), { id });
      }
      toast.success(t(`رُبط ${linked} اسماً وموضوعاً في ${changed} من ${total} تسجيلة`, `${linked} headings linked in ${changed} of ${total} records`), { id });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e), { id });
    } finally {
      setLinking(false);
    }
  };

  const met = report ? report.measures.filter((m) => share(m) >= 0.999).length : 0;

  return (
    <div className="p-6" style={GLASS}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-base font-bold me-auto" style={{ color: '#1a202c' }}>
          <ShieldCheck className="h-5 w-5" style={{ color: '#047857' }} />
          {t('سلامة البيانات المترابطة (BIBFRAME)', 'Linked-data health (BIBFRAME)')}
          {report && <span className="text-sm font-semibold" style={{ color: '#64748b' }}>· {t(`${met} من ${report.measures.length} مكتملة`, `${met} of ${report.measures.length} met`)}</span>}
        </div>
        <button type="button" onClick={relinkAll} disabled={linking}
          className="inline-flex items-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-50">
          <Link2 className="h-4 w-4" /> {linking ? t('جارٍ الربط…', 'Linking…') : t('اربط كل التسجيلات بالكيانات', 'Link every record to entities')}
        </button>
        <button type="button" onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-white/60 disabled:opacity-50" aria-label={t('تحديث', 'Refresh')} title={t('تحديث', 'Refresh')}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} style={{ color: '#475569' }} />
        </button>
      </div>

      {error && !report && <div className="text-sm" style={{ color: '#be123c' }}>{t('تعذّر الفحص: ', 'Could not run the audit: ')}{error}</div>}
      {!error && !report && <div className="text-sm" style={{ color: '#64748b' }}>{t('جارٍ فحص الفهرس المنشور…', 'Auditing the published catalogue…')}</div>}

      {report && (
        <>
          <div className="text-xs mb-3" style={{ color: '#64748b' }}>
            {t(`${report.counts.works} عملاً، ${report.counts.instances} طبعة، ${report.counts.entities} كياناً، ${report.counts.triples} ثلاثية`, `${report.counts.works} works, ${report.counts.instances} instances, ${report.counts.entities} entities, ${report.counts.triples} triples`)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {report.measures.map((m) => {
              const s = share(m);
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 text-sm" style={{ color: '#334155' }}>
                      <span className="truncate">{isAr ? m.ar : m.en}</span>
                      <span className="font-bold shrink-0" style={{ color: colour(s) }} dir="ltr">
                        {m.target === 'none' ? m.value : `${m.value}/${m.total}`}
                      </span>
                    </div>
                    {m.target === 'all' && (
                      <div className="h-1.5 w-full rounded-full mt-1" style={{ background: 'rgba(15,23,42,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.round(100 * s)}%`, background: colour(s) }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={() => setDetails((d) => !d)} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:underline">
            <ChevronDown className={`h-4 w-4 transition-transform ${details ? 'rotate-180' : ''}`} /> {t('التفاصيل', 'Details')}
          </button>
          {details && (
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" style={{ color: '#334155' }}>
              <div>
                <div className="font-bold mb-1">{t('أسماء غير مرتبطة', 'Names not linked')}</div>
                <ul className="list-disc ps-5 space-y-0.5">{report.unlinked.contributors.slice(0, 15).map((n) => <li key={n} dir="auto">{n}</li>)}</ul>
              </div>
              <div>
                <div className="font-bold mb-1">{t('موضوعات غير مرتبطة', 'Subjects not linked')}</div>
                <ul className="list-disc ps-5 space-y-0.5">{report.unlinked.subjects.slice(0, 15).map((n) => <li key={n} dir="auto">{n}</li>)}</ul>
              </div>
              {[[t('مصطلحات خارج BIBFRAME 3.0.1', 'Terms outside BIBFRAME 3.0.1'), report.unknownTerms] as const, [t('قيم من نوع خاطئ', 'Values of the wrong kind'), report.rangeErrors] as const].map(([title, map]) => (
                Object.keys(map).length > 0 && (
                  <div key={title}>
                    <div className="font-bold mb-1">{title}</div>
                    <ul className="space-y-0.5 font-mono text-xs" dir="ltr">{Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, n]) => <li key={k}>{k} × {n}</li>)}</ul>
                  </div>
                )
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

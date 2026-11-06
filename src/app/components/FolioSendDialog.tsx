/**
 * Send to FOLIO (Phase 5). One button for the cataloguer:
 * - route 1, Inventory API: Moon's server creates or updates the FOLIO Instance (no duplicates; an existing
 *   Instance with the same ISBN is offered first);
 * - route 4, file: a MARC file to load with FOLIO's Data Import, when there is no API access.
 * The dialog shows the record's FOLIO status and a preview of the Instance before anything is sent.
 */
import { useEffect, useState } from 'react';
import { Send, Download, X, ExternalLink, RefreshCw } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';

interface Link { instanceId: string; hrid?: string; sentAt: string }
interface Preview {
  configured: boolean; published?: boolean; link?: Link | null; instance?: any; warnings?: string[];
  changed?: boolean; folioUrl?: string; error?: string;
}
interface SendReply {
  status: 'created' | 'updated' | 'match' | 'blocked' | 'error';
  instanceId?: string; hrid?: string; message?: string; warnings?: string[]; folioUrl?: string;
  candidates?: { id: string; hrid?: string; title: string }[];
}

const DATA_IMPORT_PROFILE = 'Default - Create instance and SRS MARC Bib';

export function FolioSendDialog({ recordId, rtl, onClose, onDownloadMarc }: {
  recordId: string; rtl: boolean; onClose: () => void; onDownloadMarc?: () => void;
}) {
  const t = (ar: string, en: string) => (rtl ? ar : en);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<SendReply | null>(null);
  const [showJson, setShowJson] = useState(false);

  const load = async () => {
    setPreview(null);
    const r = await moonFetch<Preview>(`/folio/record/${encodeURIComponent(recordId)}`);
    setPreview(r.ok || r.data ? r.data : { configured: true, error: `HTTP ${r.status}` });
  };
  useEffect(() => { load(); }, [recordId]);

  const send = async (opts: { linkTo?: string; createAnyway?: boolean } = {}) => {
    setBusy(true);
    setReply(null);
    try {
      const r = await moonFetch<SendReply>(`/folio/send/${encodeURIComponent(recordId)}`, { method: 'POST', body: opts });
      setReply(r.data || { status: 'error', message: `HTTP ${r.status}` });
      if (r.data?.status === 'created' || r.data?.status === 'updated') load();
    } catch (e) {
      setReply({ status: 'error', message: String((e as Error).message || e) });
    } finally {
      setBusy(false);
    }
  };

  const link = preview?.link;
  const state = !preview ? '' : !preview.configured ? t('لم يُربط FOLIO بعد', 'FOLIO not set up')
    : preview.published === false ? t('غير منشور', 'Not published')
    : !link ? t('لم يُرسل', 'Not sent') : preview.changed ? t('تغيّر منذ الإرسال', 'Changed since sent') : t('مُرسل', 'Sent');

  return (
    <div role="dialog" aria-modal="true" dir={rtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[85vh] overflow-auto rounded-2xl bg-white p-5 text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('إرسال إلى FOLIO', 'Send to FOLIO')}</h2>
          <button onClick={onClose} aria-label={t('إغلاق', 'Close')} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {!preview ? <p className="text-sm text-slate-500">{t('جارٍ التحقق…', 'Checking…')}</p> : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{state}</span>
              {link && <span className="text-slate-500">HRID {link.hrid || '—'} · {new Date(link.sentAt).toLocaleString()}</span>}
              {preview.folioUrl && <a href={preview.folioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">{t('افتح في FOLIO', 'Open in FOLIO')} <ExternalLink className="h-3 w-3" /></a>}
              <button onClick={load} className="ms-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"><RefreshCw className="h-3 w-3" /> {t('تحديث', 'Refresh')}</button>
            </div>

            {!preview.configured && (
              <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{t(
                'لم يُضبط اتصال FOLIO على خادم مون. يمكن للمسؤول ضبطه (MOON_FOLIO_URL و MOON_FOLIO_TENANT و MOON_FOLIO_USERNAME و MOON_FOLIO_PASSWORD). حتى ذلك الحين نزّل ملف مارك وحمّله في Data Import في FOLIO.',
                'FOLIO is not connected to Moon\'s server yet. An admin sets it up (MOON_FOLIO_URL, MOON_FOLIO_TENANT, MOON_FOLIO_USERNAME, MOON_FOLIO_PASSWORD). Until then, download the MARC file and load it with FOLIO\'s Data Import.')}</p>
            )}
            {preview.published === false && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{t('انشر التسجيلة أولاً؛ تُرسل التسجيلات المنشورة فقط إلى FOLIO.', 'Publish the record first; only published records go to FOLIO.')}</p>}
            {preview.error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{preview.error}</p>}
            {(preview.warnings || []).map((w) => <p key={w} className="rounded-lg bg-amber-50 p-2 text-amber-900">{w}</p>)}

            {preview.instance && (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="font-semibold" dir="auto">{preview.instance.title}</div>
                <div className="text-slate-600" dir="auto">{(preview.instance.contributors || []).map((c: any) => c.name).join(' · ')}</div>
                <div className="text-slate-600" dir="auto">{(preview.instance.publication || []).map((p: any) => [p.place, p.publisher, p.dateOfPublication].filter(Boolean).join(' : ')).join(' ; ')}</div>
                <div className="text-slate-500">{(preview.instance.identifiers || []).map((i: any) => i.value).join(' · ')}</div>
                <button onClick={() => setShowJson((s) => !s)} className="mt-2 text-xs text-blue-600 hover:underline">{showJson ? t('إخفاء JSON', 'Hide JSON') : t('عرض تسجيلة FOLIO (JSON)', 'Show the FOLIO Instance (JSON)')}</button>
                {showJson && <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-50 p-2 text-[11px]" dir="ltr">{JSON.stringify(preview.instance, null, 2)}</pre>}
              </div>
            )}

            {reply && (
              <div className={`rounded-lg p-3 ${reply.status === 'created' || reply.status === 'updated' ? 'bg-emerald-50 text-emerald-900' : reply.status === 'match' ? 'bg-blue-50 text-blue-900' : 'bg-red-50 text-red-800'}`}>
                {reply.status === 'created' && t(`أُنشئت تسجيلة في FOLIO (${reply.hrid || reply.instanceId}).`, `Created in FOLIO (${reply.hrid || reply.instanceId}).`)}
                {reply.status === 'updated' && t(`حُدّثت تسجيلة FOLIO (${reply.hrid || reply.instanceId}).`, `Updated the FOLIO Instance (${reply.hrid || reply.instanceId}).`)}
                {(reply.status === 'error' || reply.status === 'blocked') && reply.message}
                {reply.status === 'match' && (
                  <div className="space-y-2">
                    <p>{t('في FOLIO تسجيلة بالردمك نفسه. اربط بها بدل إنشاء نسخة مكررة؟', 'FOLIO already has an Instance with the same ISBN. Link to it instead of making a duplicate?')}</p>
                    {(reply.candidates || []).map((cand) => (
                      <button key={cand.id} disabled={busy} onClick={() => send({ linkTo: cand.id })}
                        className="block w-full rounded border border-blue-200 bg-white p-2 text-start hover:bg-blue-50" dir="auto">
                        {t('اربط بـ', 'Link to')} {cand.title} <span className="text-slate-500">({cand.hrid || cand.id})</span>
                      </button>
                    ))}
                    <button disabled={busy} onClick={() => send({ createAnyway: true })} className="text-xs text-slate-600 underline">{t('لا، أنشئ تسجيلة جديدة', 'No, create a new Instance')}</button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button disabled={busy || !preview.instance} onClick={() => send()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40">
                <Send className="h-4 w-4" />
                {busy ? t('جارٍ الإرسال…', 'Sending…') : link ? t('حدّث في FOLIO', 'Update in FOLIO') : t('أرسل إلى FOLIO', 'Send to FOLIO')}
              </button>
              {onDownloadMarc && (
                <button onClick={onDownloadMarc} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-semibold">
                  <Download className="h-4 w-4" /> {t('ملف مارك لـ Data Import', 'MARC file for Data Import')}
                </button>
              )}
            </div>
            {onDownloadMarc && (
              <p className="text-xs text-slate-500">{t(
                `في FOLIO: Data import ← حمّل الملف ← اختر ملف المهمة «${DATA_IMPORT_PROFILE}».`,
                `In FOLIO: Data import → upload the file → choose the job profile “${DATA_IMPORT_PROFILE}”.`)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

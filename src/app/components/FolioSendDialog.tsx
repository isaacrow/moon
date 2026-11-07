/**
 * Send to FOLIO (Phase 5). The cataloguer picks how the record goes:
 * - MARC + Instance (recommended): the MARC goes to FOLIO's quickMARC; FOLIO keeps it in Source Record
 *   Storage and builds the Instance from it, so both are there and stay in step;
 * - Instance only: Moon's server writes the Inventory Instance (no MARC in FOLIO);
 * - MARC file: download and load with FOLIO's Data Import, when there is no API access.
 * The Super Admin enters the FOLIO connection here (address, tenant, account, password); the password is
 * kept sealed on Moon's server and never shown again.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Send, Download, X, ExternalLink, RefreshCw, Settings2, CheckCircle2, FileCode2, Database } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';
import { bibframeToMarc } from '../../services/marc/bibframeToMarc';
import { marcToText } from '../../services/marc/marcEditing';

interface Link { instanceId: string; hrid?: string; sentAt: string; mode?: 'marc' | 'instance' }
interface Preview {
  configured: boolean; published?: boolean; link?: Link | null; instance?: any; warnings?: string[];
  changed?: boolean; folioUrl?: string; error?: string; document?: any;
}
interface SendReply {
  status: 'created' | 'updated' | 'match' | 'blocked' | 'error';
  instanceId?: string; hrid?: string; message?: string; warnings?: string[]; folioUrl?: string;
  candidates?: { id: string; hrid?: string; title: string }[];
}
interface PublicSettings { url: string; tenant: string; username: string; uiUrl: string; hasPassword: boolean; updatedBy?: string; updatedAt?: string }
type Mode = 'marc' | 'instance';

const DATA_IMPORT_PROFILE = 'Default - Create instance and SRS MARC Bib';
const INPUT = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';

export function FolioSendDialog({ recordId, rtl, onClose, onDownloadMarc }: {
  recordId: string; rtl: boolean; onClose: () => void; onDownloadMarc?: () => void;
}) {
  const t = (ar: string, en: string) => (rtl ? ar : en);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<SendReply | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [mode, setMode] = useState<Mode>('marc');

  // ---- Connection (Super Admin) ----
  const [isAdmin, setIsAdmin] = useState(false);
  const [fromSecrets, setFromSecrets] = useState(false);
  const [showConn, setShowConn] = useState(false);
  const [conn, setConn] = useState({ url: '', tenant: '', username: '', password: '', uiUrl: '' });
  const [saved, setSaved] = useState<PublicSettings | null>(null);
  const [connMsg, setConnMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setPreview(null);
    const r = await moonFetch<Preview>(`/folio/record/${encodeURIComponent(recordId)}`);
    const p = r.ok || r.data ? r.data : { configured: true, error: `HTTP ${r.status}` };
    setPreview(p);
    if (p?.link?.mode) setMode(p.link.mode);
  };
  const loadSettings = async () => {
    const r = await moonFetch<{ settings: PublicSettings | null; fromSecrets: boolean }>('/folio/settings').catch(() => null);
    if (!r?.ok) return;
    setIsAdmin(true);
    setFromSecrets(r.data.fromSecrets);
    setSaved(r.data.settings);
    if (r.data.settings) setConn((c) => ({ ...c, url: r.data.settings!.url, tenant: r.data.settings!.tenant, username: r.data.settings!.username, uiUrl: r.data.settings!.uiUrl }));
  };
  useEffect(() => { load(); loadSettings(); }, [recordId]);
  useEffect(() => { if (preview && !preview.configured && isAdmin) setShowConn(true); }, [preview?.configured, isAdmin]);

  const saveConnection = async () => {
    setBusy(true);
    setConnMsg(null);
    const r = await moonFetch<{ ok?: boolean; error?: string; settings?: PublicSettings }>('/folio/settings', { method: 'PUT', body: conn }).catch(() => null);
    setBusy(false);
    if (r?.ok && r.data.settings) {
      setSaved(r.data.settings);
      setConn((c) => ({ ...c, password: '' }));
      setConnMsg({ ok: true, text: t('تم تسجيل الدخول إلى FOLIO وحُفظ الاتصال.', 'Signed in to FOLIO; the connection is saved.') });
      load();
    } else {
      setConnMsg({ ok: false, text: r?.data?.error || t('تعذّر الحفظ.', 'Could not save.') });
    }
  };

  // The record as MARC, from the same published BIBFRAME FOLIO gets.
  const marc = useMemo(() => {
    if (!preview?.document) return null;
    try { return bibframeToMarc(preview.document, { recordId }); } catch { return null; }
  }, [preview?.document, recordId]);

  const send = async (opts: { linkTo?: string; createAnyway?: boolean } = {}) => {
    setBusy(true);
    setReply(null);
    try {
      const body: any = { ...opts, mode };
      if (mode === 'marc') body.marc = marc;
      const r = await moonFetch<SendReply>(`/folio/send/${encodeURIComponent(recordId)}`, { method: 'POST', body });
      setReply(r.data || { status: 'error', message: `HTTP ${r.status}` });
      if (r.data?.status === 'created' || r.data?.status === 'updated') load();
    } catch (e) {
      setReply({ status: 'error', message: String((e as Error).message || e) });
    } finally {
      setBusy(false);
    }
  };

  const link = preview?.link;
  const state = !preview ? '' : !preview.configured ? t('لم يُربط FOLIO بعد', 'FOLIO not connected')
    : preview.published === false ? t('غير منشور', 'Not published')
    : !link ? t('لم يُرسل', 'Not sent') : preview.changed ? t('تغيّر منذ الإرسال', 'Changed since sent') : t('مُرسل', 'Sent');
  const canSend = !!preview?.configured && preview.published !== false && (mode === 'marc' ? !!marc : !!preview.instance);

  const route = (m: Mode, icon: ReactNode, title: string, note: string) => (
    <button type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
      className={`flex-1 min-w-[200px] rounded-xl border p-3 text-start ${mode === m ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'}`}>
      <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
      <div className="mt-1 text-xs text-slate-600">{note}</div>
    </button>
  );

  return (
    <div role="dialog" aria-modal="true" dir={rtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-white p-5 text-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{t('إرسال إلى FOLIO', 'Send to FOLIO')}</h2>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button onClick={() => setShowConn((s) => !s)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" aria-expanded={showConn}>
                <Settings2 className="h-4 w-4" /> {t('الاتصال', 'Connection')}
              </button>
            )}
            <button onClick={onClose} aria-label={t('إغلاق', 'Close')} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* ---- FOLIO sign-in (Super Admin) ---- */}
        {isAdmin && showConn && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="font-semibold">{t('تسجيل الدخول إلى FOLIO', 'FOLIO sign-in')}</div>
            {fromSecrets && <p className="text-xs text-amber-800">{t('الاتصال مضبوط بأسرار الخادم، وهي تتقدّم على ما يُحفظ هنا.', 'The connection is set by server secrets, which win over what is saved here.')}</p>}
            <label className="block"><span className="text-xs text-slate-600">{t('عنوان FOLIO (بوابة Okapi أو Kong)', 'FOLIO address (Okapi or Kong gateway)')}</span>
              <input className={INPUT} dir="ltr" placeholder="https://okapi.example-library.org" value={conn.url} onChange={(e) => setConn({ ...conn, url: e.target.value })} /></label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block"><span className="text-xs text-slate-600">{t('المستأجر (Tenant)', 'Tenant')}</span>
                <input className={INPUT} dir="ltr" placeholder="fs00001000" value={conn.tenant} onChange={(e) => setConn({ ...conn, tenant: e.target.value })} /></label>
              <label className="block"><span className="text-xs text-slate-600">{t('اسم المستخدم', 'Username')}</span>
                <input className={INPUT} dir="ltr" autoComplete="off" value={conn.username} onChange={(e) => setConn({ ...conn, username: e.target.value })} /></label>
            </div>
            <label className="block"><span className="text-xs text-slate-600">{t('كلمة المرور', 'Password')}{saved?.hasPassword ? t(' (محفوظة؛ اتركها فارغة لإبقائها)', ' (saved; leave empty to keep it)') : ''}</span>
              <input className={INPUT} type="password" dir="ltr" autoComplete="new-password" value={conn.password} onChange={(e) => setConn({ ...conn, password: e.target.value })} /></label>
            <label className="block"><span className="text-xs text-slate-600">{t('عنوان واجهة FOLIO (اختياري، لرابط «افتح في FOLIO»)', 'FOLIO web address (optional, for "Open in FOLIO")')}</span>
              <input className={INPUT} dir="ltr" placeholder="https://folio.example-library.org" value={conn.uiUrl} onChange={(e) => setConn({ ...conn, uiUrl: e.target.value })} /></label>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button disabled={busy} onClick={saveConnection} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-40">
                <CheckCircle2 className="h-4 w-4" /> {busy ? t('جارٍ التحقق…', 'Checking…') : t('سجّل الدخول واحفظ', 'Sign in and save')}
              </button>
              {saved?.updatedAt && <span className="text-xs text-slate-500">{t('حُفظ', 'Saved')} {new Date(saved.updatedAt).toLocaleString()}{saved.updatedBy ? ` · ${saved.updatedBy}` : ''}</span>}
            </div>
            {connMsg && <p className={`rounded-lg p-2 ${connMsg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{connMsg.text}</p>}
            <p className="text-xs text-slate-500">{t('تُحفظ كلمة المرور مشفّرة على خادم مون ولا تُعرض مرة أخرى. يحتاج الحساب صلاحيات Inventory و quickMARC في FOLIO.', 'The password is kept encrypted on Moon\'s server and never shown again. The account needs Inventory and quickMARC permissions in FOLIO.')}</p>
          </div>
        )}

        {!preview ? <p className="text-sm text-slate-500">{t('جارٍ التحقق…', 'Checking…')}</p> : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{state}</span>
              {link && <span className="text-slate-500">HRID {link.hrid || '—'} · {link.mode === 'marc' ? t('مارك + Instance', 'MARC + Instance') : 'Instance'} · {new Date(link.sentAt).toLocaleString()}</span>}
              {preview.folioUrl && <a href={preview.folioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">{t('افتح في FOLIO', 'Open in FOLIO')} <ExternalLink className="h-3 w-3" /></a>}
              <button onClick={load} className="ms-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"><RefreshCw className="h-3 w-3" /> {t('تحديث', 'Refresh')}</button>
            </div>

            {!preview.configured && !isAdmin && (
              <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{t(
                'لم يُربط FOLIO بعد. يُدخل المسؤول العام عنوان FOLIO والمستأجر والحساب هنا. حتى ذلك الحين نزّل ملف مارك وحمّله في Data Import في FOLIO.',
                'FOLIO is not connected yet. The Super Admin enters the FOLIO address, tenant and account here. Until then, download the MARC file and load it with FOLIO\'s Data Import.')}</p>
            )}
            {preview.published === false && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{t('انشر التسجيلة أولاً؛ تُرسل التسجيلات المنشورة فقط إلى FOLIO.', 'Publish the record first; only published records go to FOLIO.')}</p>}
            {preview.error && <p className="rounded-lg bg-red-50 p-3 text-red-800">{preview.error}</p>}
            {mode === 'instance' && (preview.warnings || []).map((w) => <p key={w} className="rounded-lg bg-amber-50 p-2 text-amber-900">{w}</p>)}

            {/* ---- How it goes ---- */}
            {preview.published !== false && (
              <div className="flex flex-wrap gap-2">
                {route('marc', <FileCode2 className="h-4 w-4 text-blue-600" />, t('مارك + Instance (مُوصى به)', 'MARC + Instance (recommended)'),
                  t('يُرسل مارك إلى quickMARC؛ يحفظه FOLIO في SRS ويبني منه الـ Instance، فيبقيان متطابقين.', 'MARC goes to quickMARC; FOLIO keeps it in SRS and builds the Instance from it, so both stay in step.'))}
                {route('instance', <Database className="h-4 w-4 text-slate-600" />, t('Instance فقط', 'Instance only'),
                  t('يكتب مون الـ Instance في Inventory مباشرة، بلا مارك في FOLIO.', 'Moon writes the Inventory Instance directly, with no MARC in FOLIO.'))}
              </div>
            )}

            {mode === 'marc' && marc && (
              <div className="rounded-lg border border-slate-200 p-3">
                <button onClick={() => setShowJson((s) => !s)} className="text-xs text-blue-600 hover:underline">{showJson ? t('إخفاء مارك', 'Hide the MARC') : t('عرض المارك الذي سيُرسل', 'Show the MARC that will be sent')}</button>
                {showJson && <pre className="mt-2 max-h-72 overflow-auto rounded bg-slate-50 p-2 text-[12px] leading-5" dir="ltr">{marcToText(marc)}</pre>}
              </div>
            )}
            {mode === 'instance' && preview.instance && (
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
                {reply.status === 'updated' && t(`حُدّثت تسجيلة FOLIO (${reply.hrid || reply.instanceId}).`, `Updated in FOLIO (${reply.hrid || reply.instanceId}).`)}
                {(reply.status === 'error' || reply.status === 'blocked') && reply.message}
                {reply.status === 'match' && (
                  <div className="space-y-2">
                    <p>{t('في FOLIO تسجيلة بالردمك نفسه.', 'FOLIO already has an Instance with the same ISBN.')}</p>
                    {mode === 'instance' && (reply.candidates || []).map((cand) => (
                      <button key={cand.id} disabled={busy} onClick={() => send({ linkTo: cand.id })}
                        className="block w-full rounded border border-blue-200 bg-white p-2 text-start hover:bg-blue-50" dir="auto">
                        {t('اربط بـ', 'Link to')} {cand.title} <span className="text-slate-500">({cand.hrid || cand.id})</span>
                      </button>
                    ))}
                    {mode === 'marc' && (reply.candidates || []).map((cand) => (
                      <div key={cand.id} className="rounded border border-blue-200 bg-white p-2" dir="auto">{cand.title} <span className="text-slate-500">({cand.hrid || cand.id})</span></div>
                    ))}
                    <button disabled={busy} onClick={() => send({ createAnyway: true })} className="text-xs text-slate-600 underline">{t('أنشئ تسجيلة جديدة على أي حال', 'Create a new record anyway')}</button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button disabled={busy || !canSend} onClick={() => send()}
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
                `بلا اتصال API: في FOLIO افتح Data import ← حمّل الملف ← اختر ملف المهمة «${DATA_IMPORT_PROFILE}».`,
                `Without an API connection: in FOLIO open Data import → upload the file → choose the job profile “${DATA_IMPORT_PROFILE}”.`)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

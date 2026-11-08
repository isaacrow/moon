/**
 * The Super Admin's webhooks (Phase 13 S19): addresses Moon tells whenever a record is saved, published or
 * returned, each message signed with the hook's secret (X-Moon-Signature: sha256=…). The secret is shown
 * once, when the hook is added; a test message is sent at once so the answer shows.
 */
import { useEffect, useState } from 'react';
import { Webhook as WebhookIcon, Trash2, Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { moonFetch } from '../utils/moonApi';

interface Hook { id: string; url: string; events: string[]; by: string; at: string }
const EVENT_LABELS: Record<string, [string, string]> = {
  'record.saved': ['حُفظت تسجيلة', 'Record saved'],
  'record.published': ['نُشرت تسجيلة', 'Record published'],
  'record.returned': ['أُعيدت تسجيلة للتعديل', 'Record returned'],
};

export function WebhooksCard({ isAr }: { isAr: boolean }) {
  const t = (a: string, e: string) => (isAr ? a : e);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['record.published']);
  const [secret, setSecret] = useState<{ id: string; secret: string; test: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await moonFetch<{ webhooks?: Hook[] }>('/webhooks').catch(() => null);
    if (r?.ok) setHooks(r.data.webhooks || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    setBusy(true);
    const r = await moonFetch<{ webhook?: Hook; secret?: string; test?: number; error?: string }>('/webhooks', { body: { url: url.trim(), events } }).catch(() => null);
    setBusy(false);
    if (!r?.ok || !r.data.webhook) { toast.error(r?.data?.error || t('تعذّرت الإضافة', 'Could not add')); return; }
    setSecret({ id: r.data.webhook.id, secret: r.data.secret || '', test: r.data.test || 0 });
    setUrl('');
    load();
  };
  const remove = async (id: string) => {
    if (!confirm(t('أأحذف هذا العنوان؟', 'Remove this webhook?'))) return;
    const r = await moonFetch(`/webhooks/${id}`, { method: 'DELETE' }).catch(() => null);
    if (r?.ok) { toast.success(t('حُذف', 'Removed')); load(); }
  };

  return (
    <section className="rounded-[28px] p-6 bg-white/60 border border-white" aria-label="Webhooks">
      <h3 className="font-bold text-slate-900 flex items-center gap-2"><WebhookIcon className="h-4 w-4" /> {t('إشعارات الأنظمة الأخرى (Webhooks)', 'Webhooks')}</h3>
      <p className="text-xs text-slate-600 mt-1 mb-3">
        {t('يرسل مون رسالة موقّعة إلى هذه العناوين كلما حُفظت تسجيلة أو نُشرت أو أُعيدت، فيتحدث فهرس آخر أو محرك بحث دون انتظار.',
          'Moon sends a signed message to these addresses whenever a record is saved, published or returned, so another catalogue or search layer updates at once.')}
      </p>
      <ul className="space-y-1 mb-3">
        {hooks.map((h) => (
          <li key={h.id} className="flex items-center gap-2 text-sm">
            <span dir="ltr" className="font-mono text-xs break-all">{h.url}</span>
            <span className="text-xs text-slate-500">{h.events.map((e) => t(...(EVENT_LABELS[e] || [e, e]))).join(t('، ', ', '))}</span>
            <button onClick={() => remove(h.id)} className="ms-auto text-slate-500 hover:text-rose-600" aria-label={t('احذف', 'Remove')}><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        {!hooks.length && <li className="text-xs text-slate-500">{t('لا عناوين بعد.', 'None yet.')}</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.org/moon-hook"
          className="flex-1 min-w-[220px] rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm" />
        {Object.keys(EVENT_LABELS).map((e) => (
          <label key={e} className="flex items-center gap-1 text-xs text-slate-700">
            <input type="checkbox" checked={events.includes(e)} onChange={(x) => setEvents((cur) => (x.target.checked ? [...cur, e] : cur.filter((y) => y !== e)))} />
            {t(...EVENT_LABELS[e])}
          </label>
        ))}
        <button disabled={busy || !url.trim() || !events.length} onClick={add} className="flex items-center gap-1 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-bold disabled:opacity-50">
          <Plus className="h-4 w-4" /> {t('أضف', 'Add')}
        </button>
      </div>
      {secret && (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <p className="font-bold">{t('السرّ (يظهر مرة واحدة فقط):', 'Secret (shown only this once):')}</p>
          <div className="flex items-center gap-2 mt-1">
            <code dir="ltr" className="break-all">{secret.secret}</code>
            <button onClick={() => navigator.clipboard?.writeText(secret.secret)} aria-label={t('انسخ', 'Copy')}><Copy className="h-4 w-4" /></button>
          </div>
          <p className="mt-1">{t('تحقق من الرسائل بحساب HMAC-SHA256 لجسم الرسالة بهذا السرّ ومقارنته بالترويسة X-Moon-Signature.', 'Check each message: the HMAC-SHA256 of its body with this secret equals the X-Moon-Signature header.')}</p>
          <p className="mt-1">{secret.test >= 200 && secret.test < 300 ? t(`أُرسلت رسالة تجربة وأجاب العنوان (${secret.test}).`, `A test message was sent and the address answered (${secret.test}).`) : t(`أُرسلت رسالة تجربة ولم يُجب العنوان بنجاح (${secret.test || 'لا رد'}).`, `A test message was sent; the address did not answer with success (${secret.test || 'no reply'}).`)}</p>
        </div>
      )}
    </section>
  );
}

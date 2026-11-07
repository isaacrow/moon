/**
 * Merging and splitting entities through an approval inbox (Phase 13 S18, step 3).
 * - EntityRequestsInbox: the open requests. The Super Admin approves or declines each; a cataloger sees
 *   their own requests and what happened to them.
 * - EntityMergeBox, on an entity: "Ask to merge into…" (pick the entity to keep, say why) and, for the
 *   entities merged into this one, "Ask to split off" (they turned out to be different).
 * An approved merge keeps what the kept entity was, so a split takes back exactly what the merge added.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GitMerge, Split, Check, X, Inbox } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';

interface Req {
  id: number; kind: 'merge' | 'split'; from: string; into: string; reason: string; askedBy: string; askedAt: string;
  status: 'open' | 'approved' | 'declined'; decidedBy?: string | null; note?: string | null; fromLabel?: string; intoLabel?: string;
}
const box = 'rounded-2xl bg-white/60 border border-white p-4';
const INPUT = 'w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-300';

export function EntityRequestsInbox({ ar, refreshKey, onDecided }: { ar: boolean; refreshKey?: number; onDecided?: () => void }) {
  const t = (a: string, e: string) => (ar ? a : e);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [mayDecide, setMayDecide] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const load = async () => {
    const r = await moonFetch<{ requests?: Req[]; mayDecide?: boolean }>('/entity-requests?status=open').catch(() => null);
    if (r?.ok) { setReqs(r.data.requests || []); setMayDecide(!!r.data.mayDecide); }
  };
  useEffect(() => { load(); }, [refreshKey]);
  if (!reqs.length) return null;

  const decide = async (q: Req, approve: boolean) => {
    setBusy(q.id);
    const r = await moonFetch<{ request?: Req; error?: string }>(`/entity-requests/${q.id}/decide`, { body: { approve } }).catch(() => null);
    setBusy(null);
    if (!r?.ok) { toast.error(r?.data?.error || t('تعذّر التحديث', 'Could not update')); return; }
    const done = r.data.request!;
    if (done.status === 'approved') toast.success(q.kind === 'merge' ? t('دُمج', 'Merged') : t('فُصل', 'Split'));
    else toast.message(done.note || t('رُفض', 'Declined'));
    await load();
    onDecided?.();
  };

  return (
    <div className={`${box} space-y-2`} dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <Inbox className="h-4 w-4" /> {mayDecide ? t(`طلبات الدمج والفصل (${reqs.length})`, `Merge and split requests (${reqs.length})`) : t('طلباتك المفتوحة', 'Your open requests')}
      </div>
      <ul className="divide-y divide-slate-200/70">
        {reqs.map((q) => (
          <li key={q.id} className="py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {q.kind === 'merge' ? <GitMerge className="h-4 w-4 text-violet-700" /> : <Split className="h-4 w-4 text-amber-700" />}
              <span dir="auto" className="font-semibold">{q.fromLabel}</span>
              <span className="text-slate-500">{q.kind === 'merge' ? t('← يُدمج في', '→ merged into') : t('← يُفصل عن', '→ split off from')}</span>
              <span dir="auto" className="font-semibold">{q.intoLabel}</span>
              {mayDecide && (
                <span className="ms-auto flex gap-2">
                  <button type="button" disabled={busy === q.id} onClick={() => decide(q, true)} className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">
                    <Check className="h-3.5 w-3.5" /> {t('وافق', 'Approve')}
                  </button>
                  <button type="button" disabled={busy === q.id} onClick={() => decide(q, false)} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 disabled:opacity-50">
                    <X className="h-3.5 w-3.5" /> {t('ارفض', 'Decline')}
                  </button>
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-600" dir="auto">{q.reason} <span className="text-slate-400">— {q.askedBy}</span></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EntityMergeBox({ entity, ar, onAsked }: { entity: { id: string; kind: string; label: string; mergedInto?: string | null }; ar: boolean; onAsked?: () => void }) {
  const t = (a: string, e: string) => (ar ? a : e);
  const [merged, setMerged] = useState<Array<{ id: string; label: string }>>([]);
  const [asking, setAsking] = useState<null | { kind: 'merge' } | { kind: 'split'; id: string; label: string }>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Array<{ id: string; label: string }>>([]);
  const [into, setInto] = useState<{ id: string; label: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAsking(null); setInto(null); setReason(''); setQ('');
    moonFetch<{ merged?: Array<{ id: string; label: string }> }>(`/authorities/${encodeURIComponent(entity.id)}/merged`).then((r) => setMerged(r.ok ? r.data.merged || [] : [])).catch(() => setMerged([]));
  }, [entity.id]);
  useEffect(() => {
    if (asking?.kind !== 'merge' || q.trim().length < 2) { setFound([]); return; }
    const timer = setTimeout(async () => {
      const r = await moonFetch<{ authorities?: Array<{ id: string; label: string }> }>(`/authorities?kind=${entity.kind}&limit=8&q=${encodeURIComponent(q.trim())}`).catch(() => null);
      setFound((r?.ok ? r.data.authorities || [] : []).filter((a) => a.id !== entity.id));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, asking, entity.id, entity.kind]);

  const send = async () => {
    if (!asking || !reason.trim()) return;
    const id = asking.kind === 'split' ? asking.id : entity.id;
    const body = asking.kind === 'merge' ? { kind: 'merge', into: into?.id, reason } : { kind: 'split', reason };
    if (asking.kind === 'merge' && !into) return;
    setBusy(true);
    const r = await moonFetch<{ error?: string }>(`/authorities/${encodeURIComponent(id)}/requests`, { body }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { toast.error(r?.data?.error || t('تعذّر الإرسال', 'Could not send')); return; }
    toast.success(t('أُرسل الطلب إلى المسؤول العام للموافقة.', 'Request sent to the Super Admin for approval.'));
    setAsking(null); setInto(null); setReason(''); setQ('');
    onAsked?.();
  };

  if (entity.mergedInto) return null;
  return (
    <div className={`${box} space-y-2 text-sm`} dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-700">{t('الدمج والفصل', 'Merge and split')}</span>
        {!asking && (
          <button type="button" onClick={() => setAsking({ kind: 'merge' })} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-800">
            <GitMerge className="h-3.5 w-3.5" /> {t('اطلب دمجه في كيان آخر', 'Ask to merge into another entity')}
          </button>
        )}
      </div>
      {merged.length > 0 && !asking && (
        <ul className="space-y-1 text-xs text-slate-600">
          {merged.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2">
              <span>{t('دُمج فيه:', 'Merged into it:')}</span> <span dir="auto" className="font-semibold">{m.label}</span>
              <button type="button" onClick={() => setAsking({ kind: 'split', id: m.id, label: m.label })} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 font-semibold text-amber-800">
                <Split className="h-3 w-3" /> {t('اطلب فصله', 'Ask to split off')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {asking?.kind === 'merge' && (
        <div className="space-y-1.5">
          {into ? (
            <div className="text-xs">{t('يُدمج في:', 'Merge into:')} <span dir="auto" className="font-semibold">{into.label}</span> <button type="button" className="text-sky-700 underline" onClick={() => setInto(null)}>{t('غيّر', 'change')}</button></div>
          ) : (
            <>
              <input className={INPUT} dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ابحث عن الكيان الذي يبقى…', 'Find the entity to keep…')} />
              {found.map((f) => <button type="button" key={f.id} onClick={() => setInto(f)} className="block w-full rounded-lg px-2 py-1 text-start text-xs hover:bg-white" dir="auto">{f.label}</button>)}
            </>
          )}
        </div>
      )}
      {asking && (
        <div className="space-y-1.5">
          {asking.kind === 'split' && <div className="text-xs">{t('يُفصل:', 'Split off:')} <span dir="auto" className="font-semibold">{asking.label}</span></div>}
          <textarea className={INPUT} rows={2} dir="auto" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={asking.kind === 'merge' ? t('لماذا هما الكيان نفسه؟ (التواريخ، تسجيلة مكتبة الكونغرس…)', 'Why are they the same? (dates, the LC record …)') : t('لماذا هما كيانان مختلفان؟', 'Why are they different?')} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(null)} className="rounded-full px-3 py-1 text-xs font-semibold">{t('إلغاء', 'Cancel')}</button>
            <button type="button" disabled={busy || !reason.trim() || (asking.kind === 'merge' && !into)} onClick={send} className="rounded-full bg-violet-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-40">
              {t('أرسل للموافقة', 'Send for approval')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

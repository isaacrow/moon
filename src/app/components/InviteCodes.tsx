/**
 * Invite codes, inside the Approval Center (Super Admin only). A code approves a new account at once.
 * The Super Admin makes one for a person or a group, with a number of uses and an end date. The code is
 * shown once, when it is made (the server keeps only a hash of it), and can be cancelled from the list.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, Plus, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Invite {
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  maxUses: number;
  uses: number;
  usedBy: string[];
  revoked?: boolean;
  usable: boolean;
}

const PILL: React.CSSProperties = {
  borderRadius: 999,
  background: 'rgba(255, 255, 255, 0.6)',
  border: '1px solid rgba(255, 255, 255, 1)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
};
const ROW: React.CSSProperties = {
  borderRadius: 16,
  background: 'rgba(255, 255, 255, 0.5)',
  border: '1px solid rgba(255, 255, 255, 1)',
  boxShadow: '0 2px 16px rgba(0, 0, 0, 0.05)',
};
const FIELD = 'h-10 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-300';

/** Why a code no longer works, in the reader's language. */
export function inviteState(i: Pick<Invite, 'revoked' | 'expiresAt' | 'uses' | 'maxUses'>, ar: boolean, now = Date.now()): string {
  if (i.revoked) return ar ? 'ملغى' : 'Cancelled';
  if (i.expiresAt && Date.parse(i.expiresAt) <= now) return ar ? 'انتهى' : 'Ended';
  if (i.uses >= i.maxUses) return ar ? 'استُنفد' : 'Used up';
  return ar ? 'يعمل' : 'Working';
}

export function InviteCodes({ ar }: { ar: boolean }) {
  const { adminFetch } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState(7);
  const [making, setMaking] = useState(false);
  const [fresh, setFresh] = useState<{ code: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const t = (a: string, e: string) => (ar ? a : e);

  const load = useCallback(async () => {
    const { ok, data } = await adminFetch('/api/accounts/invites');
    if (ok && data?.success) { setInvites(data.invites || []); setError(null); }
    else setError(data?.message || t('تعذّر تحميل رموز الدعوة.', 'Could not load the invite codes.'));
    setLoading(false);
  }, [adminFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const make = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || making) return;
    setMaking(true);
    setCopied(false);
    const { ok, data } = await adminFetch('/api/accounts/invites', { label: label.trim(), maxUses, days });
    setMaking(false);
    if (ok && data?.success && data.code) {
      setFresh({ code: data.code, label: label.trim() });
      setLabel('');
      setError(null);
      load();
    } else setError(data?.message || t('تعذّر إنشاء الرمز.', 'Could not make the code.'));
  };

  const cancel = async (invite: Invite) => {
    if (!window.confirm(t(`إلغاء رمز «${invite.label}»؟ لن يعمل بعد الآن.`, `Cancel the code for "${invite.label}"? It will stop working.`))) return;
    const { ok, data } = await adminFetch('/api/accounts/invites/revoke', { id: invite.id });
    if (!ok || !data?.success) setError(data?.message || t('تعذّر إلغاء الرمز.', 'Could not cancel the code.'));
    load();
  };

  const copy = async () => {
    if (!fresh) return;
    try { await navigator.clipboard.writeText(fresh.code); setCopied(true); } catch { /* the code is on screen to copy by hand */ }
  };

  const dateOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(ar ? 'ar' : undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

  return (
    <div className="relative flex-1 overflow-y-auto px-6 pb-6 space-y-3">
      <p className="text-xs text-slate-600">
        {t('رمز الدعوة يعتمد الحساب الجديد فوراً. أنشئ رمزاً لشخص أو لمجموعة، وأرسله لهم.', 'An invite code approves a new account at once. Make one for a person or a group, and send it to them.')}
      </p>

      <form onSubmit={make} className="p-4 flex flex-col sm:flex-row sm:items-end gap-3" style={ROW}>
        <label className="flex-1 min-w-0 space-y-1">
          <span className="block text-[11px] font-bold text-slate-700">{t('لمن هذا الرمز؟', 'Who is it for?')}</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} required
            placeholder={t('مثال: مكتبة العتبة، فريق الفهرسة', 'e.g. Karbala library, cataloguing team')}
            className={`${FIELD} w-full`} style={{ ...PILL, borderRadius: 16 }} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-slate-700">{t('عدد الاستخدامات', 'Uses')}</span>
          <input type="number" min={1} max={500} value={maxUses} onChange={(e) => setMaxUses(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
            className={`${FIELD} w-24`} style={{ ...PILL, borderRadius: 16 }} />
        </label>
        <label className="space-y-1">
          <span className="block text-[11px] font-bold text-slate-700">{t('ينتهي بعد', 'Ends after')}</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${FIELD} cursor-pointer`} style={{ ...PILL, borderRadius: 16 }}>
            <option value={7}>{t('٧ أيام', '7 days')}</option>
            <option value={30}>{t('٣٠ يوماً', '30 days')}</option>
            <option value={90}>{t('٩٠ يوماً', '90 days')}</option>
            <option value={0}>{t('بلا نهاية', 'No end date')}</option>
          </select>
        </label>
        <button type="submit" disabled={making || !label.trim()}
          className="h-10 px-4 text-xs font-black flex items-center justify-center gap-1.5 text-slate-900 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          style={PILL}>
          {making ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t('أنشئ رمزاً', 'Make a code')}
        </button>
      </form>

      {fresh && (
        <div className="p-4 space-y-2" style={{ ...ROW, border: '1px solid rgba(15, 23, 42, 0.35)' }} role="status">
          <div className="text-xs font-bold text-slate-900">
            {t(`رمز «${fresh.label}» — يظهر مرة واحدة فقط، انسخه الآن:`, `Code for "${fresh.label}" — shown only once, copy it now:`)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <code dir="ltr" className="px-3 py-2 text-lg font-black tracking-widest text-slate-900 select-all" style={{ ...PILL, borderRadius: 14 }}>{fresh.code}</code>
            <button type="button" onClick={copy} className="h-9 px-3 text-xs font-bold flex items-center gap-1.5 text-slate-900 hover:scale-105 active:scale-95 transition-all cursor-pointer" style={PILL}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('نُسخ', 'Copied') : t('انسخ', 'Copy')}
            </button>
            <button type="button" onClick={() => setFresh(null)} className="h-9 px-3 text-xs font-bold text-slate-700 hover:scale-105 active:scale-95 transition-all cursor-pointer" style={PILL}>
              {t('تم', 'Done')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs px-3 py-2 text-slate-900" style={{ ...PILL, borderRadius: 14 }}>{error}</p>}

      {loading ? (
        <div className="py-10 flex items-center justify-center gap-2 text-slate-500 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {t('جارٍ التحميل…', 'Loading…')}</div>
      ) : invites.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">{t('لا رموز دعوة بعد.', 'No invite codes yet.')}</div>
      ) : invites.map((i) => (
        <div key={i.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${i.usable ? '' : 'opacity-60'}`} style={ROW}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2.5 shrink-0" style={{ ...PILL, borderRadius: 14 }}><KeyRound className="h-4 w-4 text-slate-700" /></span>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm truncate">{i.label}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide text-slate-900" style={PILL}>{inviteState(i, ar)}</span>
              </div>
              <div className="text-xs text-slate-700 flex items-center gap-x-3 gap-y-1 flex-wrap">
                <span>{t(`استُخدم ${i.uses} من ${i.maxUses}`, `Used ${i.uses} of ${i.maxUses}`)}</span>
                <span>{i.expiresAt ? t(`ينتهي ${dateOf(i.expiresAt)}`, `Ends ${dateOf(i.expiresAt)}`) : t('بلا نهاية', 'No end date')}</span>
                <span className="text-slate-500">{t(`أُنشئ ${dateOf(i.createdAt)}`, `Made ${dateOf(i.createdAt)}`)}</span>
              </div>
              {i.usedBy.length > 0 && <div className="text-xs text-slate-600 truncate">{t('استخدمه: ', 'Used by: ')}{i.usedBy.join(ar ? '، ' : ', ')}</div>}
            </div>
          </div>
          {i.usable && (
            <button type="button" onClick={() => cancel(i)}
              className="px-3.5 h-9 text-xs font-bold flex items-center gap-1.5 text-slate-900 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0" style={PILL}>
              <XCircle className="h-3.5 w-3.5" />{t('إلغاء الرمز', 'Cancel code')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default InviteCodes;

/**
 * Tester Approval Center: the Super Admin's list of tester accounts, in liquid glossy glass.
 * Shared by the top bar (signed-in isaac) and the login screen (after the admin password).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, X, CheckCircle2, XCircle, Trash2, RefreshCw, Search, Mail, Building2, CalendarDays, Undo2, Loader2,
} from 'lucide-react';
import type { AuthUser } from '../contexts/AuthContext';
import { UserAvatar } from './UserAvatar';
import { formatLastSeen, sortByPresence } from '../utils/presence';

const LIST_REFRESH_MS = 30_000;

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

interface TesterApprovalCenterProps {
  open: boolean;
  onClose: () => void;
  users: AuthUser[];
  loading?: boolean;
  error?: string | null;
  busyUser?: string | null;
  subtitle?: string;
  onRefresh: () => void;
  onApprove: (username: string) => void;
  onReject: (username: string) => void;
  onDelete: (username: string) => void;
  /** Sets an approved account's role; reviewers may approve, return and comment on others' records. */
  onSetRole?: (username: string, role: 'tester' | 'cataloger' | 'reviewer') => void;
  /** Shown instead of the list (e.g. the login screen's admin password form). */
  lockedContent?: React.ReactNode;
}

// ---- Liquid glass surfaces --------------------------------------------------------------

const PANEL: React.CSSProperties = {
  borderRadius: 32,
  background: 'linear-gradient(145deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.09) 45%, rgba(255,255,255,0.16) 100%)',
  backdropFilter: 'blur(40px) saturate(185%) brightness(1.05)',
  WebkitBackdropFilter: 'blur(40px) saturate(185%) brightness(1.05)',
  border: '1px solid rgba(255,255,255,0.42)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(255,255,255,0.12), 0 30px 90px rgba(0,0,0,0.5)',
};

const SHEEN: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.06) 28%, rgba(255,255,255,0) 45%)',
};

const ROW: React.CSSProperties = {
  borderRadius: 22,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))',
  border: '1px solid rgba(255,255,255,0.22)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 20px rgba(0,0,0,0.18)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const PENDING_ROW: React.CSSProperties = {
  ...ROW,
  background: 'linear-gradient(135deg, rgba(251,191,36,0.22), rgba(251,191,36,0.06))',
  border: '1px solid rgba(252,211,77,0.45)',
};

const PILL: React.CSSProperties = {
  borderRadius: 999,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.10))',
  border: '1px solid rgba(255,255,255,0.40)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 14px rgba(0,0,0,0.18)',
};

const APPROVE_PILL: React.CSSProperties = {
  ...PILL,
  background: 'linear-gradient(180deg, rgba(110,231,183,0.95) 0%, rgba(16,185,129,0.92) 55%, rgba(5,150,105,0.95) 100%)',
  border: '1px solid rgba(167,243,208,0.8)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -2px 6px rgba(4,120,87,0.45), 0 6px 18px rgba(16,185,129,0.35)',
};

const REJECT_PILL: React.CSSProperties = {
  ...PILL,
  background: 'linear-gradient(180deg, rgba(254,205,211,0.35), rgba(244,63,94,0.22))',
  border: '1px solid rgba(253,164,175,0.55)',
};

const STATUS_STYLE: Record<AuthUser['status'], React.CSSProperties> = {
  pending: { background: 'linear-gradient(180deg, #fde68a, #f59e0b)', color: '#451a03', border: '1px solid rgba(254,243,199,0.9)' },
  approved: { background: 'linear-gradient(180deg, rgba(167,243,208,0.45), rgba(16,185,129,0.35))', color: '#d1fae5', border: '1px solid rgba(110,231,183,0.5)' },
  rejected: { background: 'linear-gradient(180deg, rgba(254,205,211,0.4), rgba(244,63,94,0.3))', color: '#ffe4e6', border: '1px solid rgba(253,164,175,0.5)' },
};

// ---- Component -------------------------------------------------------------------------

export function TesterApprovalCenter({
  open, onClose, users, loading, error, busyUser, subtitle,
  onRefresh, onApprove, onReject, onDelete, onSetRole, lockedContent,
}: TesterApprovalCenterProps) {
  const ar = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const [filter, setFilter] = useState<Filter>('pending');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const counts = useMemo(() => ({
    all: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    rejected: users.filter(u => u.status === 'rejected').length,
  }), [users]);

  // Open on the pending queue when there is one, otherwise on everyone.
  useEffect(() => {
    if (open) setFilter(counts.pending > 0 ? 'pending' : 'all');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortByPresence(users
      .filter(u => filter === 'all' || u.status === filter)
      .filter(u => !q || [u.username, u.email, u.institution].some(v => (v || '').toLowerCase().includes(q))));
  }, [users, filter, query]);

  // Keep "online now" / "last seen" current while the list is open.
  // (Through a ref: callers pass a new onRefresh each render, which would restart the timer.)
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const locked = !!lockedContent;
  useEffect(() => {
    if (!open || locked) return;
    const timer = window.setInterval(() => refreshRef.current(), LIST_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [open, locked]);

  const tabs: Array<{ key: Filter; label: string }> = [
    { key: 'pending', label: ar ? 'بانتظار الموافقة' : 'Pending' },
    { key: 'approved', label: ar ? 'معتمد' : 'Approved' },
    { key: 'rejected', label: ar ? 'مرفوض' : 'Declined' },
    { key: 'all', label: ar ? 'الكل' : 'All' },
  ];

  const statusLabel = (s: AuthUser['status']) =>
    s === 'pending' ? (ar ? 'بانتظار الموافقة' : 'Pending') : s === 'approved' ? (ar ? 'معتمد' : 'Approved') : (ar ? 'مرفوض' : 'Declined');

  const dateOf = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString(ar ? 'ar' : undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir={ar ? 'rtl' : 'ltr'}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 20%, rgba(30,58,138,0.45), rgba(2,6,23,0.82))', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ar ? 'مركز اعتماد الفاحصين' : 'Tester Approval Center'}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="relative w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col z-10 text-white"
            style={PANEL}
          >
            <div className="pointer-events-none absolute inset-0" style={SHEEN} />

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl" style={{ ...PILL, borderRadius: 18 }}>
                  <ShieldCheck className="h-6 w-6 text-amber-200" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight drop-shadow">{ar ? 'مركز اعتماد الفاحصين' : 'Tester Approval Center'}</h2>
                  <p className="text-xs text-white/70">{subtitle || (ar ? 'راجع طلبات الانضمام واعتمدها أو ارفضها' : 'Review, approve or decline tester requests')}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="p-2 hover:scale-105 active:scale-95 transition-all cursor-pointer" style={PILL}
                aria-label={ar ? 'إغلاق' : 'Close'}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {lockedContent ? (
              <div className="relative flex-1 overflow-y-auto px-6 pb-8">{lockedContent}</div>
            ) : (
              <>
                {/* Filters + search */}
                <div className="relative px-6 pb-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {tabs.map(tab => {
                      const active = filter === tab.key;
                      return (
                        <button key={tab.key} type="button" onClick={() => setFilter(tab.key)}
                          className="px-3.5 py-1.5 text-xs font-bold flex items-center gap-2 transition-all hover:scale-[1.03] cursor-pointer"
                          style={active
                            ? { ...PILL, background: 'linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55))', color: '#0f172a' }
                            : { ...PILL, color: 'rgba(255,255,255,0.85)' }}
                          aria-pressed={active}>
                          {tab.label}
                          <span className="min-w-5 px-1.5 rounded-full text-[10px] font-black"
                            style={tab.key === 'pending' && counts.pending > 0
                              ? { background: '#f59e0b', color: '#451a03' }
                              : { background: active ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.18)' }}>
                            {counts[tab.key]}
                          </span>
                        </button>
                      );
                    })}
                    <button type="button" onClick={onRefresh} disabled={loading}
                      className="ms-auto px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-[1.03] disabled:opacity-60 cursor-pointer"
                      style={{ ...PILL, color: 'rgba(255,255,255,0.9)' }}>
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      {ar ? 'تحديث' : 'Refresh'}
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-white/60 start-3" style={{ insetInlineStart: 12 }} />
                    <input value={query} onChange={e => setQuery(e.target.value)}
                      placeholder={ar ? 'ابحث بالاسم أو البريد أو المؤسسة' : 'Search by name, email or institution'}
                      className="w-full h-10 ps-9 pe-3 text-sm text-white placeholder:text-white/55 outline-none focus:ring-2 focus:ring-white/40"
                      style={{ ...PILL, borderRadius: 16, paddingInlineStart: 36 }} />
                  </div>
                  {error && (
                    <p className="text-xs px-3 py-2" style={{ ...REJECT_PILL, borderRadius: 14, color: '#ffe4e6' }}>{error}</p>
                  )}
                </div>

                {/* List */}
                <div className="relative flex-1 overflow-y-auto px-6 pb-6 space-y-3">
                  {loading && users.length === 0 ? (
                    <div className="py-16 flex items-center justify-center gap-2 text-white/70 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> {ar ? 'جارٍ التحميل…' : 'Loading…'}
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="py-14 text-center text-sm text-white/70">
                      {filter === 'pending'
                        ? (ar ? 'لا توجد طلبات بانتظار الموافقة 🎉' : 'No requests waiting for approval 🎉')
                        : (ar ? 'لا توجد حسابات مطابقة.' : 'No matching accounts.')}
                    </div>
                  ) : visible.map(u => {
                    const isAdmin = u.role === 'admin';
                    const busy = busyUser === u.username;
                    return (
                      <motion.div key={u.username} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        style={u.status === 'pending' ? PENDING_ROW : ROW}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="relative shrink-0">
                            <UserAvatar username={u.username || '?'} size={44} />
                            {u.online && (
                              <span className="absolute bottom-0 end-0 h-3.5 w-3.5 rounded-full bg-emerald-400"
                                style={{ border: '2px solid rgba(15,23,42,0.85)', boxShadow: '0 0 8px rgba(52,211,153,0.9)' }}
                                aria-hidden="true" />
                            )}
                          </span>
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-base truncate">{u.username}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide" style={STATUS_STYLE[u.status]}>
                                {statusLabel(u.status)}
                              </span>
                              {isAdmin && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ ...PILL, color: '#fde68a' }}>
                                  {ar ? 'المشرف العام' : 'Super Admin'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-white/75 flex items-center gap-x-3 gap-y-1 flex-wrap">
                              <span className="flex items-center gap-1 min-w-0"><Mail className="h-3.5 w-3.5 shrink-0 text-white/50" /><span className="truncate">{u.email}</span></span>
                              {u.institution && <span className="flex items-center gap-1 min-w-0 text-cyan-100"><Building2 className="h-3.5 w-3.5 shrink-0 text-cyan-200/70" /><span className="truncate">{u.institution}</span></span>}
                              {!isAdmin && dateOf(u.registeredAt) && <span className="flex items-center gap-1 text-white/55"><CalendarDays className="h-3.5 w-3.5" />{dateOf(u.registeredAt)}</span>}
                            </div>
                            <div className="text-xs flex items-center gap-1.5">
                              {u.online ? (
                                <span className="font-bold text-emerald-300">{ar ? 'متصل الآن' : 'Online now'}</span>
                              ) : (
                                <span className="text-white/60">{formatLastSeen(u.lastSeenAt, ar)}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isAdmin && (
                          <div className={`flex items-center gap-2 shrink-0 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                            {onSetRole && u.status === 'approved' && (
                              <select
                                value={u.role}
                                onChange={(e) => onSetRole(u.username, e.target.value as 'tester' | 'cataloger' | 'reviewer')}
                                title={ar ? 'الدور' : 'Role'}
                                className="h-9 px-2 text-xs font-bold text-white cursor-pointer outline-none"
                                style={PILL}
                              >
                                <option value="tester" className="text-slate-900">{ar ? 'فاحص' : 'Tester'}</option>
                                <option value="cataloger" className="text-slate-900">{ar ? 'مفهرس' : 'Cataloger'}</option>
                                <option value="reviewer" className="text-slate-900">{ar ? 'مراجع' : 'Reviewer'}</option>
                              </select>
                            )}
                            {u.status !== 'approved' && (
                              <button type="button" onClick={() => onApprove(u.username)}
                                className="px-4 h-9 text-xs font-black flex items-center gap-1.5 text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                style={APPROVE_PILL}>
                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                {u.status === 'rejected' ? (ar ? 'إعادة اعتماد' : 'Re-approve') : (ar ? 'اعتماد' : 'Approve')}
                              </button>
                            )}
                            {u.status !== 'rejected' && (
                              <button type="button" onClick={() => onReject(u.username)}
                                className="px-3.5 h-9 text-xs font-bold flex items-center gap-1.5 text-rose-50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                style={REJECT_PILL}>
                                {u.status === 'approved' ? <Undo2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                {u.status === 'approved' ? (ar ? 'سحب الصلاحية' : 'Revoke') : (ar ? 'رفض' : 'Decline')}
                              </button>
                            )}
                            <button type="button" onClick={() => onDelete(u.username)}
                              className="h-9 w-9 flex items-center justify-center text-white/70 hover:text-rose-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                              style={PILL} title={ar ? 'حذف الحساب' : 'Delete account'} aria-label={ar ? 'حذف الحساب' : 'Delete account'}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default TesterApprovalCenter;

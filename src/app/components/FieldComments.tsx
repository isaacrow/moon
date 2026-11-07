/**
 * Comments and suggestions on a record's fields: a 💬 button beside every field in the editor, showing how
 * many open comments it has; clicking opens the thread, where the reviewer and the cataloger write and
 * resolve. Anyone else signed in can "suggest a change" there (a new value and why); the record's cataloger
 * or a reviewer accepts it (the value goes into the field, to be saved as usual) or declines it (Phase 13 S4).
 * Only shown on saved records (the editor provides RecordCommentsContext once a record has an id).
 */
import React, { createContext, useContext, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MessageSquare, Check, RotateCcw, Send, Lightbulb, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { moonFetch } from "../utils/moonApi";
import { UserAvatar } from './UserAvatar';
import { fieldText, withSuggested } from "../utils/fieldSuggestion";

export interface FieldComment {
  id: number;
  field: string;
  body: string;
  author: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  suggested?: string | null;
  decision?: "accepted" | "declined" | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
}

interface RecordComments {
  recordId: string;
  comments: FieldComment[];
  mayWrite: boolean;
  reload: () => Promise<void>;
}

export const RecordCommentsContext = createContext<RecordComments | null>(null);

/** Loads a record's comments for the editor; null until the record has been saved. */
export function useRecordComments(recordId: string | undefined): RecordComments | null {
  const [state, setState] = useState<{ comments: FieldComment[]; mayWrite: boolean }>({ comments: [], mayWrite: false });
  const reload = React.useCallback(async () => {
    if (!recordId) return;
    const { ok, data } = await moonFetch(`/records/${encodeURIComponent(recordId)}/comments`).catch(() => ({ ok: false, data: null as any }));
    if (ok && data) setState({ comments: data.comments || [], mayWrite: !!data.mayWrite });
  }, [recordId]);
  React.useEffect(() => { reload(); }, [reload]);
  return React.useMemo(() => (recordId ? { recordId, ...state, reload } : null), [recordId, state, reload]);
}

const when = (iso: string, ar: boolean) =>
  new Date(iso).toLocaleString(ar ? "ar-IQ" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const inputStyle: React.CSSProperties = { background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" };

interface Props {
  field: string;
  label: string;
  /** The field's value now (to start a suggestion from it) and how to put an accepted suggestion in. */
  value?: unknown;
  onApply?: (value: unknown) => void;
}

export function FieldComments({ field, label, value, onApply }: Props) {
  const ctx = useContext(RecordCommentsContext);
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const [text, setText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!ctx) return null;

  const thread = ctx.comments.filter((c) => c.field === field);
  const open = thread.filter((c) => !c.resolvedAt);
  const openSuggestions = open.filter((c) => c.suggested);
  const resolved = thread.length > 0 && open.length === 0;
  const path = `/records/${encodeURIComponent(ctx.recordId)}`;

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { ok, data } = await moonFetch(`${path}/comments`, { body: { field, body: text } });
    setBusy(false);
    if (!ok) return setError(data?.error || t("تعذّر الإرسال", "Could not send"));
    setText("");
    setError(null);
    await ctx.reload();
  };
  const setResolved = async (v: boolean) => {
    setBusy(true);
    const { ok, data } = await moonFetch(`${path}/comments/${thread[0].id}/resolve`, { body: { resolved: v } });
    setBusy(false);
    if (!ok) return setError(data?.error || t("تعذّر التحديث", "Could not update"));
    await ctx.reload();
  };
  const startSuggesting = () => {
    setSuggested(fieldText(value) ?? "");
    setWhy("");
    setSuggesting(true);
  };
  const sendSuggestion = async () => {
    if (!suggested.trim() || !why.trim()) return;
    setBusy(true);
    const { ok, data } = await moonFetch(`${path}/suggestions`, { body: { field, value: suggested, body: why } });
    setBusy(false);
    if (!ok) return setError(data?.error || t("تعذّر الإرسال", "Could not send"));
    setSuggesting(false);
    setError(null);
    setNotice(t("أُرسل الاقتراح إلى مفهرس التسجيلة.", "Suggestion sent to the record's cataloger."));
    await ctx.reload();
  };
  const decide = async (c: FieldComment, accept: boolean) => {
    setBusy(true);
    const { ok, data } = await moonFetch(`${path}/suggestions/${c.id}/decide`, { body: { accept } });
    setBusy(false);
    if (!ok) return setError(data?.error || t("تعذّر التحديث", "Could not update"));
    setError(null);
    if (accept) {
      const next = onApply ? withSuggested(value, c.suggested || "") : null;
      if (next !== null && onApply) {
        onApply(next);
        setNotice(t("وُضعت القيمة في الحقل. احفظ التسجيلة لتثبيتها.", "The value is in the field. Save the record to keep it."));
      } else {
        setNotice(t("قُبل الاقتراح. هذا الحقل ليس نصاً بسيطاً، فضع القيمة بنفسك.", "Accepted. This field is not plain text, so put the value in by hand."));
      }
    } else {
      setNotice(null);
    }
    await ctx.reload();
  };

  return (
    <Popover.Root onOpenChange={(o) => { if (!o) { setNotice(null); setSuggesting(false); } }}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={t(`تعليقات واقتراحات: ${label}`, `Comments and suggestions: ${label}`)}
          className={`absolute -top-1 z-10 h-6 min-w-6 px-1 rounded-full flex items-center justify-center gap-0.5 text-[10px] font-bold shadow-lg transition-all ${
            open.length ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
          style={{
            insetInlineEnd: "26px",
            background: openSuggestions.length ? "#8b5cf6" : open.length ? "#f59e0b" : resolved ? "rgba(52,211,153,0.9)" : "rgba(59,130,246,0.9)",
            border: "2px solid rgba(255,255,255,0.8)",
            color: "#fff",
          }}
        >
          {openSuggestions.length ? <Lightbulb className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
          {open.length > 0 && <span>{open.length}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[200] w-80 rounded-2xl p-3 shadow-2xl"
          style={{ background: "rgba(15,23,42,0.97)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff" }}
          dir={ar ? "rtl" : "ltr"}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{label}</span>
            {ctx.mayWrite && thread.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setResolved(!resolved)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold hover:bg-white/10 disabled:opacity-50"
              >
                {resolved ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                {resolved ? t("إعادة فتح", "Reopen") : t("تم الحل", "Resolve")}
              </button>
            )}
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {thread.length === 0 && <p className="text-xs text-white/60">{t("لا تعليقات على هذا الحقل.", "No comments on this field.")}</p>}
            {thread.map((c) => (
              <div key={c.id} className={`rounded-xl p-2 text-xs ${c.resolvedAt && !c.suggested ? "opacity-60" : ""}`} style={{ background: c.suggested ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.07)" }}>
                <div className="mb-0.5 flex justify-between gap-2 text-[10px] text-white/60">
                  <span className="flex items-center gap-1.5 font-bold text-white/80"><UserAvatar username={c.author} size={18} />{c.author}</span>
                  <span>{when(c.createdAt, ar)}</span>
                </div>
                {c.suggested && (
                  <div className="mb-1 rounded-lg px-2 py-1" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <div className="text-[10px] font-bold text-violet-200">{t("يقترح:", "Suggests:")}</div>
                    <div className="whitespace-pre-wrap break-words font-semibold" dir="auto">{c.suggested}</div>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words" dir="auto">{c.body}</div>
                {c.suggested && c.decision && (
                  <div className={`mt-1 text-[10px] font-bold ${c.decision === "accepted" ? "text-emerald-300" : "text-rose-300"}`}>
                    {c.decision === "accepted" ? t(`قبله ${c.decidedBy}`, `Accepted by ${c.decidedBy}`) : t(`رفضه ${c.decidedBy}`, `Declined by ${c.decidedBy}`)}
                  </div>
                )}
                {c.suggested && !c.decision && ctx.mayWrite && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy} onClick={() => decide(c, true)} className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold disabled:opacity-50">
                      <Check className="h-3 w-3" /> {t("اقبل", "Accept")}
                    </button>
                    <button type="button" disabled={busy} onClick={() => decide(c, false)} className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold hover:bg-white/10 disabled:opacity-50">
                      <X className="h-3 w-3" /> {t("ارفض", "Decline")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {ctx.mayWrite && (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
                rows={2}
                maxLength={2000}
                dir="auto"
                placeholder={t("اكتب ما يجب تصحيحه…", "What should change here…")}
                className="flex-1 resize-none rounded-xl px-2 py-1.5 text-xs outline-none"
                style={inputStyle}
              />
              <button type="button" disabled={busy || !text.trim()} onClick={send} aria-label={t("إرسال", "Send")} className="rounded-xl p-2 hover:bg-white/10 disabled:opacity-40">
                <Send className={`h-4 w-4 ${ar ? "-scale-x-100" : ""}`} />
              </button>
            </div>
          )}
          {!ctx.mayWrite && !suggesting && (
            <button type="button" onClick={startSuggesting} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold" style={{ background: "rgba(139,92,246,0.35)" }}>
              <Lightbulb className="h-3.5 w-3.5" /> {t("اقترح تعديلاً", "Suggest a change")}
            </button>
          )}
          {!ctx.mayWrite && suggesting && (
            <div className="mt-2 space-y-1.5">
              <label className="block text-[10px] font-bold text-white/70">{t("القيمة المقترحة", "Suggested value")}</label>
              <textarea value={suggested} onChange={(e) => setSuggested(e.target.value)} rows={2} maxLength={4000} dir="auto" className="w-full resize-none rounded-xl px-2 py-1.5 text-xs outline-none" style={inputStyle} />
              <label className="block text-[10px] font-bold text-white/70">{t("لماذا؟", "Why?")}</label>
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} maxLength={2000} dir="auto" placeholder={t("مثلاً: صفحة العنوان تقول…", "e.g. the title page says…")} className="w-full resize-none rounded-xl px-2 py-1.5 text-xs outline-none" style={inputStyle} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSuggesting(false)} className="rounded-full px-3 py-1 text-[11px] font-semibold hover:bg-white/10">{t("إلغاء", "Cancel")}</button>
                <button type="button" disabled={busy || !suggested.trim() || !why.trim()} onClick={sendSuggestion} className="rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold disabled:opacity-40">{t("أرسل الاقتراح", "Send suggestion")}</button>
              </div>
            </div>
          )}
          {notice && <p className="mt-2 text-[11px] text-emerald-300">{notice}</p>}
          {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

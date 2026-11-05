/**
 * Comments on a record's fields: a 💬 button beside every field in the editor, showing how many open
 * comments it has; clicking opens the thread, where the reviewer and the cataloger write and resolve.
 * Only shown on saved records (the editor provides RecordCommentsContext once a record has an id).
 */
import React, { createContext, useContext, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MessageSquare, Check, RotateCcw, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { moonFetch } from "../utils/moonApi";
import { UserAvatar } from './UserAvatar';

export interface FieldComment {
  id: number;
  field: string;
  body: string;
  author: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
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

export function FieldComments({ field, label }: { field: string; label: string }) {
  const ctx = useContext(RecordCommentsContext);
  const { i18n } = useTranslation();
  const ar = i18n.language === "ar";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ctx) return null;

  const thread = ctx.comments.filter((c) => c.field === field);
  const open = thread.filter((c) => !c.resolvedAt);
  const resolved = thread.length > 0 && open.length === 0;
  const path = `/records/${encodeURIComponent(ctx.recordId)}/comments`;

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const { ok, data } = await moonFetch(path, { body: { field, body: text } });
    setBusy(false);
    if (!ok) return setError(data?.error || (ar ? "تعذّر الإرسال" : "Could not send"));
    setText("");
    setError(null);
    await ctx.reload();
  };
  const setResolved = async (value: boolean) => {
    setBusy(true);
    const { ok, data } = await moonFetch(`${path}/${thread[0].id}/resolve`, { body: { resolved: value } });
    setBusy(false);
    if (!ok) return setError(data?.error || (ar ? "تعذّر التحديث" : "Could not update"));
    await ctx.reload();
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={ar ? `تعليقات: ${label}` : `Comments: ${label}`}
          className={`absolute -top-1 z-10 h-6 min-w-6 px-1 rounded-full flex items-center justify-center gap-0.5 text-[10px] font-bold shadow-lg transition-all ${
            open.length ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
          }`}
          style={{
            insetInlineEnd: "26px",
            background: open.length ? "#f59e0b" : resolved ? "rgba(52,211,153,0.9)" : "rgba(59,130,246,0.9)",
            border: "2px solid rgba(255,255,255,0.8)",
            color: "#fff",
          }}
        >
          <MessageSquare className="h-3 w-3" />
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
                {resolved ? (ar ? "إعادة فتح" : "Reopen") : ar ? "تم الحل" : "Resolve"}
              </button>
            )}
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {thread.length === 0 && <p className="text-xs text-white/60">{ar ? "لا تعليقات على هذا الحقل." : "No comments on this field."}</p>}
            {thread.map((c) => (
              <div key={c.id} className={`rounded-xl p-2 text-xs ${c.resolvedAt ? "opacity-60" : ""}`} style={{ background: "rgba(255,255,255,0.07)" }}>
                <div className="mb-0.5 flex justify-between gap-2 text-[10px] text-white/60">
                  <span className="flex items-center gap-1.5 font-bold text-white/80"><UserAvatar username={c.author} size={18} />{c.author}</span>
                  <span>{when(c.createdAt, ar)}</span>
                </div>
                <div className="whitespace-pre-wrap break-words" dir="auto">{c.body}</div>
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
                placeholder={ar ? "اكتب ما يجب تصحيحه…" : "What should change here…"}
                className="flex-1 resize-none rounded-xl px-2 py-1.5 text-xs outline-none"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}
              />
              <button
                type="button"
                disabled={busy || !text.trim()}
                onClick={send}
                aria-label={ar ? "إرسال" : "Send"}
                className="rounded-xl p-2 hover:bg-white/10 disabled:opacity-40"
              >
                <Send className={`h-4 w-4 ${ar ? "-scale-x-100" : ""}`} />
              </button>
            </div>
          )}
          {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

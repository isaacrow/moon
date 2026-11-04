/**
 * History tab of the editor: every saved version of the record, what changed in each one (or between it
 * and the current version), and reverting to an earlier version.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { History, RotateCcw, Loader2, ArrowRight } from "lucide-react";
import { fetchVersion, fetchVersions, revertToVersion, HistoryError, type RecordVersion, type RecordVersionSummary } from "../utils/recordHistory";
import { diffRecords, type DiffEntry } from "../utils/recordDiff";

interface Theme {
  accent: string; success: string; warning: string; danger: string;
  text: string; textMuted: string; textDim: string; cardBorder: string; inputBg: string;
}

interface Props {
  recordId: string;
  theme: Theme;
  language: "en" | "ar";
  hasUnsavedChanges: boolean;
  /** Called after a revert with the new version number, so the editor can reload the record. */
  onReverted: (version: number) => void;
}

type Compare = "previous" | "current";

const L = {
  en: {
    title: "Version history", loading: "Loading history…", empty: "Save the record to start its history.",
    signIn: "Sign in to see this record's history.", current: "current", by: "by",
    previous: "What changed in this version", vsCurrent: "Compared with the current version",
    firstVersion: "This is the first version: there is nothing earlier to compare it with.",
    sameAsCurrent: "This is the current version.", noChanges: "No field changed.",
    field: "Field", revert: "Revert to this version", reverting: "Reverting…",
    confirm: (v: number, unsaved: boolean) => `Make version ${v} the current version again? It is saved as a new version, so nothing in the history is lost.${unsaved ? "\n\nYour unsaved edits in the editor will be discarded." : ""}`,
    reverted: (v: number, n: number) => `Reverted to version ${v} (saved as version ${n})`,
    notes: { save: "Saved", approve: "Approved", return: "Returned for changes", migrated: "Copied from the old storage", synced: "Synced from the old storage", revert: (v: string) => `Reverted to v${v}` },
    status: { complete: "Published", "pending-review": "Pending review", "needs-review": "Returned" } as Record<string, string>,
    added: "added", removed: "removed",
  },
  ar: {
    title: "سجل الإصدارات", loading: "جارٍ تحميل السجل…", empty: "احفظ التسجيلة ليبدأ سجل إصداراتها.",
    signIn: "سجّل الدخول لعرض سجل هذه التسجيلة.", current: "الحالي", by: "بواسطة",
    previous: "ما الذي تغيّر في هذا الإصدار", vsCurrent: "مقارنة بالإصدار الحالي",
    firstVersion: "هذا هو الإصدار الأول: لا يوجد إصدار سابق للمقارنة.",
    sameAsCurrent: "هذا هو الإصدار الحالي.", noChanges: "لم يتغيّر أي حقل.",
    field: "الحقل", revert: "الرجوع إلى هذا الإصدار", reverting: "جارٍ الرجوع…",
    confirm: (v: number, unsaved: boolean) => `هل تريد جعل الإصدار ${v} هو الإصدار الحالي مجددًا؟ يُحفظ كإصدار جديد، فلا يضيع شيء من السجل.${unsaved ? "\n\nستُفقد تعديلاتك غير المحفوظة في المحرر." : ""}`,
    reverted: (v: number, n: number) => `تم الرجوع إلى الإصدار ${v} (حُفظ كإصدار ${n})`,
    notes: { save: "حفظ", approve: "اعتماد", return: "إعادة للتعديل", migrated: "نُسخ من التخزين القديم", synced: "مُزامن من التخزين القديم", revert: (v: string) => `رجوع إلى الإصدار ${v}` },
    status: { complete: "منشور", "pending-review": "قيد المراجعة", "needs-review": "معاد للتعديل" } as Record<string, string>,
    added: "أُضيف", removed: "حُذف",
  },
};

function noteLabel(note: string | undefined, l: typeof L.en): string {
  if (!note || note === "save") return l.notes.save;
  if (note === "approve") return l.notes.approve;
  if (note === "return") return l.notes.return;
  if (note === "migrated from kv_store") return l.notes.migrated;
  if (note === "synced from kv_store") return l.notes.synced;
  const m = note.match(/^revert to v(\d+)$/);
  return m ? l.notes.revert(m[1]) : note;
}

function formatDate(iso: string, language: "en" | "ar"): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(language === "ar" ? "ar-IQ" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function RecordHistoryPanel({ recordId, theme, language, hasUnsavedChanges, onReverted }: Props) {
  const l = L[language] || L.en;
  const [versions, setVersions] = useState<RecordVersionSummary[] | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [compare, setCompare] = useState<Compare>("previous");
  const [docs, setDocs] = useState<Record<number, RecordVersion>>({});
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [reverting, setReverting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const h = await fetchVersions(recordId);
      setVersions(h.versions);
      setCurrent(h.current);
      setSelected((s) => s ?? h.versions[0]?.version ?? null);
    } catch (e) {
      setVersions([]);
      setError(e instanceof HistoryError && e.status === 401 ? l.signIn : e instanceof HistoryError && e.status === 404 ? null : (e as Error).message);
    }
  }, [recordId, l.signIn]);

  useEffect(() => { load(); }, [load]);

  // The two versions the diff needs: the selected one and either the one before it or the current one.
  const other = selected === null ? null : compare === "current" ? current : selected > 1 ? selected - 1 : null;
  useEffect(() => {
    if (selected === null) return;
    const needed = [...new Set([selected, other])].filter((v): v is number => v !== null && !docs[v]);
    if (needed.length === 0) return;
    let cancelled = false;
    setLoadingDiff(true);
    Promise.all(needed.map((v) => fetchVersion(recordId, v)))
      .then((got) => { if (!cancelled) setDocs((d) => ({ ...d, ...Object.fromEntries(got.map((g) => [g.version, g])) })); })
      .catch((e) => { if (!cancelled) toast.error((e as Error).message); })
      .finally(() => { if (!cancelled) setLoadingDiff(false); });
    return () => { cancelled = true; };
  }, [recordId, selected, other, docs]);

  const diff: DiffEntry[] | null = useMemo(() => {
    if (selected === null || other === null || other === selected) return null;
    const a = docs[compare === "current" ? selected : other];
    const b = docs[compare === "current" ? other : selected];
    return a && b ? diffRecords(a.document, b.document) : null;
  }, [docs, selected, other, compare]);

  const doRevert = async (v: number) => {
    if (!window.confirm(l.confirm(v, hasUnsavedChanges))) return;
    setReverting(true);
    try {
      const r = await revertToVersion(recordId, v);
      toast.success(l.reverted(v, r.version));
      onReverted(r.version);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReverting(false);
    }
  };

  const muted = { color: theme.textMuted };
  const dim = { color: theme.textDim };
  const statusColor = (s: string) => (s === "complete" ? theme.success : s === "needs-review" ? theme.danger : theme.warning);

  if (versions === null) {
    return <div className="liquid-glass-card p-6 flex items-center gap-2 text-sm" style={muted}><Loader2 className="h-4 w-4 animate-spin" /> {l.loading}</div>;
  }
  if (error || versions.length === 0) {
    return <div className="liquid-glass-card p-6 text-sm" style={muted}>{error || l.empty}</div>;
  }

  const sel = versions.find((v) => v.version === selected);
  // Labels for the two columns, oldest on the left.
  const leftLabel = compare === "current" ? `v${selected}` : `v${other}`;
  const rightLabel = compare === "current" ? `v${current} (${l.current})` : `v${selected}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,320px)_1fr] gap-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="liquid-glass-card p-4 space-y-1 self-start">
        <h3 className="text-sm font-black flex items-center gap-2 mb-2" style={{ color: theme.text }}>
          <History className="h-4 w-4" style={{ color: theme.accent }} /> {l.title}
        </h3>
        {versions.map((v) => {
          const isSel = v.version === selected;
          return (
            <button
              type="button"
              key={v.version}
              onClick={() => setSelected(v.version)}
              className="w-full text-start rounded-xl px-3 py-2 transition-colors cursor-pointer"
              style={{ background: isSel ? "rgba(255,255,255,0.18)" : "transparent", border: `1px solid ${isSel ? theme.cardBorder : "transparent"}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black" style={{ color: theme.text }}>
                  v{v.version} · {noteLabel(v.note, l)}
                </span>
                {v.version === current && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}>{l.current}</span>
                )}
              </div>
              <div className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={dim}>
                <span style={{ color: statusColor(v.status) }}>●</span>
                <span>{l.status[v.status] || v.status}</span>
                {v.savedBy && <span>· {l.by} {v.savedBy}</span>}
              </div>
              <div className="text-[11px]" style={dim}>{formatDate(v.savedAt, language)}</div>
            </button>
          );
        })}
      </div>

      <div className="liquid-glass-card p-5 space-y-4 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-black" style={{ color: theme.text }}>
              v{sel?.version} · {noteLabel(sel?.note, l)}
            </h3>
            <p className="text-xs mt-0.5" style={dim}>
              {sel?.title}{sel?.savedBy ? ` · ${l.by} ${sel.savedBy}` : ""}{sel ? ` · ${formatDate(sel.savedAt, language)}` : ""}
            </p>
          </div>
          {selected !== null && selected !== current && (
            <button
              type="button"
              disabled={reverting}
              onClick={() => doRevert(selected)}
              className="glass-bubble-pill flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer hover:scale-105 active:scale-95 shadow-md transition-all disabled:opacity-60"
            >
              {reverting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              <span>{reverting ? l.reverting : l.revert}</span>
            </button>
          )}
        </div>

        <div className="inline-flex rounded-xl p-0.5" style={{ background: theme.inputBg, border: `1px solid ${theme.cardBorder}` }}>
          {(["previous", "current"] as Compare[]).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCompare(c)}
              className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              style={{ background: compare === c ? "rgba(255,255,255,0.2)" : "transparent", color: compare === c ? theme.text : theme.textDim }}
            >
              {c === "previous" ? l.previous : l.vsCurrent}
            </button>
          ))}
        </div>

        {other === null ? (
          <p className="text-sm" style={muted}>{l.firstVersion}</p>
        ) : other === selected ? (
          <p className="text-sm" style={muted}>{l.sameAsCurrent}</p>
        ) : loadingDiff || !diff ? (
          <div className="flex items-center gap-2 text-sm" style={muted}><Loader2 className="h-4 w-4 animate-spin" /> {l.loading}</div>
        ) : diff.length === 0 ? (
          <p className="text-sm" style={muted}>{l.noChanges}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr style={dim}>
                  <th className="text-start font-bold py-2 pe-3">{l.field}</th>
                  <th className="text-start font-bold py-2 pe-3">{leftLabel}</th>
                  <th className="w-4" />
                  <th className="text-start font-bold py-2">{rightLabel}</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d) => (
                  <tr key={d.field} className="align-top">
                    <td className="py-2 pe-3 font-mono text-[11px]" style={{ color: theme.textMuted, borderTop: `1px solid ${theme.cardBorder}` }} dir="ltr">{d.field}</td>
                    <td className="py-2 pe-3" style={{ borderTop: `1px solid ${theme.cardBorder}` }}>
                      {d.before.length ? d.before.map((v, i) => (
                        <div key={i} className="rounded-md px-1.5 py-0.5 mb-1 break-words" style={{ background: "rgba(248,113,113,0.12)", color: theme.text }}>{v}</div>
                      )) : <span style={dim}>— {l.added}</span>}
                    </td>
                    <td className="py-2" style={{ borderTop: `1px solid ${theme.cardBorder}` }}>
                      <ArrowRight className={`h-3 w-3 mt-1 ${language === "ar" ? "rotate-180" : ""}`} style={dim} />
                    </td>
                    <td className="py-2" style={{ borderTop: `1px solid ${theme.cardBorder}` }}>
                      {d.after.length ? d.after.map((v, i) => (
                        <div key={i} className="rounded-md px-1.5 py-0.5 mb-1 break-words" style={{ background: "rgba(52,211,153,0.14)", color: theme.text }}>{v}</div>
                      )) : <span style={dim}>— {l.removed}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecordHistoryPanel;

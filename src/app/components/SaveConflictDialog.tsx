/**
 * Shown when a save is refused because someone else saved the record first. Lists what differs between
 * their version and this cataloger's edits, then lets them keep their own edits (saved as the next
 * version; the other save stays in the history) or load the other version instead.
 */
import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Save, Download, X } from "lucide-react";
import { fetchVersion, type RecordVersion } from "../utils/recordHistory";
import { diffRecords } from "../utils/recordDiff";
import { RecordDiffTable, type DiffTableTheme } from "./RecordDiffTable";

export interface SaveConflict {
  currentVersion: number;
  savedBy?: string;
  savedAt?: string;
}

const L = {
  en: {
    title: "Someone saved this record while you were editing",
    body: (who: string, v: number) => `${who} saved version ${v}. Your edits are not saved yet. Compare, then choose which to keep.`,
    someone: "Someone else",
    theirs: (v: number) => `Their version (v${v})`, yours: "Your edits",
    same: "Your edits and their version are the same.",
    keepMine: "Keep my edits", keepMineHint: "Saved as the next version; theirs stays in the history",
    loadTheirs: "Load their version", loadTheirsHint: "Your unsaved edits are discarded",
    cancel: "Not now", loading: "Loading their version…",
  },
  ar: {
    title: "حفظ شخص آخر هذه التسجيلة أثناء تعديلك",
    body: (who: string, v: number) => `حفظ ${who} الإصدار ${v}. تعديلاتك لم تُحفظ بعد. قارن ثم اختر ما تبقيه.`,
    someone: "شخص آخر",
    theirs: (v: number) => `نسختهم (الإصدار ${v})`, yours: "تعديلاتك",
    same: "تعديلاتك ونسختهم متطابقتان.",
    keepMine: "إبقاء تعديلاتي", keepMineHint: "تُحفظ كإصدار جديد، وتبقى نسختهم في السجل",
    loadTheirs: "تحميل نسختهم", loadTheirsHint: "تُفقد تعديلاتك غير المحفوظة",
    cancel: "ليس الآن", loading: "جارٍ تحميل نسختهم…",
  },
};

export function SaveConflictDialog({ recordId, conflict, myDocument, theme, language, busy, onKeepMine, onLoadTheirs, onCancel }: {
  recordId: string;
  conflict: SaveConflict;
  myDocument: any;
  theme: DiffTableTheme;
  language: "en" | "ar";
  busy: boolean;
  onKeepMine: () => void;
  onLoadTheirs: () => void;
  onCancel: () => void;
}) {
  const l = L[language] || L.en;
  const [theirs, setTheirs] = useState<RecordVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVersion(recordId, conflict.currentVersion).then(setTheirs).catch((e) => setError((e as Error).message));
  }, [recordId, conflict.currentVersion]);

  const diff = useMemo(() => (theirs ? diffRecords(theirs.document, myDocument) : null), [theirs, myDocument]);
  const who = conflict.savedBy || theirs?.savedBy || l.someone;
  const btn = "glass-bubble-pill flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white cursor-pointer hover:scale-105 active:scale-95 shadow-md transition-all disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="liquid-glass-card flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 p-6" dir={language === "ar" ? "rtl" : "ltr"} style={{ background: "rgba(15,23,42,0.92)" }}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "#fbbf24" }} />
          <div className="flex-1">
            <h3 className="text-base font-black" style={{ color: theme.text }}>{l.title}</h3>
            <p className="mt-1 text-sm" style={{ color: theme.textMuted }}>{l.body(who, conflict.currentVersion)}</p>
          </div>
          <button type="button" onClick={onCancel} className="cursor-pointer rounded-lg p-1 hover:bg-white/10" aria-label={l.cancel}>
            <X className="h-4 w-4" style={{ color: theme.textDim }} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
          ) : !diff ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: theme.textMuted }}><Loader2 className="h-4 w-4 animate-spin" /> {l.loading}</div>
          ) : diff.length === 0 ? (
            <p className="text-sm" style={{ color: theme.textMuted }}>{l.same}</p>
          ) : (
            <RecordDiffTable diff={diff} leftLabel={l.theirs(conflict.currentVersion)} rightLabel={l.yours} theme={theme} language={language} />
          )}
        </div>

        <div className="flex flex-wrap items-start justify-end gap-3">
          <button type="button" className={btn} onClick={onCancel} disabled={busy}>{l.cancel}</button>
          <div className="flex flex-col items-center gap-1">
            <button type="button" className={btn} onClick={onLoadTheirs} disabled={busy}><Download className="h-3.5 w-3.5" /> {l.loadTheirs}</button>
            <span className="text-[10px]" style={{ color: theme.textDim }}>{l.loadTheirsHint}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button type="button" className={btn} onClick={onKeepMine} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {l.keepMine}
            </button>
            <span className="text-[10px]" style={{ color: theme.textDim }}>{l.keepMineHint}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SaveConflictDialog;

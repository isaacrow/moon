/** Side-by-side table of what changed between two versions of a record (see utils/recordDiff). */
import React from "react";
import { ArrowRight } from "lucide-react";
import type { DiffEntry } from "../utils/recordDiff";

export interface DiffTableTheme {
  text: string; textMuted: string; textDim: string; cardBorder: string;
}

const LABELS = {
  en: { field: "Field", added: "added", removed: "removed" },
  ar: { field: "الحقل", added: "أُضيف", removed: "حُذف" },
};

export function RecordDiffTable({ diff, leftLabel, rightLabel, theme, language }: {
  diff: DiffEntry[];
  leftLabel: string;
  rightLabel: string;
  theme: DiffTableTheme;
  language: "en" | "ar";
}) {
  const l = LABELS[language] || LABELS.en;
  const dim = { color: theme.textDim };
  const cell = { borderTop: `1px solid ${theme.cardBorder}` };
  return (
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
              <td className="py-2 pe-3 font-mono text-[11px]" style={{ ...cell, color: theme.textMuted }} dir="ltr">{d.field}</td>
              <td className="py-2 pe-3" style={cell}>
                {d.before.length ? d.before.map((v, i) => (
                  <div key={i} className="rounded-md px-1.5 py-0.5 mb-1 break-words" style={{ background: "rgba(248,113,113,0.12)", color: theme.text }}>{v}</div>
                )) : <span style={dim}>— {l.added}</span>}
              </td>
              <td className="py-2" style={cell}>
                <ArrowRight className={`h-3 w-3 mt-1 ${language === "ar" ? "rotate-180" : ""}`} style={dim} />
              </td>
              <td className="py-2" style={cell}>
                {d.after.length ? d.after.map((v, i) => (
                  <div key={i} className="rounded-md px-1.5 py-0.5 mb-1 break-words" style={{ background: "rgba(52,211,153,0.14)", color: theme.text }}>{v}</div>
                )) : <span style={dim}>— {l.removed}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

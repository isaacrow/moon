/** Banner over the editor when other catalogers have the same record open. */
import React from "react";
import { AlertTriangle } from "lucide-react";
import type { ActiveEditor } from "../utils/recordEditing";
import { UserAvatar } from "./UserAvatar";

function since(iso: string, language: "en" | "ar"): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (language === "ar") return minutes < 1 ? "الآن" : `منذ ${minutes} دقيقة`;
  return minutes < 1 ? "just now" : `for ${minutes} min`;
}

export function EditingWarning({ editors, language }: { editors: ActiveEditor[]; language: "en" | "ar" }) {
  if (editors.length === 0) return null;
  const [first, ...rest] = editors;
  const text = language === "ar"
    ? `تحذير: ${first.username} يعمل على هذه التسجيلة${rest.length ? ` (ومعه ${rest.map((e) => e.username).join("، ")})` : ""}`
    : `Warning: ${first.username} is working on this record${rest.length ? ` (with ${rest.map((e) => e.username).join(", ")})` : ""}`;
  const hint = language === "ar"
    ? "إذا حفظتما معًا فستُسأل أي النسختين تبقى، ولن يضيع أي حفظ من سجل الإصدارات."
    : "If you both save, you'll be asked which version to keep; no save is ever lost from the history.";
  return (
    <div
      role="status"
      dir={language === "ar" ? "rtl" : "ltr"}
      className="mx-auto mb-3 flex max-w-7xl items-center gap-3 rounded-2xl px-4 py-2.5"
      style={{ background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.45)" }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#fbbf24" }} />
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {editors.slice(0, 3).map((e) => <UserAvatar key={e.username} username={e.username} />)}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white">{text}</div>
        <div className="text-[11px] text-white/70">{since(first.since, language)} · {hint}</div>
      </div>
    </div>
  );
}

export default EditingWarning;

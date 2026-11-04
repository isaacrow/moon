/** Banner over the editor when other catalogers have the same record open. */
import React from "react";
import { AlertTriangle } from "lucide-react";
import type { ActiveEditor } from "../utils/recordEditing";

// Same colours and initials as the top bar's avatar, until profile pictures exist.
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6"];
export function userColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}
export function userInitials(name: string): string {
  // "ali.hassan" → AH, "MagdaGad" → MG
  const parts = name.trim().split(/[\s._-]+|(?=[A-Z])/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-md ring-2 ring-white/40"
      style={{ backgroundColor: userColor(name) }}
      title={name}
    >
      {userInitials(name)}
    </span>
  );
}

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
        {editors.slice(0, 3).map((e) => <Avatar key={e.username} name={e.username} />)}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white">{text}</div>
        <div className="text-[11px] text-white/70">{since(first.since, language)} · {hint}</div>
      </div>
    </div>
  );
}

export default EditingWarning;

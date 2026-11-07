/**
 * A small glass strip over the editor: who else has this record open right now (live), and a
 * switch to hide or show their cursors.
 */
import React from "react";
import { MousePointer2 } from "lucide-react";
import type { LivePeer } from "../utils/livePeers";
import { UserAvatar } from "./UserAvatar";

interface Props {
  people: LivePeer[];
  language: "en" | "ar";
  /** Light editor themes need dark text. */
  light?: boolean;
  cursorsShown?: boolean;
  onToggleCursors?: () => void;
}

export function LivePresence({ people, language, light = false, cursorsShown = true, onToggleCursors }: Props) {
  if (people.length === 0) return null;
  const ar = language === "ar";
  const names = people.map((p) => p.u);
  const shown = names.slice(0, 3).join(ar ? "، " : ", ");
  const more = names.length > 3 ? names.length - 3 : 0;
  const text = ar
    ? `هنا الآن: ${shown}${more ? ` و${more} آخرون` : ""}`
    : `Here now: ${shown}${more ? ` and ${more} more` : ""}`;
  const toggleLabel = cursorsShown ? (ar ? "إخفاء المؤشرات" : "Hide cursors") : (ar ? "إظهار المؤشرات" : "Show cursors");
  const fg = light ? "#1f2937" : "#ffffff";
  return (
    <div
      role="status"
      aria-live="polite"
      dir={ar ? "rtl" : "ltr"}
      className="mx-auto mb-3 flex w-fit max-w-7xl items-center gap-2.5 rounded-full py-1.5 ps-1.5 pe-2"
      style={{
        background: light ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.08)",
        border: light ? "1px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.18)",
        boxShadow: light ? "0 4px 16px rgba(0,0,0,0.08)" : undefined,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {people.slice(0, 5).map((p) => <UserAvatar key={p.id} username={p.u} size={26} />)}
      </div>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" style={{ background: "#34d399" }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#34d399" }} />
      </span>
      <span className="text-xs font-semibold" style={{ color: fg }}>{text}</span>
      {onToggleCursors && (
        <button
          type="button"
          onClick={onToggleCursors}
          aria-pressed={!cursorsShown}
          title={toggleLabel}
          className="ms-1 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
          style={{ color: fg, background: light ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.1)" }}
        >
          <MousePointer2 className="h-3 w-3" style={{ opacity: cursorsShown ? 1 : 0.5 }} />
          {toggleLabel}
        </button>
      )}
    </div>
  );
}

export default LivePresence;

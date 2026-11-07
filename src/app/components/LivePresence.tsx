/** A small glass strip over the editor: who else has this record open right now (live). */
import React from "react";
import type { LivePeer } from "../utils/livePeers";
import { UserAvatar } from "./UserAvatar";

export function LivePresence({ people, language }: { people: LivePeer[]; language: "en" | "ar" }) {
  if (people.length === 0) return null;
  const names = people.map((p) => p.u);
  const shown = names.slice(0, 3).join(language === "ar" ? "، " : ", ");
  const more = names.length > 3 ? names.length - 3 : 0;
  const text = language === "ar"
    ? `هنا الآن: ${shown}${more ? ` و${more} آخرون` : ""}`
    : `Here now: ${shown}${more ? ` and ${more} more` : ""}`;
  return (
    <div
      role="status"
      aria-live="polite"
      dir={language === "ar" ? "rtl" : "ltr"}
      className="mx-auto mb-3 flex w-fit max-w-7xl items-center gap-2.5 rounded-full py-1.5 ps-1.5 pe-4"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.18)",
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
      <span className="text-xs font-semibold text-white">{text}</span>
    </div>
  );
}

export default LivePresence;

/**
 * Field presence and soft locks (Phase 13 S4). Tells the room which field this cataloger is in (focus and
 * blur inside a [data-live-field]), draws a coloured ring with "Ali is editing Title" on each field
 * someone else is in, and, when you start typing in such a field, asks first: "Edit anyway?" (once per
 * field for the people there). Nothing is locked on the server: two people can still both edit; this only
 * makes it visible and deliberate. The rings are drawn on <body> (glass panels with backdrop blur would
 * carry "fixed" children with them) and follow the field as the page scrolls.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LiveRoomHandle } from "../utils/liveRoom";
import type { LivePeer } from "../utils/livePeers";
import { userColor } from "./UserAvatar";
import { findAnchor } from "../utils/liveCursors";
import { allowKey, applyFocusMessage, busyFields, editingLabel, fieldLabelFromKey, needsAsking, peopleInField, type FocusMap } from "../utils/liveFocus";

interface Props {
  room: LiveRoomHandle | null;
  peers: Record<string, LivePeer>;
  myUsername: string;
  language: "en" | "ar";
}

const fieldOf = (target: EventTarget | null): { key: string; el: Element } | null => {
  if (!(target instanceof Element)) return null;
  const el = target.closest("[data-live-field]");
  if (!el || !el.closest("[data-live-root]")) return null;
  const key = el.getAttribute("data-live-field");
  return key ? { key, el } : null;
};
const labelOf = (key: string) => findAnchor(key)?.getAttribute("data-live-label") || fieldLabelFromKey(key);
// Keys that change a field's text (not moving around in it).
const isTyping = (e: KeyboardEvent) =>
  !e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter");

export function LiveFieldPresence({ room, peers, myUsername, language }: Props) {
  const ar = language === "ar";
  const [focus, setFocus] = useState<FocusMap>({});
  const [ask, setAsk] = useState<{ key: string; people: LivePeer[] } | null>(null);
  const [, redraw] = useState(0);
  const mine = useRef<string | null>(null);
  const allowed = useRef(new Set<string>());
  const state = useRef({ focus, peers });
  state.current = { focus, peers };

  // Hear who is in which field; tell newcomers which field this cataloger is in.
  useEffect(() => {
    if (!room) return;
    const off = room.onMessage((msg) => {
      setFocus((f) => applyFocusMessage(f, msg));
      if (msg?.t === "join" && mine.current) room.send({ t: "focus", f: mine.current });
    });
    return () => { off(); setFocus({}); };
  }, [room]);

  // Tell the room when this cataloger enters or leaves a field; ask before typing in a busy one.
  useEffect(() => {
    if (!room) return;
    const onFocusIn = (e: FocusEvent) => {
      const field = fieldOf(e.target);
      if (!field || field.key === mine.current) return;
      mine.current = field.key;
      room.send({ t: "focus", f: field.key });
    };
    const onFocusOut = (e: FocusEvent) => {
      const from = fieldOf(e.target);
      const to = fieldOf(e.relatedTarget);
      if (!from || (to && to.key === from.key)) return;
      if (mine.current === from.key) { mine.current = null; room.send({ t: "blur", f: from.key }); }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isTyping(e)) return;
      const field = fieldOf(e.target);
      if (!field) return;
      const people = peopleInField(state.current.focus, state.current.peers, field.key, myUsername);
      if (!needsAsking(people, field.key, allowed.current)) return;
      e.preventDefault();
      e.stopPropagation();
      setAsk({ key: field.key, people });
    };
    const leave = () => { if (mine.current) { room.send({ t: "blur" }); mine.current = null; } };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", leave);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", leave);
      leave();
    };
  }, [room, myUsername]);

  const busy = busyFields(focus, peers, myUsername);

  // Keep the rings on their fields while the page scrolls or resizes.
  useEffect(() => {
    if (busy.size === 0) return;
    const again = () => redraw((n) => n + 1);
    window.addEventListener("scroll", again, true);
    window.addEventListener("resize", again);
    const timer = window.setInterval(again, 500); // fields that move without a scroll (folding, typing)
    return () => { window.removeEventListener("scroll", again, true); window.removeEventListener("resize", again); window.clearInterval(timer); };
  }, [busy.size]);

  if (busy.size === 0 && !ask) return null;

  const answer = (go: boolean) => {
    if (!ask) return;
    if (go) {
      for (const p of ask.people) allowed.current.add(allowKey(ask.key, p.u));
      const el = findAnchor(ask.key)?.querySelector<HTMLElement>("input, textarea, [contenteditable='true']");
      el?.focus();
    }
    setAsk(null);
  };

  return createPortal(
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
        {[...busy.entries()].map(([key, people]) => {
          const el = findAnchor(key);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
          const color = userColor(people[0].u);
          return (
            <div key={key} className="absolute" style={{ left: r.left - 4, top: r.top - 4, width: r.width + 8, height: r.height + 8 }}>
              <div className="absolute inset-0" style={{ border: `2px solid ${color}`, borderRadius: 14, boxShadow: `0 0 0 4px ${color}22` }} />
              <div
                dir={ar ? "rtl" : "ltr"}
                className="absolute whitespace-nowrap px-2.5 py-0.5 text-[11px] font-semibold text-white"
                style={{ top: -12, insetInlineStart: 12, background: color, borderRadius: 12, border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}
              >
                {editingLabel(people.map((p) => p.u), labelOf(key), ar)}
              </div>
            </div>
          );
        })}
      </div>
      {ask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.25)" }} onClick={() => answer(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="live-ask-title"
            dir={ar ? "rtl" : "ltr"}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm p-5 text-slate-800"
            style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.9)", borderRadius: 16, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 12px 40px rgba(0,0,0,0.2)" }}
          >
            <p id="live-ask-title" className="text-sm font-bold">{editingLabel(ask.people.map((p) => p.u), labelOf(ask.key), ar)}</p>
            <p className="mt-1 text-xs text-slate-600">
              {ar ? "إن حرّرتما الحقل معاً قد يكتب أحدكما فوق الآخر. هل تريد التحرير على أي حال؟" : "If you both edit this field, one of you may write over the other. Edit anyway?"}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => answer(false)} className="rounded-full px-4 py-1.5 text-xs font-semibold hover:bg-white/60">
                {ar ? "انتظر" : "Wait"}
              </button>
              <button type="button" onClick={() => answer(true)} className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white">
                {ar ? "حرّر على أي حال" : "Edit anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

export default LiveFieldPresence;

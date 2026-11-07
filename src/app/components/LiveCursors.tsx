/**
 * Live cursors with names: the other catalogers' pointers over the editor, each with a glass name
 * pill under it, gliding smoothly (the pill trails a little behind). Positions are pinned to fields
 * (see utils/liveCursors.ts), so an arrow lands on the same field on every screen. This component also
 * sends this cataloger's own pointer to the room, only while someone else is there to see it.
 * Your own arrow is never drawn; reduced motion makes arrows jump instead of glide; a pointer still
 * for half a minute fades away.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LiveRoomHandle } from "../utils/liveRoom";
import type { LivePeer } from "../utils/livePeers";
import { userColor } from "./UserAvatar";
import {
  anchorAt, applyCursorMessage, cursorOpacity, findAnchor, fromFraction, isSettled, shouldSend, springStep, toFraction,
  SEND_GAP_MS, type RemoteCursor, type SpringState,
} from "../utils/liveCursors";

interface Props {
  room: LiveRoomHandle | null;
  peers: Record<string, LivePeer>;
  myUsername: string;
  /** False when the cataloger chose to hide others' cursors. Their own pointer is still shared. */
  show: boolean;
}

const PILL_OFFSET = { x: 14, y: 20 };

export function LiveCursors({ room, peers, myUsername, show }: Props) {
  const cursors = useRef<Record<string, RemoteCursor>>({});
  const springs = useRef(new Map<string, { arrow: SpringState; pill: SpringState }>());
  const nodes = useRef(new Map<string, { arrow: HTMLDivElement | null; pill: HTMLDivElement | null }>());
  const [ids, setIds] = useState<string[]>([]);
  const othersHere = Object.values(peers).some((p) => p.u !== myUsername);
  const othersRef = useRef(othersHere);
  othersRef.current = othersHere;

  // Hear the room: cursor moves, pointers leaving, people leaving.
  useEffect(() => {
    if (!room) return;
    const off = room.onMessage((msg) => {
      const before = cursors.current;
      const after = applyCursorMessage(before, msg, Date.now());
      if (after === before) return;
      cursors.current = after;
      const next = Object.keys(after).sort();
      setIds((prev) => (prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next));
    });
    return () => { off(); cursors.current = {}; springs.current.clear(); setIds([]); };
  }, [room]);

  // Send this cataloger's pointer: the field under it and where inside, at most 20 times a second,
  // with a last send after the pointer stops so the others see where it came to rest.
  useEffect(() => {
    if (!room) return;
    let last: { f: string; x: number; y: number; at: number } | null = null;
    let inside = false;
    let trailing: number | undefined;
    const sendNow = (pos: { f: string; x: number; y: number }) => {
      room.send({ t: "cursor", ...pos });
      last = { ...pos, at: Date.now() };
    };
    const hide = () => {
      window.clearTimeout(trailing);
      if (inside) room.send({ t: "hide" });
      inside = false;
      last = null;
    };
    const onMove = (e: PointerEvent) => {
      if (!othersRef.current || e.pointerType === "touch") return;
      const anchor = anchorAt(e.target);
      if (!anchor) { hide(); return; }
      inside = true;
      const pos = { f: anchor.key, ...toFraction(anchor.el.getBoundingClientRect(), e.clientX, e.clientY) };
      window.clearTimeout(trailing);
      if (shouldSend(last, pos, Date.now())) sendNow(pos);
      else trailing = window.setTimeout(() => sendNow(pos), SEND_GAP_MS);
    };
    const onOut = (e: PointerEvent) => { if (!e.relatedTarget) hide(); };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", hide);
      hide();
    };
  }, [room]);

  // Draw: each frame, find each cursor's field on this page and glide the arrow and pill towards it.
  useEffect(() => {
    if (!show || ids.length === 0) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    let lastTime = performance.now();
    const tick = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      const now = Date.now();
      for (const id of ids) {
        const c = cursors.current[id];
        const node = nodes.current.get(id);
        if (!c || !node?.arrow || !node.pill) continue;
        const el = findAnchor(c.f);
        if (!el) { node.arrow.style.opacity = "0"; node.pill.style.opacity = "0"; continue; }
        const target = fromFraction(el.getBoundingClientRect(), c.x, c.y);
        let s = springs.current.get(id);
        if (!s) {
          s = { arrow: { x: target.x, y: target.y, vx: 0, vy: 0 }, pill: { x: target.x, y: target.y, vx: 0, vy: 0 } };
          springs.current.set(id, s);
        }
        // Reduced motion, or frames came slowly (a busy or background tab): jump instead of crawling.
        if (reduce || dt > 250) {
          s.arrow = { x: target.x, y: target.y, vx: 0, vy: 0 };
          s.pill = { ...s.arrow };
        } else {
          if (!isSettled(s.arrow, target.x, target.y)) s.arrow = springStep(s.arrow, target.x, target.y, dt);
          if (!isSettled(s.pill, target.x, target.y)) s.pill = springStep(s.pill, target.x, target.y, dt, 210, 24);
        }
        const opacity = String(cursorOpacity(c.at, now));
        node.arrow.style.opacity = opacity;
        node.pill.style.opacity = opacity;
        node.arrow.style.transform = `translate3d(${s.arrow.x}px, ${s.arrow.y}px, 0)`;
        node.pill.style.transform = `translate3d(${s.pill.x + PILL_OFFSET.x}px, ${s.pill.y + PILL_OFFSET.y}px, 0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ids, show]);

  if (!show) return null;
  const visible = ids.filter((id) => peers[id] && peers[id].u !== myUsername);
  if (visible.length === 0) return null;

  // Drawn on <body>: the editor sits inside glass panels with backdrop blur, and a blur makes "fixed"
  // children move with the panel instead of the screen.
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {visible.map((id) => {
        const name = peers[id].u;
        const color = userColor(name);
        const ref = (key: "arrow" | "pill") => (el: HTMLDivElement | null) => {
          const entry = nodes.current.get(id) || { arrow: null, pill: null };
          entry[key] = el;
          if (!entry.arrow && !entry.pill) nodes.current.delete(id);
          else nodes.current.set(id, entry);
        };
        return (
          <React.Fragment key={id}>
            <div ref={ref("arrow")} className="absolute left-0 top-0 will-change-transform" style={{ opacity: 0 }}>
              <svg width="20" height="22" viewBox="0 0 20 22" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))", transform: "translate(-2px, -2px)" }}>
                <path d="M2 2 L2 18 L6.6 13.8 L9.6 20.4 L12.6 19.1 L9.7 12.6 L16 12.4 Z" fill={color} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
            <div
              ref={ref("pill")}
              dir="auto"
              className="absolute left-0 top-0 whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold text-white will-change-transform"
              style={{
                opacity: 0,
                background: color,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.6)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {name}
            </div>
          </React.Fragment>
        );
      })}
    </div>,
    document.body,
  );
}

export default LiveCursors;

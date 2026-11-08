/**
 * A glossary pop-up (Phase 13 S22): a small "?" beside a field that says, in plain Arabic and English, what
 * the field is, and which MARC fields hold the same thing (from mooon.site/marc-where.json, made from Moon's
 * own converter). Opens on click or keyboard; closes with Escape, a click elsewhere, or scrolling. It is
 * placed over the page (a portal), next to the button and always inside the window, so no panel clips it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { glossaryEntry, marcFieldsFor, type MarcWhereField } from '../../services/glossary';

let tableLoad: Promise<MarcWhereField[]> | null = null;
const marcTable = () => (tableLoad ||= fetch('/marc-where.json').then((r) => (r.ok ? r.json() : [])).catch(() => []));
const WIDTH = 288;

export function GlossaryTip({ term, className = '', style }: { term: string; className?: string; style?: React.CSSProperties }) {
  const entry = glossaryEntry(term);
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [marc, setMarc] = useState<string[] | null>(null);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const r = box.current?.getBoundingClientRect();
    if (r) {
      const width = Math.min(WIDTH, window.innerWidth - 16);
      const left = Math.max(8, Math.min(ar ? r.left : r.right - width, window.innerWidth - width - 8));
      setAt({ top: r.bottom + 6, left, width });
    }
    if (marc === null) marcTable().then((t) => setMarc(marcFieldsFor(term, t)));
    const away = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!box.current?.contains(n) && !pop.current?.contains(n)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, marc, term, ar]);

  if (!entry) return null;
  return (
    <span ref={box} className={`inline-block ${className}`} style={{ position: 'relative', ...style }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        aria-label={ar ? `ما معنى «${entry.ar}»؟` : `What is "${entry.en}"?`}
        className="w-5 h-5 rounded-full text-[11px] font-black leading-5 text-center text-white/90 hover:text-white"
        style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)' }}>?</button>
      {open && at && createPortal(
        <span ref={pop} role="dialog" aria-label={ar ? entry.ar : entry.en} dir={ar ? 'rtl' : 'ltr'}
          className="block rounded-2xl p-3 text-start text-xs leading-5 text-slate-800 shadow-xl"
          style={{ position: 'fixed', zIndex: 400, top: at.top, left: at.left, width: at.width, background: 'rgba(255,255,255,0.97)', border: '1px solid #fff' }}>
          <b className="block text-sm text-slate-900">{ar ? entry.ar : entry.en} <span className="font-normal text-slate-500">· {ar ? entry.en : entry.ar}</span></b>
          <span className="block mt-1">{ar ? entry.defAr : entry.defEn}</span>
          {marc && marc.length > 0 && (
            <span className="block mt-2 text-[11px] text-slate-500">
              {ar ? 'في مارك: ' : 'In MARC: '}
              {marc.map((m) => <span key={m} dir="ltr" className="inline-block font-mono rounded bg-slate-100 px-1.5 me-1 mb-1">{m}</span>)}
              <a href="/marc.html" target="_blank" rel="noreferrer" className="underline">{ar ? 'المزيد' : 'more'}</a>
            </span>
          )}
        </span>,
        document.body,
      )}
    </span>
  );
}

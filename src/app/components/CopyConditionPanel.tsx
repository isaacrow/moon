/**
 * One copy's physical description (Phase 13 S24), with ARM 1.0 (Art and Rare Materials): its binding, its
 * condition, the marks on it (seals, stamps, bookplates, inscriptions, marginalia …, each with where it is)
 * and what was done to it (digitised, condition reviewed, retention committed, conserved), each with a date
 * and who: small events, not free notes, so the OPAC and shared-print programmes can use them.
 */
import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { MARK_KINDS, ITEM_ACTIONS, type CopyCondition, type Marking, type ItemAction } from '../../services/specialVocab';

interface Props { value: CopyCondition; ar: boolean; onChange: (next: CopyCondition) => void }

export function CopyConditionPanel({ value, ar, onChange }: Props) {
  const t = (a: string, e: string) => (ar ? a : e);
  const count = (value.binding ? 1 : 0) + (value.condition ? 1 : 0) + (value.marks?.length || 0) + (value.actions?.length || 0);
  const [open, setOpen] = useState(count > 0);
  const marks = value.marks || [];
  const actions = value.actions || [];
  const setMark = (i: number, p: Partial<Marking>) => onChange({ ...value, marks: marks.map((m, k) => (k === i ? { ...m, ...p } : m)) });
  const setAction = (i: number, p: Partial<ItemAction>) => onChange({ ...value, actions: actions.map((a, k) => (k === i ? { ...a, ...p } : a)) });
  const input = 'w-full min-w-0 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/50 outline-none focus:ring-1 focus:ring-white/60';
  const inputStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)' };
  const select = `${input} [&>option]:text-slate-900`;
  const small = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white hover:bg-white/20 border border-white/25';

  return (
    <div className="rounded-xl p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-xs font-bold text-white/90" aria-expanded={open}>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : (ar ? 'rotate-90' : '-rotate-90')}`} />
        {t('الوصف المادي للنسخة (التجليد، الحالة، الأختام، ما عُمل بها)', 'Physical description (binding, condition, marks, actions)')}
        {count > 0 && <span className="text-white/60 font-normal">({count})</span>}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className={input} style={inputStyle} dir="auto" value={value.binding || ''} placeholder={t('التجليد (جلد بني مذهّب، مع لسان)', 'Binding (gilt brown leather, with flap)')}
              aria-label={t('التجليد', 'Binding')} onChange={(e) => onChange({ ...value, binding: e.target.value })} />
            <input className={input} style={inputStyle} dir="auto" value={value.condition || ''} placeholder={t('الحالة (أثر أرضة، رطوبة، أوراق ناقصة)', 'Condition (wormholes, damp, leaves missing)')}
              aria-label={t('الحالة', 'Condition')} onChange={(e) => onChange({ ...value, condition: e.target.value })} />
          </div>

          {marks.map((m, i) => (
            <div key={`m${i}`} className="grid grid-cols-[8rem_1fr_6rem_auto] gap-2 items-center">
              <select className={select} style={inputStyle} value={m.kind} aria-label={t('نوع العلامة', 'Kind of mark')} onChange={(e) => setMark(i, { kind: e.target.value })}>
                {MARK_KINDS.map((k) => <option key={k.id} value={k.id}>{t(k.ar, k.en)}</option>)}
              </select>
              <input className={input} style={inputStyle} dir="auto" value={m.text} placeholder={t('ما فيها (نص الختم، صاحبه)', 'What it says or shows')} onChange={(e) => setMark(i, { text: e.target.value })} />
              <input className={input} style={inputStyle} dir="auto" value={m.place || ''} placeholder={t('موضعها (ق 1أ)', 'Where (f. 1r)')} onChange={(e) => setMark(i, { place: e.target.value })} />
              <button type="button" onClick={() => onChange({ ...value, marks: marks.filter((_, k) => k !== i) })} className="text-white/70 hover:text-white" aria-label={t('احذف', 'Remove')}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {actions.map((a, i) => (
            <div key={`a${i}`} className="grid grid-cols-[8rem_7rem_1fr_auto] gap-2 items-center">
              <select className={select} style={inputStyle} value={a.kind} aria-label={t('ما عُمل', 'Action')} onChange={(e) => setAction(i, { kind: e.target.value })}>
                {ITEM_ACTIONS.map((k) => <option key={k.id} value={k.id}>{t(k.ar, k.en)}</option>)}
              </select>
              <input className={input} style={inputStyle} type="date" value={a.date || ''} aria-label={t('التاريخ', 'Date')} onChange={(e) => setAction(i, { date: e.target.value })} />
              <input className={input} style={inputStyle} dir="auto" value={a.by || ''} placeholder={t('من قام به', 'Done by')} onChange={(e) => setAction(i, { by: e.target.value })} />
              <button type="button" onClick={() => onChange({ ...value, actions: actions.filter((_, k) => k !== i) })} className="text-white/70 hover:text-white" aria-label={t('احذف', 'Remove')}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={small} onClick={() => onChange({ ...value, marks: [...marks, { kind: 'seal', text: '' }] })}><Plus className="h-3 w-3" /> {t('ختم أو علامة', 'Seal or mark')}</button>
            <button type="button" className={small} onClick={() => onChange({ ...value, actions: [...actions, { kind: 'digitised', date: new Date().toISOString().slice(0, 10) }] })}><Plus className="h-3 w-3" /> {t('ما عُمل بها', 'Action')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

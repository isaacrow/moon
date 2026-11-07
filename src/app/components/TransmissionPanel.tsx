/**
 * A manuscript copy's notes as events (Phase 11): ijāzah, samāʿ, qirāʾa, copying, ownership, waqf. Each with
 * its people (picked from Moon, LC, VIAF or Wikidata, or made a Moon entity), place, date as written (read in
 * both calendars), where it is in the manuscript, and the note's words.
 */
import type { CSSProperties } from 'react';
import { Plus, Trash2, ScrollText, UserPlus } from 'lucide-react';
import { EVENT_KINDS, ROLES, newEvent, summary, type EventKind, type RoleKey, type TransmissionEvent } from '../../services/transmission';
import { readDate, bothCalendars } from '../../services/hijri';
import { MarcAuthorityInput } from './wolfmoon/MarcAuthorityInput';

interface Props {
  itemId: string;
  events: TransmissionEvent[];
  ar: boolean;
  onChange: (events: TransmissionEvent[]) => void;
}

const FIELD = 'w-full min-w-0 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:ring-1 focus:ring-white/60';
const FIELD_BG: CSSProperties = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)' };
const PERSON = { context: 'person' as const, entityKind: 'agent' as const, agentType: 'person' as const, linkable: true };
const PLACE = { context: 'place' as const, entityKind: 'place' as const, linkable: true };

export function TransmissionPanel({ itemId, events, ar, onChange }: Props) {
  const t = (a: string, e: string) => (ar ? a : e);
  const set = (i: number, patch: Partial<TransmissionEvent>) => onChange(events.map((e, k) => (k === i ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-2 rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <ScrollText className="h-4 w-4" />
          {t('إجازات وسماعات وتملّكات ووقفيات هذه النسخة', 'Ijāzāt, samāʿāt, ownership and waqf of this copy')}
          {events.length > 0 && <span className="text-white/60">({events.length})</span>}
        </div>
        <select value="" aria-label={t('أضف قيداً', 'Add a note')}
          onChange={(e) => { const k = e.target.value as EventKind; if (k) onChange([...events, newEvent(itemId, k)]); }}
          className="rounded-full px-3 py-1.5 text-xs font-bold text-white" style={FIELD_BG}>
          <option value="" className="text-slate-900">{t('+ أضف قيداً', '+ Add a note')}</option>
          {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => <option key={k} value={k} className="text-slate-900">{ar ? EVENT_KINDS[k].ar : EVENT_KINDS[k].en}</option>)}
        </select>
      </div>

      {events.map((ev, i) => {
        const reading = ev.date ? readDate(ev.date) : null;
        return (
          <div key={ev.id} className="space-y-2 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <select value={ev.kind} onChange={(e) => set(i, { kind: e.target.value as EventKind })} className="rounded-full px-3 py-1.5 text-xs font-bold text-white" style={FIELD_BG} aria-label={t('نوع القيد', 'Kind of note')}>
                {(Object.keys(EVENT_KINDS) as EventKind[]).map((k) => <option key={k} value={k} className="text-slate-900">{ar ? EVENT_KINDS[k].ar : EVENT_KINDS[k].en}</option>)}
              </select>
              <span className="flex-1 text-xs text-white/80" dir="auto">{summary(ev, ar)}</span>
              <button type="button" onClick={() => onChange(events.filter((_, k) => k !== i))} className="rounded-full p-1.5 text-white/80 hover:bg-white/20" aria-label={t('احذف القيد', 'Remove note')} title={t('احذف القيد', 'Remove note')}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* People in their roles */}
            {ev.participants.map((p, j) => (
              <div key={j} className="flex flex-wrap items-center gap-2">
                <select value={p.role} onChange={(e) => set(i, { participants: ev.participants.map((x, k) => (k === j ? { ...x, role: e.target.value as RoleKey } : x)) })}
                  className="w-44 shrink-0 rounded-lg px-2 py-2 text-xs text-white" style={FIELD_BG} aria-label={t('الدور', 'Role')}>
                  {(Object.keys(ROLES) as RoleKey[]).map((r) => <option key={r} value={r} className="text-slate-900">{ar ? ROLES[r].ar : ROLES[r].en}</option>)}
                </select>
                <MarcAuthorityInput value={p.label} spec={PERSON} ar={ar} className={FIELD} style={FIELD_BG}
                  placeholder={t('الاسم (يُقترح من Moon و LC و VIAF و Wikidata)', 'Name (suggested from Moon, LC, VIAF, Wikidata)')} ariaLabel={ar ? ROLES[p.role].ar : ROLES[p.role].en}
                  onChange={(v) => set(i, { participants: ev.participants.map((x, k) => (k === j ? { ...x, label: v, uri: undefined } : x)) })}
                  onPick={(r) => set(i, { participants: ev.participants.map((x, k) => (k === j ? { ...x, label: r.label, uri: r.uri || undefined } : x)) })} />
                {p.uri && <a href={p.uri} target="_blank" rel="noreferrer" className="text-[11px] text-sky-200 underline" dir="ltr">{t('مرتبط', 'linked')}</a>}
                <button type="button" onClick={() => set(i, { participants: ev.participants.filter((_, k) => k !== j) })} className="rounded-full p-1 text-white/60 hover:bg-white/20" aria-label={t('احذف الشخص', 'Remove person')}><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            <button type="button" onClick={() => set(i, { participants: [...ev.participants, { role: EVENT_KINDS[ev.kind].roles[EVENT_KINDS[ev.kind].roles.length - 1] || 'witness', label: '' }] })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-200 hover:underline">
              <UserPlus className="h-3.5 w-3.5" /> {t('أضف شخصاً', 'Add a person')}
            </button>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <MarcAuthorityInput value={ev.place?.label || ''} spec={PLACE} ar={ar} className={FIELD} style={FIELD_BG}
                placeholder={t('المكان (دمشق، بغداد…)', 'Place (Damascus, Baghdad…)')} ariaLabel={t('المكان', 'Place')}
                onChange={(v) => set(i, { place: v ? { label: v } : undefined })}
                onPick={(r) => set(i, { place: { label: r.label, ...(r.uri ? { uri: r.uri } : {}) } })} />
              <div>
                <input className={FIELD} style={FIELD_BG} dir="auto" value={ev.date || ''} onChange={(e) => set(i, { date: e.target.value })}
                  placeholder={t('التاريخ كما كُتب (رجب 645 هـ)', 'Date as written (Rajab 645 AH)')} aria-label={t('التاريخ', 'Date')} />
                {reading?.from !== undefined && <div className="mt-1 text-[11px] text-white/70" dir="auto">{bothCalendars(reading, ar)}</div>}
              </div>
              <input className={FIELD} style={FIELD_BG} dir="auto" value={ev.locator || ''} onChange={(e) => set(i, { locator: e.target.value })}
                placeholder={t('موضعه في المخطوط (الورقة 120ب)', 'Where in the manuscript (f. 120b)')} aria-label={t('الموضع', 'Locator')} />
            </div>
            <textarea className={FIELD} style={FIELD_BG} dir="auto" rows={2} value={ev.text || ''} onChange={(e) => set(i, { text: e.target.value })}
              placeholder={t('نص القيد كما هو في المخطوط', 'The note\'s words as in the manuscript')} aria-label={t('نص القيد', 'Transcription')} />
          </div>
        );
      })}

      {events.length === 0 && (
        <p className="text-xs text-white/60">{t('سجّل ما في هوامش هذه النسخة وقيودها: من أجاز بها ولمن، ومن سمعها وقرأها، ومن نسخها وتملّكها ووقفها.', 'Record what this copy\'s notes say: who licensed it to whom, who heard and read it, who copied, owned and endowed it.')}</p>
      )}
      {events.length > 0 && (
        <button type="button" onClick={() => onChange([...events, newEvent(itemId, events[events.length - 1].kind)])} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:underline">
          <Plus className="h-3.5 w-3.5" /> {t('قيد آخر من النوع نفسه', 'Another of the same kind')}
        </button>
      )}
    </div>
  );
}

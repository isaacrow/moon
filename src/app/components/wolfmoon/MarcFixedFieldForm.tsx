/**
 * The Leader or the 008, position by position: a list of codes where the position takes codes (with their
 * meaning in Arabic or English), a box where it takes a date, a country or a language code. Each change
 * writes the field back, so the text and the BIBFRAME follow at once.
 */
import { getPosition, setPosition, type Position } from '../../../services/marc/marcFixedFields';

interface Props {
  value: string;
  total: number;
  positions: Position[];
  ar: boolean;
  onChange: (next: string) => void;
}

const show = (s: string) => s.replace(/ /g, '#');
const pos = (p: Position) => (p.length === 1 ? String(p.start).padStart(2, '0') : `${String(p.start).padStart(2, '0')}–${String(p.start + p.length - 1).padStart(2, '0')}`);

export function MarcFixedFieldForm({ value, total, positions, ar, onChange }: Props) {
  const set = (p: Position, next: string) => onChange(setPosition(value, p, next, total));
  const select = 'w-full rounded bg-black/40 border border-white/10 px-1.5 py-1 text-[12px] text-white focus:outline-none focus:border-sky-400';

  return (
    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-black/20 p-3" dir={ar ? 'rtl' : 'ltr'}>
      {positions.map((p) => {
        const current = getPosition(value, p);
        const label = (
          <span className="block text-[11px] text-white/60 mb-0.5">
            <span className="font-mono text-sky-300" dir="ltr">/{pos(p)}</span> {ar ? p.ar : p.en}
          </span>
        );
        if (p.codes && p.multi) {
          // One list per character (008/18-21 illustrations, 24-27 nature of contents).
          return (
            <div key={p.start} className="md:col-span-2">
              {label}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {Array.from({ length: p.length }, (_, i) => {
                  const ch = current[i] ?? ' ';
                  return (
                    <select key={i} value={ch} className={select} aria-label={`${ar ? p.ar : p.en} ${i + 1}`}
                      onChange={(e) => set(p, current.slice(0, i) + e.target.value + current.slice(i + 1))}>
                      {!p.codes!.some((x) => x.code === ch) && <option value={ch}>{show(ch)} — ?</option>}
                      {p.codes!.map((x) => <option key={x.code} value={x.code}>{show(x.code)} — {ar ? x.ar : x.en}</option>)}
                    </select>
                  );
                })}
              </div>
            </div>
          );
        }
        if (p.codes) {
          return (
            <label key={p.start} className="block">
              {label}
              <select value={current} onChange={(e) => set(p, e.target.value)} className={select}>
                {!p.codes.some((x) => x.code === current) && <option value={current}>{show(current)} — {ar ? 'رمز غير صالح' : 'not a valid code'}</option>}
                {p.codes.map((x) => <option key={x.code} value={x.code}>{show(x.code)} — {ar ? x.ar : x.en}</option>)}
              </select>
            </label>
          );
        }
        return (
          <label key={p.start} className="block">
            {label}
            <input value={show(current)} maxLength={p.length} dir="ltr"
              onChange={(e) => set(p, e.target.value.replace(/#/g, ' '))}
              className={`${select} font-mono`} placeholder={p.hint} title={p.hint} />
          </label>
        );
      })}
    </div>
  );
}

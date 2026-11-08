/**
 * The maqām of a musical work (Phase 13 S24): a concept of Moon's maqām scheme given through BIBFRAME's own
 * bf:mode, not a genre or a new class. Shown only when the record is music.
 */
import React from 'react';
import { Music } from 'lucide-react';
import { MAQAMAT, maqamNode, maqamOf } from '../../services/specialVocab';

const MUSIC = /NotatedMusic|MusicAudio|Audio|\/(ntm|prm|spw|tcm)$|music|موسيقى|موسيقي/i;

/** Whether the Work is music (its type, its content type or its genre says so). */
export function isMusic(work: any): boolean {
  const vals = [work?.['@type'], work?.['bf:content'], work?.['bf:genreForm']].flat(2).filter(Boolean)
    .map((v: any) => (typeof v === 'string' ? v : [v?.['@id'], typeof v?.['rdfs:label'] === 'string' ? v['rdfs:label'] : ''].filter(Boolean).join(' ')));
  return vals.some((v: string) => MUSIC.test(v));
}

export function MaqamPanel({ work, language, onChange }: { work: any; language: string; onChange: (work: any) => void }) {
  const ar = language === 'ar';
  const current = maqamOf(work)?.id || '';
  const base = (String(work?.['@id'] || '').match(/^(.*)\/work\/[^/#]+$/)?.[1]) || 'https://mooon.site/resource';
  const choose = (id: string) => {
    const { 'bf:mode': _m, ...rest } = work || {};
    onChange(id ? { ...rest, 'bf:mode': maqamNode(base, id) } : rest);
  };
  const families = MAQAMAT.filter((m) => !m.broader);
  const box: React.CSSProperties = { borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)' };
  return (
    <div className="p-3 space-y-2" style={box} dir={ar ? 'rtl' : 'ltr'}>
      <label className="flex items-center gap-2 text-sm font-bold text-white">
        <Music className="h-4 w-4" /> {ar ? 'المقام' : 'Maqām'}
        <select value={current} onChange={(e) => choose(e.target.value)}
          className="ms-auto rounded-lg px-2.5 py-1.5 text-xs text-white outline-none [&>option]:text-slate-900 [&_optgroup]:text-slate-900"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <option value="">{ar ? '— بلا مقام —' : '— none —'}</option>
          {families.map((f) => (
            <optgroup key={f.id} label={ar ? `فصيلة ${f.ar}` : `${f.latn} family`}>
              {[f, ...MAQAMAT.filter((m) => m.broader === f.id)].map((m) => <option key={m.id} value={m.id}>{ar ? `${m.ar} (${m.latn})` : `${m.latn} (${m.ar})`}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-white/60">{ar ? 'يُسجَّل في bf:mode مرتبطاً بمفهوم من قائمة مقامات مون (mooon.site/resource/vocab/maqam).' : "Recorded as bf:mode, linked to a concept of Moon's maqām list (mooon.site/resource/vocab/maqam)."}</p>
    </div>
  );
}

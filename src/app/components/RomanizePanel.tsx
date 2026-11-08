/**
 * Romanization in Moon Studio: finds the record's Arabic titles, names, statements and places that have
 * no Latin form yet, asks LC's ScriptShifter for their ALA-LC romanization, and lets the cataloger check
 * and correct each one before adding it beside the Arabic (exported as "@ar-Arab" / "@ar-Latn").
 */
import React, { useState } from 'react';
import { Languages, Loader2, Check } from 'lucide-react';
import { findRomanizable, findArabizable, addRomanization, romanizeAll } from '../../services/romanize';
import { toArabicScript } from '../../services/alaLcToArabic';
import { MOON_API, moonHeaders } from '../utils/moonApi';

interface Props {
  work: any;
  instance: any;
  language: 'en' | 'ar' | string;
  onApply: (work: any, instance: any) => void;
}

/** One value to add: `source` is the text the record has, `value` the other script's form a person checks. */
interface Row { path: Array<string | number>; node: string; field: string; source: string; value: string; on: boolean }
type Direction = 'to-latin' | 'to-arabic';

const FIELD_AR: Record<string, string> = {
  mainTitle: 'العنوان', subtitle: 'العنوان الفرعي', partName: 'اسم الجزء', partNumber: 'رقم الجزء', label: 'اسم / تسمية',
  responsibilityStatement: 'بيان المسؤولية', editionStatement: 'بيان الطبعة', simplePlace: 'مكان النشر', simpleAgent: 'الناشر',
  seriesStatement: 'بيان السلسلة', variantTitle: 'عنوان آخر',
};

export function RomanizePanel({ work, instance, language, onApply }: Props) {
  const ar = language === 'ar';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dir, setDir] = useState<Direction>('to-latin');

  // The other way (S9): Arabic script for values that have only their ALA-LC romanization.
  const suggestArabic = () => {
    setMessage(null);
    setDir('to-arabic');
    const found = [...findArabizable(work, 'work'), ...findArabizable(instance, 'instance')];
    if (!found.length) {
      setRows(null);
      setMessage(ar ? 'لا قيم بالكتابة اللاتينية تنقصها الكتابة العربية.' : 'Nothing to add: every romanized value already has its Arabic script.');
      return;
    }
    setRows(found.map((c) => ({ path: c.path, node: c.node, field: c.field, source: c.latin, value: toArabicScript(c.latin), on: true })));
  };

  const suggest = async () => {
    setDir('to-latin');
    setBusy(true);
    setMessage(null);
    const found = [...findRomanizable(work, 'work'), ...findRomanizable(instance, 'instance')];
    if (!found.length) {
      setRows(null);
      setBusy(false);
      setMessage(ar ? 'لا قيم عربية تحتاج إلى كتابة لاتينية: كلها لها كتابة لاتينية بالفعل.' : 'Nothing to romanize: every Arabic value already has its Latin form.');
      return;
    }
    const latin = await romanizeAll(found.map((f) => f.arabic), `${MOON_API}/scriptshifter/trans`, moonHeaders());
    setRows(found.map((f, i) => ({ path: f.path, node: f.node, field: f.field, source: f.arabic, value: latin[i], on: !!latin[i] })));
    setBusy(false);
    if (latin.every((l) => !l)) setMessage(ar ? 'تعذّر الوصول إلى خدمة ScriptShifter من مكتبة الكونغرس. اكتب الصيغ اللاتينية يدوياً أو حاول لاحقاً.' : "LC's ScriptShifter could not be reached. Type the Latin forms yourself or try later.");
  };

  const apply = () => {
    if (!rows) return;
    let w = work;
    let inst = instance;
    // Deepest and last first, so adding a value never shifts the place of one still to come.
    const chosen = rows.filter((r) => r.on && r.value.trim()).sort((a, b) => b.path.length - a.path.length || String(b.path.join('/')).localeCompare(String(a.path.join('/'))));
    for (const r of chosen) {
      if (r.node === 'work') w = addRomanization(w, r.path, r.value);
      else inst = addRomanization(inst, r.path, r.value);
    }
    onApply(w, inst);
    setRows(null);
    setMessage(dir === 'to-arabic'
      ? (ar ? `أُضيفت ${chosen.length} صيغة عربية بجانب اللاتينية.` : `Added ${chosen.length} Arabic-script forms beside the romanization.`)
      : (ar ? `أُضيفت ${chosen.length} صيغة لاتينية بجانب العربية.` : `Added ${chosen.length} Latin forms beside the Arabic.`));
  };

  const box: React.CSSProperties = { borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)' };
  const input = 'w-full min-w-0 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/60';

  return (
    <div className="p-3 space-y-3" style={box} dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Languages className="h-4 w-4" />
          {ar ? 'الكتابة اللاتينية (ALA-LC)' : 'Romanization (ALA-LC)'}
        </div>
        <button type="button" disabled={busy} onClick={suggest}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50" style={box}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
          {ar ? 'اقترح الصيغ اللاتينية' : 'Suggest romanizations'}
        </button>
        <button type="button" disabled={busy} onClick={suggestArabic}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50" style={box}>
          <Languages className="h-3.5 w-3.5" />
          {ar ? 'اقترح الكتابة العربية' : 'Suggest Arabic script'}
        </button>
      </div>
      {!rows && !message && (
        <p className="text-xs text-white/70">
          {ar ? 'يقترح الصيغة اللاتينية للعناوين والأسماء العربية من أداة ScriptShifter لمكتبة الكونغرس، أو الكتابة العربية لما جاء بالكتابة اللاتينية وحدها (من تسجيلات LC وOCLC)، فتراجعها قبل إضافتها.' : "Suggests the Latin form of Arabic titles and names from LC's ScriptShifter, or the Arabic script of values that came only romanized (from LC or OCLC records), for you to check before adding."}
        </p>
      )}
      {message && <p className="text-xs text-white/80">{message}</p>}
      {rows && (
        <>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={`${r.node}:${r.path.join('/')}`} className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_8rem_1fr_1fr] gap-2 items-center p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <input type="checkbox" checked={r.on} aria-label={r.source}
                  onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} />
                <span className="text-[11px] text-white/60">{(ar ? FIELD_AR[r.field] : r.field) || r.field}{r.node === 'instance' ? (ar ? ' · الطبعة' : ' · instance') : ''}</span>
                <span className="text-xs text-white col-span-2 md:col-span-1" dir={dir === 'to-latin' ? 'rtl' : 'ltr'}>{r.source}</span>
                <input className={`${input} col-span-2 md:col-span-1`} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}
                  dir={dir === 'to-latin' ? 'ltr' : 'rtl'} value={r.value}
                  placeholder={dir === 'to-latin' ? (ar ? 'اكتب الصيغة اللاتينية' : 'Type the Latin form') : (ar ? 'راجع الكتابة العربية' : 'Check the Arabic script')}
                  onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, value: e.target.value, on: !!e.target.value.trim() } : x)))} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setRows(null)} className="px-3 py-1.5 rounded-full text-xs font-bold text-white/80 hover:bg-white/10">
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="button" onClick={apply} disabled={!rows.some((r) => r.on && r.value.trim())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-900 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> {ar ? 'أضف المختار' : 'Add selected'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

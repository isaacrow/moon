/**
 * Romanization in Moon Studio: finds the record's Arabic titles, names, statements and places that have
 * no Latin form yet, asks LC's ScriptShifter for their ALA-LC romanization, and lets the cataloger check
 * and correct each one before adding it beside the Arabic (exported as "@ar-Arab" / "@ar-Latn").
 */
import React, { useState } from 'react';
import { Languages, Loader2, Check } from 'lucide-react';
import { findRomanizable, addRomanization, romanizeAll, type RomanizeCandidate } from '../../services/romanize';
import { MOON_API, moonHeaders } from '../utils/moonApi';

interface Props {
  work: any;
  instance: any;
  language: 'en' | 'ar' | string;
  onApply: (work: any, instance: any) => void;
}

interface Row extends RomanizeCandidate { latin: string; on: boolean }

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

  const suggest = async () => {
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
    setRows(found.map((f, i) => ({ ...f, latin: latin[i], on: !!latin[i] })));
    setBusy(false);
    if (latin.every((l) => !l)) setMessage(ar ? 'تعذّر الوصول إلى خدمة ScriptShifter من مكتبة الكونغرس. اكتب الصيغ اللاتينية يدوياً أو حاول لاحقاً.' : "LC's ScriptShifter could not be reached. Type the Latin forms yourself or try later.");
  };

  const apply = () => {
    if (!rows) return;
    let w = work;
    let inst = instance;
    // Deepest and last first, so adding a value never shifts the place of one still to come.
    const chosen = rows.filter((r) => r.on && r.latin.trim()).sort((a, b) => b.path.length - a.path.length || String(b.path.join('/')).localeCompare(String(a.path.join('/'))));
    for (const r of chosen) {
      if (r.node === 'work') w = addRomanization(w, r.path, r.latin);
      else inst = addRomanization(inst, r.path, r.latin);
    }
    onApply(w, inst);
    setRows(null);
    setMessage(ar ? `أُضيفت ${chosen.length} صيغة لاتينية بجانب العربية.` : `Added ${chosen.length} Latin forms beside the Arabic.`);
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
      </div>
      {!rows && !message && (
        <p className="text-xs text-white/70">
          {ar ? 'يقترح الصيغة اللاتينية للعناوين والأسماء العربية من أداة ScriptShifter لمكتبة الكونغرس، فتراجعها قبل إضافتها.' : "Suggests the Latin form of Arabic titles and names from LC's ScriptShifter, for you to check before adding."}
        </p>
      )}
      {message && <p className="text-xs text-white/80">{message}</p>}
      {rows && (
        <>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={`${r.node}:${r.path.join('/')}`} className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_8rem_1fr_1fr] gap-2 items-center p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <input type="checkbox" checked={r.on} aria-label={r.arabic}
                  onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} />
                <span className="text-[11px] text-white/60">{(ar ? FIELD_AR[r.field] : r.field) || r.field}{r.node === 'instance' ? (ar ? ' · الطبعة' : ' · instance') : ''}</span>
                <span className="text-xs text-white col-span-2 md:col-span-1" dir="rtl">{r.arabic}</span>
                <input className={`${input} col-span-2 md:col-span-1`} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)' }}
                  dir="ltr" value={r.latin} placeholder={ar ? 'اكتب الصيغة اللاتينية' : 'Type the Latin form'}
                  onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, latin: e.target.value, on: !!e.target.value.trim() } : x)))} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setRows(null)} className="px-3 py-1.5 rounded-full text-xs font-bold text-white/80 hover:bg-white/10">
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="button" onClick={apply} disabled={!rows.some((r) => r.on && r.latin.trim())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-900 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> {ar ? 'أضف المختار' : 'Add selected'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

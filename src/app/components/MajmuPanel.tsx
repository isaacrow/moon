/**
 * Majmūʿ in Moon Studio (Phase 13 S12): the works one volume contains, each with its own title, author and
 * place in the volume (folios, pages), and who compiled the volume. Saved as bf:hasPart on the Work; the
 * OPAC finds the volume by each work's own title, and MARC export writes 700 _2 $a $t or 740.
 */
import React, { useEffect, useState } from 'react';
import { Library, Plus, Trash2 } from 'lucide-react';
import { containedWorks, withContainedWorks, compilerOf, withCompiler, type ContainedWork } from '../../services/majmu';

interface Props { work: any; language: string; onChange: (work: any) => void }

export function MajmuPanel({ work, language, onChange }: Props) {
  const ar = language === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const [rows, setRows] = useState<ContainedWork[]>(() => containedWorks(work));
  const [compiler, setCompiler] = useState(() => compilerOf(work));
  const [open, setOpen] = useState(() => containedWorks(work).length > 0);
  // A record loaded or changed elsewhere brings its own list.
  const key = JSON.stringify(work?.['bf:hasPart'] ?? null);
  useEffect(() => { setRows(containedWorks(work)); setCompiler(compilerOf(work)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: ContainedWork[], comp = compiler) => {
    setRows(next);
    onChange(withCompiler(withContainedWorks(work, next), comp));
  };
  const edit = (i: number, patch: Partial<ContainedWork>) => {
    const next = rows.map((r, k) => (k === i ? { ...r, ...patch } : r));
    setRows(next);
  };

  const box: React.CSSProperties = { borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)' };
  const input = 'w-full min-w-0 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/60';
  const inputStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.2)' };

  return (
    <div className="p-3 space-y-3" style={box} dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Library className="h-4 w-4" /> {t('مجموع: الأعمال في هذا المجلد', 'Majmūʿ: works in this volume')}
          {rows.length > 0 && <span className="text-xs font-normal text-white/70">({rows.length})</span>}
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white hover:bg-white/20" style={box}>
            <Plus className="h-3.5 w-3.5" /> {t('أضف أعمالاً', 'Add works')}
          </button>
        )}
      </div>
      {!open && <p className="text-xs text-white/70">{t('حين يجمع المجلد الواحد عدة رسائل أو كتب، سجّل كل عمل بعنوانه ومؤلفه، فيُعثر عليه في الفهرس بعنوانه.', 'When one volume holds several treatises or books, record each work with its title and author, so the catalogue finds it by its own title.')}</p>}
      {open && (
        <>
          <label className="block">
            <span className="block text-[11px] text-white/70 mb-1">{t('جامع المجموع (اختياري)', 'Compiler of the volume (optional)')}</span>
            <input className={input} style={inputStyle} dir="auto" value={compiler}
              onChange={(e) => setCompiler(e.target.value)} onBlur={() => commit(rows, compiler)} />
          </label>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1.5fr_1fr_auto] gap-2 items-center p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <input className={input} style={inputStyle} dir="auto" value={r.title} placeholder={t('العنوان', 'Title')} aria-label={t('العنوان', 'Title')}
                  onChange={(e) => edit(i, { title: e.target.value })} onBlur={() => commit(rows)} />
                <button type="button" onClick={() => commit(rows.filter((_, k) => k !== i))} className="text-white/70 hover:text-white md:order-last" aria-label={t('احذف', 'Remove')}><Trash2 className="h-4 w-4" /></button>
                <input className={input} style={inputStyle} dir="auto" value={r.creator || ''} placeholder={t('المؤلف', 'Author')} aria-label={t('المؤلف', 'Author')}
                  onChange={(e) => edit(i, { creator: e.target.value, creatorUri: undefined })} onBlur={() => commit(rows)} />
                <input className={input} style={inputStyle} dir="auto" value={r.locator || ''} placeholder={t('الأوراق (ق 1-20)', 'Folios (ff. 1-20)')} aria-label={t('موضعه في المجلد', 'Place in the volume')}
                  onChange={(e) => edit(i, { locator: e.target.value })} onBlur={() => commit(rows)} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setRows([...rows, { title: '' }])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white hover:bg-white/20" style={box}>
            <Plus className="h-3.5 w-3.5" /> {t('عمل آخر', 'Another work')}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * MARC 21 cataloguing (a third field layout beside Category Cards and Standard MARC Fields).
 * The cataloguer works in MARC — as rows of fields with indicators and subfields, or as text — and Moon
 * converts it to BIBFRAME as they type (the converter MARC import uses). "Live" writes it into the record's
 * Work and Instance at once; otherwise "Apply to the record" does.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Wand2, Rows3, FileCode2, AlertTriangle, CheckCircle2, Zap, SlidersHorizontal, Search } from 'lucide-react';
import { parseMarcText, marcToText, marcTextToBibframe, BOOK_TEMPLATE, fieldName, type MarcRecord, type DataField } from '../../../services/marc/marcEditing';
import { fieldDef, searchFields, subfieldName } from '../../../services/marc/marcDictionary';
import { LEADER_POSITIONS, f008Positions, new008 } from '../../../services/marc/marcFixedFields';
import { MarcFixedFieldForm } from './MarcFixedFieldForm';
import { MarcAuthorityInput } from './MarcAuthorityInput';
import { authorityFor, applyAuthority } from '../../../services/marc/marcAuthorityFields';
import { autoFill008, changedPositions, type Filled } from '../../../services/marc/marc008Auto';
import type { CSSProperties } from 'react';

/** Buttons and tags: liquid glass. */
const LIQUID: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.21)',
  borderRadius: 999,
  backdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
  WebkitBackdropFilter: 'blur(36px) saturate(1.8) brightness(1.15) contrast(1.05)',
  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 1.5px 1.5px 0 rgba(255, 255, 255, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3)',
};
/** Field rows: frosted glass (css.glass). */
const GLASS: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.32)',
  borderRadius: 16,
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.43)',
};
/** The boxes people type in, dark enough for white text on the glass. */
const FIELD_BG: CSSProperties = { background: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(255, 255, 255, 0.2)' };
const AUTO_KEY = 'moon-marc-auto008';
import { isControl } from '../../../services/marc/marcRecord';
import { bibframeToMarc } from '../../../services/marc/bibframeToMarc';
import { buildW3CJsonLd } from '../../../services/w3cJsonLdBuilder';

interface Props {
  workData: any; instanceData: any;
  uriSet: { work: string; instance: string; item: string; expression: string; admin: string };
  language: 'en' | 'ar';
  onApply: (work: any, instance: any) => void;
}

/** The record's current MARC (from its BIBFRAME), or the book template for a new record. */
function initialText(workData: any, instanceData: any, uriSet: Props['uriSet']): string {
  const hasTitle = JSON.stringify([workData?.['bf:title'], instanceData?.['bf:title']]).match(/mainTitle"\s*:\s*\[?\s*"[^"]/);
  if (!hasTitle) return BOOK_TEMPLATE;
  try {
    return marcToText(bibframeToMarc(buildW3CJsonLd({ workData, instanceData, uriSet }) as any));
  } catch {
    return BOOK_TEMPLATE;
  }
}

export function MarcEditor({ workData, instanceData, uriSet, language, onApply }: Props) {
  const ar = language === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const [text, setText] = useState(() => initialText(workData, instanceData, uriSet));
  const [view, setView] = useState<'fields' | 'text'>('fields');
  const [live, setLive] = useState(false);
  const [debounced, setDebounced] = useState(text);
  useEffect(() => { const id = setTimeout(() => setDebounced(text), 250); return () => clearTimeout(id); }, [text]);

  const parsed = useMemo(() => parseMarcText(text), [text]);
  const result = useMemo(() => marcTextToBibframe(debounced), [debounced]);
  const errors = result.issues.filter((i) => i.level === 'error');
  const warnings = result.issues.filter((i) => i.level === 'warning');

  const withIds = (bf: NonNullable<typeof result.bibframe>) => ({
    work: { ...bf.work, '@id': uriSet.work },
    instance: { ...bf.instance, '@id': uriSet.instance, 'bf:instanceOf': { '@id': uriSet.work } },
  });
  const graph = useMemo(() => {
    if (!result.bibframe) return null;
    const { work, instance } = withIds(result.bibframe);
    try { return buildW3CJsonLd({ workData: work, instanceData: instance, uriSet }); } catch { return null; }
  }, [result.bibframe]);

  // Live: every change that converts without errors goes straight into the record.
  const lastApplied = useRef('');
  useEffect(() => {
    if (!live || !result.bibframe || errors.length || debounced === lastApplied.current) return;
    lastApplied.current = debounced;
    const { work, instance } = withIds(result.bibframe);
    onApply(work, instance);
  }, [live, result, debounced]);

  // Structured rows edit the parsed record and write the text back.
  const rec = parsed.record;
  const edit = (change: (r: MarcRecord) => void) => {
    const next: MarcRecord = JSON.parse(JSON.stringify(rec));
    change(next);
    setText(marcToText(next));
  };
  const lineIssues = (i: number) => result.issues.filter((x) => x.line && x.line === parsed.lineOf[i]);

  // The guided Leader / 008 form that is open ('LDR', or the index of a 008), and the add-a-field search.
  const [guided, setGuided] = useState<string | null>(null);
  const [addQuery, setAddQuery] = useState('');
  const matches = useMemo(() => searchFields(addQuery, 10), [addQuery]);
  /** Adds a field with the indicators MARC 21 gives it and its first subfield, in tag order. */
  const addField = (tag: string) => {
    const d = fieldDef(tag);
    edit((r) => {
      if (/^00\d$/.test(tag)) r.fields.push({ tag, data: tag === '008' ? new008() : '' });
      else {
        const first = Object.keys(d?.subfields || {}).find((c) => /[a-z]/.test(c)) || 'a';
        r.fields.push({ tag, ind1: d?.ind1 ?? ' ', ind2: d?.ind2 ?? ' ', subfields: [[first, '']] });
      }
      r.fields.sort((a, b) => a.tag.localeCompare(b.tag));
    });
    setAddQuery('');
  };
  const guideButton = (key: string, label: string) => (
    <button type="button" onClick={() => setGuided(guided === key ? null : key)} title={label} aria-label={label} aria-expanded={guided === key}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white ${guided === key ? 'ring-2 ring-sky-300' : ''}`} style={LIQUID}>
      <SlidersHorizontal className="h-4 w-4" />{t('موجَّه', 'Guided')}
    </button>
  );

  // ---- 008 filled from the record as it is catalogued ----
  const [auto008, setAuto008] = useState(() => { try { return localStorage.getItem(AUTO_KEY) !== 'off'; } catch { return true; } });
  const keep008 = useRef(new Set<number>());
  const [filled008, setFilled008] = useState<Filled[]>([]);
  const [refill, setRefill] = useState(0);
  const setAuto = (on: boolean) => { setAuto008(on); try { localStorage.setItem(AUTO_KEY, on ? 'on' : 'off'); } catch { /* private window */ } };
  /** Positions the cataloguer changes by hand are theirs: auto-fill leaves them alone. */
  const set008ByHand = (i: number, before: string, after: string) => {
    changedPositions(before, after).forEach((p) => keep008.current.add(p));
    edit((r) => { (r.fields[i] as any).data = after; });
  };
  useEffect(() => {
    if (!auto008 || view !== 'fields' || parsed.issues.some((x) => x.level === 'error')) return;
    const has245 = rec.fields.some((f) => f.tag === '245');
    const i = rec.fields.findIndex((f) => f.tag === '008' && isControl(f));
    if (i < 0 && !has245) return;
    const current = i >= 0 ? (rec.fields[i] as { data: string }).data : new008();
    const { value, changed } = autoFill008(current, rec, keep008.current);
    if (i >= 0 && !changed.length) return;
    setFilled008((prev) => [...prev.filter((p) => !changed.some((c) => c.start === p.start)), ...changed].sort((a, b) => a.start - b.start));
    edit((r) => {
      const at = r.fields.findIndex((f) => f.tag === '008' && isControl(f));
      if (at >= 0) (r.fields[at] as any).data = value;
      else { r.fields.push({ tag: '008', data: value }); r.fields.sort((a, b) => a.tag.localeCompare(b.tag)); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, auto008, refill]);

  /** A subfield box: an authority search where the field takes an authority, a plain box otherwise. */
  const subfieldBox = (f: DataField, i: number, code: string, value: string, j: number) => {
    const name = subfieldName(f.tag, code);
    const cls = `w-full h-11 rounded-xl px-3 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-300/70`;
    const set = (v: string) => edit((r) => { (r.fields[i] as DataField).subfields[j][1] = v; });
    const spec = authorityFor(f.tag, code);
    if (spec) {
      return (
        <MarcAuthorityInput value={value} spec={spec} ar={ar} className={cls} style={FIELD_BG} placeholder={name}
          ariaLabel={`${f.tag} $${code} ${name}`} onChange={set}
          onPick={(picked) => edit((r) => { r.fields[i] = applyAuthority(r.fields[i] as DataField, j, picked, spec); })} />
      );
    }
    return (
      <div className="relative flex-1 min-w-[200px]">
        <input value={value} onChange={(e) => set(e.target.value)} dir="auto" title={name} placeholder={name}
          className={cls} style={FIELD_BG} aria-label={`${f.tag} $${code} ${name}`} />
      </div>
    );
  };

  const summary = useMemo(() => {
    const g: any[] = (graph as any)?.['@graph'] || [];
    const lab = (v: any): string => (v === undefined || v === null ? ''
      : Array.isArray(v) ? lab(v[0])
      : typeof v !== 'object' ? String(v)
      : v['@value'] !== undefined ? String(v['@value'])
      : v['rdfs:label'] !== undefined ? lab(v['rdfs:label'])
      : lab(v['bf:mainTitle']));
    const work = g.find((n) => String(n['@type']).includes('Work')) || {};
    const inst = g.find((n) => String(n['@type']).includes('Instance')) || {};
    return [
      ['bf:Work', ''],
      [t('العنوان', 'Title'), lab(work['bf:title'])],
      [t('المساهمون', 'Contributors'), (work['bf:contribution'] || []).map((c: any) => lab(c['bf:agent'])).filter(Boolean).join(' · ')],
      [t('الموضوعات', 'Subjects'), (work['bf:subject'] || []).map(lab).filter(Boolean).join(' · ')],
      [t('اللغة', 'Language'), (work['bf:language'] || []).map((l: any) => String(l['@id'] || '').split('/').pop()).join(', ')],
      ['bf:Instance', ''],
      [t('العنوان', 'Title'), lab(inst['bf:title'])],
      [t('النشر', 'Publication'), (inst['bf:provisionActivity'] || []).map((p: any) => [lab(p['bf:place']), lab(p['bf:agent']), lab(p['bf:date'])].filter(Boolean).join(' : ')).join(' ; ')],
      [t('المعرفات', 'Identifiers'), (inst['bf:identifiedBy'] || []).map((i: any) => lab(i['rdf:value'])).filter(Boolean).join(' · ')],
      [t('الحجم', 'Extent'), (inst['bf:extent'] || []).map(lab).join(' ; ')],
    ] as [string, string][];
  }, [graph, ar]);

  const box = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' };
  const mono = 'font-mono text-[15px] h-11 rounded-xl px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/70';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4" dir={ar ? 'rtl' : 'ltr'}>
      {/* MARC */}
      <div className="xl:col-span-3 rounded-2xl p-4 space-y-3" style={box}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black text-white me-auto">MARC 21 <span className="text-white/50 font-normal">{t('— فهرسة مع تحويل فوري إلى BIBFRAME', '— cataloguing with instant BIBFRAME')}</span></h3>
          <div className="flex gap-1 p-1 text-sm" style={LIQUID}>
            <button type="button" onClick={() => setView('fields')} aria-pressed={view === 'fields'} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white ${view === 'fields' ? 'bg-white/30 font-semibold' : 'opacity-75'}`}><Rows3 className="h-4 w-4" />{t('حقول', 'Fields')}</button>
            <button type="button" onClick={() => setView('text')} aria-pressed={view === 'text'} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white ${view === 'text' ? 'bg-white/30 font-semibold' : 'opacity-75'}`}><FileCode2 className="h-4 w-4" />{t('نص', 'Text')}</button>
          </div>
          <button type="button" onClick={() => { if (window.confirm(t('البدء من قالب الكتاب؟ يُستبدل ما في المحرر.', 'Start from the book template? This replaces what is in the editor.'))) { keep008.current.clear(); setText(BOOK_TEMPLATE); } }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white" style={LIQUID}><Wand2 className="h-4 w-4" />{t('قالب كتاب', 'Book template')}</button>
        </div>

        {view === 'text' ? (
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} dir="auto"
            className="w-full min-h-[420px] font-mono text-[13px] leading-6 rounded-xl bg-black/40 border border-white/10 p-3 text-white focus:outline-none focus:border-sky-400"
            aria-label={t('تسجيلة مارك نصاً', 'MARC record as text')} />
        ) : parsed.issues.some((i) => i.level === 'error') ? (
          <p className="rounded-lg bg-amber-500/15 p-3 text-xs text-amber-100">{t('في النص أسطر لا تُقرأ؛ أصلحها في عرض «نص» أولاً.', 'Some lines cannot be read; fix them in the Text view first.')}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 p-2.5" style={GLASS}>
              <span className="flex h-11 w-16 shrink-0 items-center justify-center font-mono text-sm font-bold text-white" style={LIQUID}>LDR</span>
              <input value={rec.leader.replace(/ /g, '\\')} onChange={(e) => edit((r) => { r.leader = e.target.value.replace(/\\/g, ' ').padEnd(24, ' ').slice(0, 24); })} className={`${mono} flex-1 min-w-0`} style={FIELD_BG} dir="ltr" aria-label={t('الفاتح', 'Leader')} />
              {guideButton('LDR', t('الفاتح خانة بخانة', 'Leader position by position'))}
            </div>
            {guided === 'LDR' && (
              <MarcFixedFieldForm value={rec.leader} total={24} positions={LEADER_POSITIONS} ar={ar}
                onChange={(next) => edit((r) => { r.leader = next; })} />
            )}
            {rec.fields.map((f, i) => {
              const issues = lineIssues(i);
              const bad = issues.some((x) => x.level === 'error');
              return (
                <div key={i} className="group p-3 space-y-2.5" style={bad ? { ...GLASS, boxShadow: '0 4px 30px rgba(0,0,0,0.1), inset 0 0 0 2px rgba(244,63,94,0.7)' } : GLASS}>
                  {/* The field's head: tag, indicators, name, actions. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* A tag is kept only when it is three digits (a half-typed tag would not parse). */}
                    <input key={`${i}-${f.tag}`} defaultValue={f.tag} maxLength={3}
                      onChange={(e) => { const v = e.target.value; if (/^\d{3}$/.test(v) && v !== f.tag) edit((r) => { r.fields[i].tag = v; }); }}
                      onBlur={(e) => { if (!/^\d{3}$/.test(e.target.value)) e.target.value = f.tag; }}
                      className="h-11 w-16 shrink-0 bg-transparent text-center font-mono text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-sky-300/70" style={LIQUID} aria-label={t('رمز الحقل', 'Tag')} dir="ltr" />
                    {!isControl(f) && (['ind1', 'ind2'] as const).map((k) => (
                      <input key={k} value={(f as DataField)[k] === ' ' ? '#' : (f as DataField)[k]} maxLength={1}
                        onChange={(e) => edit((r) => { (r.fields[i] as any)[k] = e.target.value === '#' || e.target.value === '' ? ' ' : e.target.value; })}
                        title={k === 'ind1' ? t('المؤشر الأول', 'First indicator') : t('المؤشر الثاني', 'Second indicator')}
                        className={`${mono} w-11 px-0 text-center`} style={FIELD_BG} dir="ltr" aria-label={k === 'ind1' ? t('المؤشر الأول', 'First indicator') : t('المؤشر الثاني', 'Second indicator')} />
                    ))}
                    <span className="text-sm font-semibold text-white" dir="auto">{fieldName(f.tag, ar)}</span>
                    <span className="flex-1" />
                    {isControl(f) && f.tag === '008' && <span className={`font-mono text-xs ${f.data.length === 40 ? 'text-white/70' : 'text-amber-200'}`} dir="ltr">{f.data.length}/40</span>}
                    {isControl(f) && f.tag === '008' && guideButton(`008-${i}`, t('008 خانة بخانة', '008 position by position'))}
                    <button type="button" onClick={() => edit((r) => { r.fields.splice(i, 1); })} className="flex h-9 w-9 items-center justify-center text-white/80 hover:text-rose-200 opacity-60 group-hover:opacity-100" style={LIQUID} aria-label={t('احذف الحقل', 'Remove field')} title={t('احذف الحقل', 'Remove field')}><X className="h-4 w-4" /></button>
                  </div>

                  {isControl(f) ? (
                    <input value={f.data.replace(/ /g, '\\')} dir="ltr" aria-label={`${f.tag}`} className={`${mono} w-full`} style={FIELD_BG}
                      onChange={(e) => {
                        const next = e.target.value.replace(/\\/g, ' ');
                        if (f.tag === '008') set008ByHand(i, f.data, next);
                        else edit((r) => { (r.fields[i] as any).data = next; });
                      }} />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(f as DataField).subfields.map(([code, value], j) => (
                        <div key={j} className="flex flex-1 basis-[280px] items-center gap-1.5">
                          <input value={code} maxLength={1} onChange={(e) => { const v = e.target.value.toLowerCase(); if (/^[a-z0-9]$/.test(v)) edit((r) => { (r.fields[i] as DataField).subfields[j][0] = v; }); }}
                            title={subfieldName(f.tag, code) || t('حقل فرعي غير معرّف لهذا الحقل', 'Not a subfield of this field')}
                            className={`h-11 w-11 shrink-0 bg-transparent text-center font-mono text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-sky-300/70 ${subfieldName(f.tag, code) || !fieldDef(f.tag) ? 'text-white' : 'text-amber-200'}`}
                            style={LIQUID} dir="ltr" aria-label={t('رمز الحقل الفرعي', 'Subfield code')} />
                          {subfieldBox(f as DataField, i, code, value, j)}
                          <button type="button" onClick={() => edit((r) => { (r.fields[i] as DataField).subfields.splice(j, 1); })} className="shrink-0 text-white/50 hover:text-rose-200 opacity-0 group-hover:opacity-100" aria-label={t('احذف الحقل الفرعي', 'Remove subfield')}><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                      {/* Add a subfield: the field's own subfields by name, or any code. */}
                      <select value="" onChange={(e) => { const v = e.target.value; if (v) edit((r) => { (r.fields[i] as DataField).subfields.push([v, '']); }); }}
                        className="h-11 cursor-pointer px-4 text-sm font-bold text-white focus:outline-none" style={LIQUID} aria-label={t('أضف حقلاً فرعياً', 'Add subfield')} title={t('أضف حقلاً فرعياً', 'Add subfield')}>
                        <option value="" className="text-slate-900">{t('+ حقل فرعي', '+ subfield')}</option>
                        {Object.entries(fieldDef(f.tag)?.subfields || {}).map(([sc, name]) => <option key={sc} value={sc} className="text-slate-900">${sc} — {name}</option>)}
                        {!fieldDef(f.tag) && 'abcdefghijklmnopqrstuvwxyz0123456789'.split('').map((sc) => <option key={sc} value={sc} className="text-slate-900">${sc}</option>)}
                      </select>
                    </div>
                  )}

                  {isControl(f) && f.tag === '008' && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white">
                      <label className="flex cursor-pointer items-center gap-2 px-3.5 py-1.5 font-semibold" style={LIQUID}>
                        <input type="checkbox" checked={auto008} onChange={(e) => setAuto(e.target.checked)} />
                        <Wand2 className="h-4 w-4" />{t('يُملأ تلقائياً من التسجيلة', 'Auto-fill from the record')}
                      </label>
                      {auto008 && filled008.filter((x) => x.start !== 0).map((x) => (
                        <span key={x.start} className="rounded-full bg-white/20 px-2.5 py-1" title={`008/${String(x.start).padStart(2, '0')}`}>
                          {ar ? x.ar : x.en}: <b className="font-mono" dir="ltr">{x.value.replace(/ /g, '#')}</b>
                        </span>
                      ))}
                      {keep008.current.size > 0 && (
                        <button type="button" className="rounded-full px-2.5 py-1 underline-offset-2 hover:underline text-white/90"
                          onClick={() => { keep008.current.clear(); setRefill((n) => n + 1); }}>
                          {t(`${keep008.current.size} خانة عدّلتَها بيدك تبقى كما هي — أعد الملء التلقائي لها`, `${keep008.current.size} positions you set by hand are kept — let auto-fill take them back`)}
                        </button>
                      )}
                    </div>
                  )}
                  {isControl(f) && f.tag === '008' && guided === `008-${i}` && (
                    <MarcFixedFieldForm value={f.data} total={40} positions={f008Positions(rec.leader)} ar={ar}
                      onChange={(next) => set008ByHand(i, f.data, next)} />
                  )}
                  {issues.map((x, k) => <div key={k} className={`text-xs font-medium ${x.level === 'error' ? 'text-rose-100' : 'text-amber-100'}`}>{ar ? x.ar : x.en}</div>)}
                </div>
              );
            })}
            {/* Add any MARC 21 field: by tag ("505") or by name ("contents", "ملاحظة"). */}
            <div className="relative pt-2">
              <div className="flex items-center gap-2 px-4" style={GLASS}>
                <Search className="h-4 w-4 text-white/80" />
                <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)} dir="auto"
                  onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); addField(matches[0].tag); } if (e.key === 'Escape') setAddQuery(''); }}
                  placeholder={t('أضف حقلاً: اكتب الرقم أو الاسم (505، ملاحظة، series…)', 'Add a field: type its tag or name (505, contents, series…)')}
                  className="h-12 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/60 focus:outline-none" aria-label={t('أضف حقلاً', 'Add a field')} />
              </div>
              {matches.length > 0 && (
                <ul className="absolute z-20 mt-1.5 w-full max-h-80 overflow-auto p-1.5" role="listbox"
                  style={{ background: 'rgba(30,41,59,0.85)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                  {matches.map((d) => (
                    <li key={d.tag}>
                      <button type="button" onClick={() => addField(d.tag)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-start text-sm text-white hover:bg-white/10">
                        <span className="w-12 shrink-0 py-0.5 text-center font-mono font-bold" style={LIQUID}>{d.tag}</span>
                        <span dir="auto" className="flex-1">{ar ? d.ar : d.en}</span>
                        {!d.repeatable && rec.fields.some((x) => x.tag === d.tag) && <span className="text-[11px] text-amber-200">{t('موجود ولا يتكرر', 'already here, not repeatable')}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {['008', '020', '041', '082', '100', '246', '250', '490', '500', '504', '505', '520', '546', '600', '650', '651', '700', '856'].map((tag) => (
                <button key={tag} type="button" title={fieldName(tag, ar)}
                  onClick={() => addField(tag)}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 font-mono text-sm font-semibold text-white transition-transform hover:scale-105" style={LIQUID}>
                  <Plus className="h-3.5 w-3.5" />{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BIBFRAME, live */}
      <div className="xl:col-span-2 rounded-2xl p-4 space-y-3" style={box}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-white me-auto">BIBFRAME <span className="text-white/50 font-normal">{t('(يتحدث وأنت تكتب)', '(updates as you type)')}</span></h3>
          <label className="flex items-center gap-1.5 text-xs text-white/80 cursor-pointer">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            <Zap className="h-3.5 w-3.5 text-amber-300" />{t('مباشر', 'Live')}
          </label>
        </div>
        <div className={`flex items-center gap-2 rounded-lg p-2 text-xs ${errors.length ? 'bg-rose-500/15 text-rose-100' : 'bg-emerald-500/15 text-emerald-100'}`}>
          {errors.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {errors.length ? t(`${errors.length} خطأ يجب إصلاحه`, `${errors.length} to fix`) : t('مارك صالح؛ التحويل جاهز', 'Valid MARC; BIBFRAME ready')}
          {warnings.length > 0 && <span className="text-amber-200">· {t(`${warnings.length} تنبيه`, `${warnings.length} warnings`)}</span>}
        </div>
        {result.issues.filter((x) => !x.line).map((x, k) => <p key={k} className={`text-[11px] ${x.level === 'error' ? 'text-rose-300' : 'text-amber-200'}`}>{ar ? x.ar : x.en}</p>)}
        <dl className="text-xs space-y-1">
          {summary.map(([k, v], i) => v === '' && k.startsWith('bf:')
            ? <dt key={i} className="pt-2 font-mono text-[11px] font-bold text-sky-300">{k}</dt>
            : <div key={i} className="flex gap-2"><dt className="w-24 shrink-0 text-white/50">{k}</dt><dd className="text-white" dir="auto">{v || '—'}</dd></div>)}
        </dl>
        <details className="text-xs">
          <summary className="cursor-pointer text-white/70">{t('JSON-LD الكامل', 'Full JSON-LD')}</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-black/40 p-2 text-[11px] text-white/80" dir="ltr">{graph ? JSON.stringify(graph, null, 2) : '—'}</pre>
        </details>
        {!live && (
          <button type="button" disabled={!result.bibframe || errors.length > 0}
            onClick={() => { const { work, instance } = withIds(result.bibframe!); lastApplied.current = debounced; onApply(work, instance); }}
            className="w-full rounded-xl bg-sky-600 py-2 text-xs font-bold text-white disabled:opacity-40">
            {t('طبّق على التسجيلة', 'Apply to the record')}
          </button>
        )}
        <p className="text-[11px] text-white/50">{t('التطبيق يستبدل العمل والطبعة بما في مارك؛ الغلاف والنسخ لا تتغير.', 'Applying replaces the Work and Instance with what the MARC says; the cover and copies stay.')}</p>
      </div>
    </div>
  );
}

/**
 * MARC 21 cataloguing (a third field layout beside Category Cards and Standard MARC Fields).
 * The cataloguer works in MARC — as rows of fields with indicators and subfields, or as text — and Moon
 * converts it to BIBFRAME as they type (the converter MARC import uses). "Live" writes it into the record's
 * Work and Instance at once; otherwise "Apply to the record" does.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Wand2, Rows3, FileCode2, AlertTriangle, CheckCircle2, Zap, SlidersHorizontal, Search } from 'lucide-react';
import { parseMarcText, marcToText, marcTextToBibframe, BOOK_TEMPLATE, fieldName, tagBlock, type MarcRecord, type DataField } from '../../../services/marc/marcEditing';
import { fieldDef, searchFields, subfieldName } from '../../../services/marc/marcDictionary';
import { LEADER_POSITIONS, f008Positions, new008 } from '../../../services/marc/marcFixedFields';
import { MarcFixedFieldForm } from './MarcFixedFieldForm';
import { isControl } from '../../../services/marc/marcRecord';
import { bibframeToMarc } from '../../../services/marc/bibframeToMarc';
import { buildW3CJsonLd } from '../../../services/w3cJsonLdBuilder';

const BLOCK_COLORS: Record<string, string> = {
  LDR: '#94a3b8', '0XX': '#94a3b8', '1XX': '#f59e0b', '2XX': '#3b82f6', '3XX': '#10b981', '4XX': '#a855f7',
  '5XX': '#64748b', '6XX': '#ef4444', '7XX': '#f97316', '8XX': '#06b6d4', '9XX': '#64748b',
};

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
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${guided === key ? 'bg-sky-600 text-white' : 'text-sky-300 hover:bg-white/10'}`}>
      <SlidersHorizontal className="h-3.5 w-3.5" />{t('موجَّه', 'Guided')}
    </button>
  );

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
  const mono = 'font-mono text-[13px] bg-black/30 border border-white/10 rounded px-1.5 py-1 text-white focus:outline-none focus:border-sky-400';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4" dir={ar ? 'rtl' : 'ltr'}>
      {/* MARC */}
      <div className="xl:col-span-3 rounded-2xl p-4 space-y-3" style={box}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black text-white me-auto">MARC 21 <span className="text-white/50 font-normal">{t('— فهرسة مع تحويل فوري إلى BIBFRAME', '— cataloguing with instant BIBFRAME')}</span></h3>
          <div className="flex rounded-lg bg-black/30 p-0.5 text-xs">
            <button type="button" onClick={() => setView('fields')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${view === 'fields' ? 'bg-sky-600 text-white' : 'text-white/70'}`}><Rows3 className="h-3.5 w-3.5" />{t('حقول', 'Fields')}</button>
            <button type="button" onClick={() => setView('text')} className={`flex items-center gap-1 px-2.5 py-1 rounded-md ${view === 'text' ? 'bg-sky-600 text-white' : 'text-white/70'}`}><FileCode2 className="h-3.5 w-3.5" />{t('نص', 'Text')}</button>
          </div>
          <button type="button" onClick={() => { if (window.confirm(t('البدء من قالب الكتاب؟ يُستبدل ما في المحرر.', 'Start from the book template? This replaces what is in the editor.'))) setText(BOOK_TEMPLATE); }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"><Wand2 className="h-3.5 w-3.5" />{t('قالب كتاب', 'Book template')}</button>
        </div>

        {view === 'text' ? (
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} dir="auto"
            className="w-full min-h-[420px] font-mono text-[13px] leading-6 rounded-xl bg-black/40 border border-white/10 p-3 text-white focus:outline-none focus:border-sky-400"
            aria-label={t('تسجيلة مارك نصاً', 'MARC record as text')} />
        ) : parsed.issues.some((i) => i.level === 'error') ? (
          <p className="rounded-lg bg-amber-500/15 p-3 text-xs text-amber-100">{t('في النص أسطر لا تُقرأ؛ أصلحها في عرض «نص» أولاً.', 'Some lines cannot be read; fix them in the Text view first.')}</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-12 text-center text-[11px] font-bold rounded py-1" style={{ background: BLOCK_COLORS.LDR, color: '#0f172a' }}>LDR</span>
              <input value={rec.leader.replace(/ /g, '\\')} onChange={(e) => edit((r) => { r.leader = e.target.value.replace(/\\/g, ' ').padEnd(24, ' ').slice(0, 24); })} className={`${mono} flex-1`} dir="ltr" aria-label={t('الفاتح', 'Leader')} />
              {guideButton('LDR', t('الفاتح خانة بخانة', 'Leader position by position'))}
            </div>
            {guided === 'LDR' && (
              <MarcFixedFieldForm value={rec.leader} total={24} positions={LEADER_POSITIONS} ar={ar}
                onChange={(next) => edit((r) => { r.leader = next; })} />
            )}
            {rec.fields.map((f, i) => {
              const color = BLOCK_COLORS[tagBlock(f.tag)] || '#64748b';
              const issues = lineIssues(i);
              return (
                <div key={i} className="group rounded-lg p-1.5 hover:bg-white/5" style={issues.some((x) => x.level === 'error') ? { boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.6)' } : undefined}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* A tag is kept only when it is three digits (a half-typed tag would not parse). */}
                    <input key={`${i}-${f.tag}`} defaultValue={f.tag} maxLength={3}
                      onChange={(e) => { const v = e.target.value; if (/^\d{3}$/.test(v) && v !== f.tag) edit((r) => { r.fields[i].tag = v; }); }}
                      onBlur={(e) => { if (!/^\d{3}$/.test(e.target.value)) e.target.value = f.tag; }}
                      className="w-12 text-center font-mono text-[12px] font-bold rounded py-1 focus:outline-none" style={{ background: color, color: '#0f172a' }} aria-label={t('رمز الحقل', 'Tag')} dir="ltr" />
                    {isControl(f) ? (
                      <>
                        <input value={f.data.replace(/ /g, '\\')} onChange={(e) => edit((r) => { (r.fields[i] as any).data = e.target.value.replace(/\\/g, ' '); })} className={`${mono} flex-1 min-w-[200px]`} dir="ltr" aria-label={`${f.tag}`} />
                        {f.tag === '008' && <span className={`text-[11px] font-mono ${f.data.length === 40 ? 'text-white/40' : 'text-amber-300'}`} dir="ltr">{f.data.length}/40</span>}
                        {f.tag === '008' && guideButton(`008-${i}`, t('008 خانة بخانة', '008 position by position'))}
                      </>
                    ) : (
                      <>
                        {(['ind1', 'ind2'] as const).map((k) => (
                          <input key={k} value={(f as DataField)[k] === ' ' ? '#' : (f as DataField)[k]} maxLength={1}
                            onChange={(e) => edit((r) => { (r.fields[i] as any)[k] = e.target.value === '#' || e.target.value === '' ? ' ' : e.target.value; })}
                            className={`${mono} w-7 text-center`} dir="ltr" aria-label={k === 'ind1' ? t('المؤشر الأول', 'First indicator') : t('المؤشر الثاني', 'Second indicator')} />
                        ))}
                        {(f as DataField).subfields.map(([code, value], j) => (
                          <span key={j} className="inline-flex items-center gap-0.5">
                            <input value={code} maxLength={1} onChange={(e) => { const v = e.target.value.toLowerCase(); if (/^[a-z0-9]$/.test(v)) edit((r) => { (r.fields[i] as DataField).subfields[j][0] = v; }); }}
                              title={subfieldName(f.tag, code) || t('حقل فرعي غير معرّف لهذا الحقل', 'Not a subfield of this field')}
                              className={`w-6 text-center font-mono text-[12px] font-bold bg-transparent focus:outline-none ${subfieldName(f.tag, code) || !fieldDef(f.tag) ? 'text-sky-300' : 'text-amber-300'}`} dir="ltr" aria-label={t('رمز الحقل الفرعي', 'Subfield code')} />
                            <input value={value} onChange={(e) => edit((r) => { (r.fields[i] as DataField).subfields[j][1] = e.target.value; })} dir="auto"
                              title={subfieldName(f.tag, code)} placeholder={subfieldName(f.tag, code)}
                              className={`${mono}`} style={{ width: `${Math.min(40, Math.max(6, value.length + 2))}ch` }} aria-label={`${f.tag} $${code} ${subfieldName(f.tag, code)}`} />
                            <button type="button" onClick={() => edit((r) => { (r.fields[i] as DataField).subfields.splice(j, 1); })} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-rose-400" aria-label={t('احذف الحقل الفرعي', 'Remove subfield')}><X className="h-3 w-3" /></button>
                          </span>
                        ))}
                        {/* Add a subfield: the field's own subfields by name, or any code. */}
                        <select value="" onChange={(e) => { const v = e.target.value; if (v) edit((r) => { (r.fields[i] as DataField).subfields.push([v, '']); }); }}
                          className="w-12 rounded bg-transparent text-xs font-bold text-sky-300 hover:bg-white/10 focus:outline-none cursor-pointer" aria-label={t('أضف حقلاً فرعياً', 'Add subfield')} title={t('أضف حقلاً فرعياً', 'Add subfield')}>
                          <option value="">+$</option>
                          {Object.entries(fieldDef(f.tag)?.subfields || {}).map(([sc, name]) => <option key={sc} value={sc}>${sc} — {name}</option>)}
                          {!fieldDef(f.tag) && 'abcdefghijklmnopqrstuvwxyz0123456789'.split('').map((sc) => <option key={sc} value={sc}>${sc}</option>)}
                        </select>
                      </>
                    )}
                    <span className="ms-auto text-[11px] text-white/40" dir="auto">{fieldName(f.tag, ar)}</span>
                    <button type="button" onClick={() => edit((r) => { r.fields.splice(i, 1); })} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-rose-400" aria-label={t('احذف الحقل', 'Remove field')}><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {isControl(f) && f.tag === '008' && guided === `008-${i}` && (
                    <MarcFixedFieldForm value={f.data} total={40} positions={f008Positions(rec.leader)} ar={ar}
                      onChange={(next) => edit((r) => { (r.fields[i] as any).data = next; })} />
                  )}
                  {issues.map((x, k) => <div key={k} className={`ps-14 text-[11px] ${x.level === 'error' ? 'text-rose-300' : 'text-amber-200'}`}>{ar ? x.ar : x.en}</div>)}
                </div>
              );
            })}
            {/* Add any MARC 21 field: by tag ("505") or by name ("contents", "ملاحظة"). */}
            <div className="relative pt-2">
              <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 px-2 focus-within:border-sky-400">
                <Search className="h-3.5 w-3.5 text-white/50" />
                <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)} dir="auto"
                  onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) { e.preventDefault(); addField(matches[0].tag); } if (e.key === 'Escape') setAddQuery(''); }}
                  placeholder={t('أضف حقلاً: اكتب الرقم أو الاسم (505، ملاحظة، series…)', 'Add a field: type its tag or name (505, contents, series…)')}
                  className="flex-1 bg-transparent py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none" aria-label={t('أضف حقلاً', 'Add a field')} />
              </div>
              {matches.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-white/10 bg-slate-900/95 p-1 shadow-xl" role="listbox">
                  {matches.map((d) => (
                    <li key={d.tag}>
                      <button type="button" onClick={() => addField(d.tag)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-start text-xs text-white hover:bg-white/10">
                        <span className="w-9 shrink-0 rounded text-center font-mono font-bold" style={{ background: BLOCK_COLORS[tagBlock(d.tag)], color: '#0f172a' }}>{d.tag}</span>
                        <span dir="auto" className="flex-1">{ar ? d.ar : d.en}</span>
                        {!d.repeatable && rec.fields.some((x) => x.tag === d.tag) && <span className="text-[10px] text-amber-300">{t('موجود ولا يتكرر', 'already here, not repeatable')}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['008', '020', '041', '082', '100', '246', '250', '490', '500', '504', '505', '520', '546', '600', '650', '651', '700', '856'].map((tag) => (
                <button key={tag} type="button" title={fieldName(tag, ar)}
                  onClick={() => addField(tag)}
                  className="inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 font-mono text-[11px] text-white/80 hover:bg-white/10" style={{ border: `1px solid ${BLOCK_COLORS[tagBlock(tag)]}66` }}>
                  <Plus className="h-3 w-3" />{tag}
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

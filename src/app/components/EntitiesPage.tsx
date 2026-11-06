/**
 * Moon Studio's Entities section (Phase 10, step 2): list, search, create and edit Moon's entities: people
 * and bodies, places, topics, works (hubs), genres and periods. Each has a permanent address on
 * mooon.site/resource/<kind>/<id>; the form's fields follow LC's Marva templates. Arabic names can get their
 * ALA-LC romanized form from LC's ScriptShifter. Every save keeps the earlier version.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Search, Save, History, Languages, ExternalLink, Users, X } from 'lucide-react';
import { moonFetch, moonHeaders, MOON_API } from '../utils/moonApi';
import { romanizeAll } from '../../services/romanize';
import {
  ENTITY_KINDS, AGENT_TYPES, KIND_LABELS, AGENT_LABELS, detailFields, emptyForm, formFrom, formProblems, payloadFrom, hasArabic,
  type EntityKind, type EntityForm, type StoredEntity, type AgentType,
} from '../utils/entityForm';

interface Entity extends StoredEntity {
  id: string;
  uri: string;
  createdBy?: string | null;
  updatedAt?: string;
  mergedInto?: string | null;
}
interface Usage { count: number; records: Array<{ id: string; title: string }> }
interface Version { version: number; label: string; changedBy?: string; changedAt: string }

const GLASS: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.58)',
  borderRadius: '24px',
  boxShadow: '0 20px 50px -10px rgba(15, 23, 42, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255, 255, 255, 0.78)',
};
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-300';

const isAr = () => typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
const t = (ar: string, en: string) => (isAr() ? ar : en);
const L = (pair: [string, string]) => t(pair[0], pair[1]);

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

export function EntitiesPage({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<EntityKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [form, setForm] = useState<EntityForm | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [history, setHistory] = useState<Version[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [romanizing, setRomanizing] = useState(false);

  // Search as you type (a short pause first), in the chosen kind.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ q: query.trim(), limit: '100' });
      if (kind !== 'all') params.set('kind', kind);
      const res = await moonFetch<{ authorities?: Entity[]; error?: string }>(`/authorities?${params}`).catch(() => null);
      if (!live) return;
      setLoading(false);
      if (res?.ok) setList(res.data.authorities || []);
      else toast.error(t('تعذّر البحث في الكيانات', 'Could not search the entities'), { description: res?.data?.error });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [kind, query]);

  const open = async (e: Entity) => {
    setSelected(e);
    setForm(formFrom(e));
    setUsage(null);
    setHistory(null);
    const res = await moonFetch<{ authority?: Entity; usage?: Usage }>(`/authorities/${encodeURIComponent(e.id)}`).catch(() => null);
    if (res?.ok && res.data.authority) {
      setSelected(res.data.authority);
      setForm(formFrom(res.data.authority));
      setUsage(res.data.usage || null);
    }
  };

  const startNew = () => {
    setSelected(null);
    setForm(emptyForm(kind === 'all' ? 'agent' : kind));
    setUsage(null);
    setHistory(null);
  };

  const loadHistory = async () => {
    if (!selected) return;
    const res = await moonFetch<{ history?: Version[] }>(`/authorities/${encodeURIComponent(selected.id)}/history`).catch(() => null);
    setHistory(res?.ok ? res.data.history || [] : []);
  };

  const problems = form ? formProblems(form) : [];
  const set = (patch: Partial<EntityForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const setDetail = (key: string, value: string) => setForm((f) => (f ? { ...f, details: { ...f.details, [key]: value } } : f));

  const save = async () => {
    if (!form || problems.length) return;
    setSaving(true);
    const body = payloadFrom(form, (selected?.data as Record<string, unknown>) || {});
    const res = selected
      ? await moonFetch<any>(`/authorities/${encodeURIComponent(selected.id)}`, { method: 'PUT', body: { ...body, version: selected.version } }).catch(() => null)
      : await moonFetch<any>('/authorities', { body }).catch(() => null);
    setSaving(false);
    if (!res) { toast.error(t('تعذّر الحفظ', 'Could not save')); return; }
    if (res.status === 409 && res.data?.authority) {
      toast.error(t('عدّل شخص آخر هذا الكيان بعد أن فتحته. فُتحت النسخة الأحدث؛ أعد تعديلك عليها.', 'Someone else saved this entity after you opened it. The newer version is open now; make your change again.'));
      setSelected(res.data.authority);
      setForm(formFrom(res.data.authority));
      return;
    }
    if (res.status === 409 && res.data?.other) {
      toast.error(t(`يوجد كيان آخر بهذا الاسم: ${res.data.other.label}`, `Another entity already has this name: ${res.data.other.label}`));
      return;
    }
    if (!res.ok) { toast.error(t('تعذّر الحفظ', 'Could not save'), { description: res.data?.error }); return; }
    const saved: Entity = res.data.authority;
    if (!selected && res.data.existing) toast.message(t('هذا الكيان موجود من قبل؛ فُتح الموجود.', 'This entity already exists; the existing one is open.'));
    else toast.success(t('حُفظ', 'Saved'));
    setList((l) => [saved, ...l.filter((x) => x.id !== saved.id)]);
    await open(saved);
  };

  // ALA-LC romanization of the Arabic name (and Arabic other forms), added as other forms of the name.
  const romanize = async () => {
    if (!form) return;
    const arabic = [form.label, ...form.variants.split('\n')].map((s) => s.trim()).filter((s) => s && hasArabic(s));
    if (!arabic.length) return;
    setRomanizing(true);
    const latin = (await romanizeAll(arabic, `${MOON_API}/scriptshifter/trans`, moonHeaders()).catch(() => [] as string[])).filter(Boolean);
    setRomanizing(false);
    if (!latin.length) { toast.error(t('لم تُرجِع خدمة ScriptShifter شيئاً', 'ScriptShifter gave nothing back')); return; }
    const current = form.variants.split('\n').map((s) => s.trim()).filter(Boolean);
    set({ variants: [...new Set([...current, ...latin])].join('\n') });
    toast.success(t(`أضيف ${latin.length} شكل بالحروف اللاتينية`, `Added ${latin.length} romanized form(s)`));
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((e) => m.set(e.kind, (m.get(e.kind) || 0) + 1));
    return m;
  }, [list]);

  const kindOf = (e: Entity) => (e.kind === 'agent' ? L(AGENT_LABELS[(e.data?.agentType as AgentType) || 'person'] || AGENT_LABELS.person) : L(KIND_LABELS[e.kind]));

  return (
    <div className="min-h-screen px-4 md:px-8 py-6" dir={isAr() ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-white text-sm font-semibold text-slate-700 hover:bg-white">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('لوحة التحكم', 'Dashboard')}
          </button>
          <h1 className="text-2xl font-black text-slate-900">{t('الكيانات', 'Entities')}</h1>
          <span className="text-sm text-slate-500">{t('كل كيان يُفهرس مرة واحدة وله عنوان دائم، وتشير إليه التسجيلات.', 'Each entity is catalogued once, has a permanent address, and records point to it.')}</span>
          <button onClick={startNew} className="ms-auto flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800">
            <Plus className="h-4 w-4" /> {t('كيان جديد', 'New entity')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('نوع الكيان', 'Kind of entity')}>
          {(['all', ...ENTITY_KINDS] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${kind === k ? 'bg-sky-700 text-white border-sky-700' : 'bg-white/70 text-slate-700 border-white hover:bg-white'}`}
            >
              {k === 'all' ? t('الكل', 'All') : L(KIND_LABELS[k])}
              {k !== 'all' && kind === 'all' && counts.get(k) ? <span className="ms-1.5 opacity-70">{counts.get(k)}</span> : null}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
          {/* The list */}
          <div className="p-4 space-y-3" style={GLASS}>
            <div className="relative">
              <Search className="h-4 w-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
              <input
                className={`${INPUT} ps-9`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('ابحث بالاسم أو بأي شكل آخر له', 'Search by name or any other form of it')}
                aria-label={t('بحث', 'Search')}
              />
            </div>
            <div className="text-xs text-slate-500">{loading ? t('جارٍ البحث…', 'Searching…') : t(`${list.length} كيان`, `${list.length} entities`)}</div>
            <ul className="divide-y divide-slate-200/70 max-h-[65vh] overflow-y-auto">
              {list.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => open(e)}
                    className={`w-full text-start px-3 py-2.5 rounded-xl hover:bg-white/70 ${selected?.id === e.id ? 'bg-white' : ''}`}
                  >
                    <div className="text-sm font-semibold text-slate-900" dir="auto">{e.label}</div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-2">
                      <span>{kindOf(e)}</span>
                      {e.variants?.[0] && <span dir="auto">· {e.variants[0]}</span>}
                      {(e.sameAs?.length || 0) > 0 && <span>· {t('مربوط خارجياً', 'linked outside')}</span>}
                    </div>
                  </button>
                </li>
              ))}
              {!loading && !list.length && (
                <li className="px-3 py-6 text-sm text-slate-500 text-center">{t('لا كيانات. أنشئ واحداً بزر «كيان جديد».', 'No entities. Make one with "New entity".')}</li>
              )}
            </ul>
          </div>

          {/* The editor */}
          <div className="p-5 space-y-4" style={GLASS}>
            {!form ? (
              <div className="py-16 text-center text-slate-500 text-sm">{t('اختر كياناً من القائمة أو أنشئ كياناً جديداً.', 'Pick an entity from the list, or make a new one.')}</div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-500">{selected ? t('تعديل كيان', 'Edit entity') : t('كيان جديد', 'New entity')}</div>
                    {selected && (
                      <a href={selected.uri} target="_blank" rel="noreferrer" dir="ltr" className="text-xs text-sky-700 hover:underline break-all inline-flex items-center gap-1">
                        {selected.uri} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <button onClick={() => { setForm(null); setSelected(null); }} className="p-1.5 rounded-full hover:bg-white/70" aria-label={t('إغلاق', 'Close')}>
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label={t('النوع', 'Kind')}>
                    <select
                      className={INPUT}
                      value={form.kind}
                      disabled={!!selected}
                      onChange={(e) => set({ kind: e.target.value as EntityKind, details: {} })}
                    >
                      {ENTITY_KINDS.map((k) => <option key={k} value={k}>{L(KIND_LABELS[k])}</option>)}
                    </select>
                  </Field>
                  {form.kind === 'agent' && (
                    <Field label={t('نوع الفاعل', 'Type of agent')}>
                      <select className={INPUT} value={form.agentType} onChange={(e) => set({ agentType: e.target.value as AgentType })}>
                        {AGENT_TYPES.map((a) => <option key={a} value={a}>{L(AGENT_LABELS[a])}</option>)}
                      </select>
                    </Field>
                  )}
                </div>

                <Field label={t('الاسم المعتمد', 'Authorized name')} hint={form.kind === 'agent' && form.agentType === 'person' ? t('كما في مكتبة الكونغرس: الاسم الأخير، الاسم الأول، التواريخ', 'As LC writes it: Surname, Forename, dates') : undefined}>
                  <input className={INPUT} dir="auto" value={form.label} onChange={(e) => set({ label: e.target.value })} />
                </Field>

                <Field label={t('أشكال أخرى للاسم (شكل في كل سطر)', 'Other forms of the name (one per line)')}>
                  <textarea className={INPUT} dir="auto" rows={3} value={form.variants} onChange={(e) => set({ variants: e.target.value })} />
                </Field>
                {hasArabic(form.label + form.variants) && (
                  <button onClick={romanize} disabled={romanizing} className="flex items-center gap-2 text-sm font-semibold text-sky-700 hover:underline disabled:opacity-50">
                    <Languages className="h-4 w-4" /> {romanizing ? t('جارٍ التحويل…', 'Romanizing…') : t('أضف الشكل اللاتيني (ScriptShifter من مكتبة الكونغرس)', 'Add the romanized form (LC ScriptShifter)')}
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {detailFields(form.kind, form.agentType).map((d) => (
                    <Field key={d.key} label={L(d.label)}>
                      {d.kind === 'uris'
                        ? <textarea className={INPUT} dir="ltr" rows={2} value={form.details[d.key] || ''} onChange={(e) => setDetail(d.key, e.target.value)} />
                        : <input className={INPUT} dir={d.kind === 'uri' ? 'ltr' : 'auto'} placeholder={d.placeholder} value={form.details[d.key] || ''} onChange={(e) => setDetail(d.key, e.target.value)} />}
                      {problems.includes(d.key) && <span className="text-xs text-rose-600">{t('يجب أن يكون رابطاً يبدأ بـ https://', 'Must be a link starting with https://')}</span>}
                    </Field>
                  ))}
                </div>

                <Field label={t('الكيان نفسه في ملفات أخرى (رابط في كل سطر)', 'Same entity elsewhere (one link per line)')} hint={t('مكتبة الكونغرس، VIAF، ويكي بيانات، FAST، ISNI، ORCID', 'Library of Congress, VIAF, Wikidata, FAST, ISNI, ORCID')}>
                  <textarea className={INPUT} dir="ltr" rows={2} value={form.sameAs} onChange={(e) => set({ sameAs: e.target.value })} />
                  {problems.includes('same-as') && <span className="text-xs text-rose-600">{t('كل سطر يجب أن يكون رابطاً', 'Each line must be a link')}</span>}
                </Field>

                <Field label={t('ملاحظة', 'Note')}>
                  <textarea className={INPUT} dir="auto" rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} />
                </Field>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={save}
                    disabled={saving || problems.length > 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> {saving ? t('جارٍ الحفظ…', 'Saving…') : selected ? t('احفظ التعديل', 'Save changes') : t('أنشئ الكيان', 'Create entity')}
                  </button>
                  {problems.includes('name') && <span className="text-xs text-slate-500">{t('الاسم مطلوب', 'A name is required')}</span>}
                  {selected && (
                    <button onClick={loadHistory} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:underline">
                      <History className="h-4 w-4" /> {t('النسخ السابقة', 'Earlier versions')}
                    </button>
                  )}
                </div>

                {selected && (
                  <div className="rounded-2xl bg-white/60 border border-white p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Users className="h-4 w-4" />
                      {usage == null ? t('جارٍ عدّ التسجيلات…', 'Counting records…') : t(`تستخدمه ${usage.count} تسجيلة`, `Used by ${usage.count} record(s)`)}
                    </div>
                    {usage && usage.records.length > 0 && (
                      <ul className="text-sm text-slate-600 list-disc ps-5 space-y-0.5">
                        {usage.records.slice(0, 10).map((r) => <li key={r.id} dir="auto">{r.title}</li>)}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs" dir="ltr">
                      {(['jsonld', 'ttl', 'nt', 'rdf'] as const).map((f) => (
                        <a key={f} href={`${selected.uri}.${f}`} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">{f === 'jsonld' ? 'JSON-LD' : f === 'ttl' ? 'Turtle' : f === 'nt' ? 'N-Triples' : 'RDF/XML'}</a>
                      ))}
                    </div>
                  </div>
                )}

                {history && (
                  <div className="rounded-2xl bg-white/60 border border-white p-4">
                    <div className="text-sm font-semibold text-slate-700 mb-2">{t('النسخ السابقة', 'Earlier versions')}</div>
                    {history.length === 0 ? (
                      <div className="text-sm text-slate-500">{t('لم يُعدَّل بعد.', 'Not edited yet.')}</div>
                    ) : (
                      <ul className="text-sm text-slate-600 space-y-1">
                        {history.map((h) => (
                          <li key={h.version}>
                            <b>v{h.version}</b> · <span dir="auto">{h.label}</span>
                            <span className="text-slate-400"> · {t('استُبدلت', 'replaced')} {new Date(h.changedAt).toLocaleString()}{h.changedBy ? ` · ${h.changedBy}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EntitiesPage;

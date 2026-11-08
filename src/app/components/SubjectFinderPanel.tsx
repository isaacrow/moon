/**
 * "Suggest subjects" in Moon Studio (Phase 13 S16): Moon finds the published records nearest to this one by
 * their words and lists the subjects they use, each with the records that use it; the cataloguer adds the
 * ones that fit. No AI: word similarity over Moon's own catalogue.
 */
import React, { useState } from 'react';
import { Tags, Plus, Loader2 } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';
import { finderText, subjectsOf } from '../../../supabase/functions/server/subjectFinder.tsx';

interface Suggestion { label: string; uri?: string; type?: string; score: number; records: Array<{ id: string; title: string }> }
interface Props { work: any; instance: any; recordId?: string; language: string; onAdd: (subject: any) => void }

export function SubjectFinderPanel({ work, instance, recordId, language, onAdd }: Props) {
  const ar = language === 'ar';
  const t = (a: string, e: string) => (ar ? a : e);
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const suggest = async () => {
    setBusy(true); setMessage('');
    const r = await moonFetch<{ suggestions?: Suggestion[]; error?: string }>('/subjects/suggest', {
      body: { text: finderText(work, instance), have: subjectsOf(work), excludeId: recordId },
    }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setMessage(r?.data?.error || t('تعذّر الاقتراح الآن.', 'Could not suggest just now.')); return; }
    const s = r.data.suggestions || [];
    setList(s);
    if (!s.length) setMessage(t('لم أجد في الفهرس تسجيلات قريبة كفاية. أضف العنوان أو الملخص ثم جرّب.', 'No records near enough in the catalogue. Add the title or a summary, then try again.'));
  };

  const add = (s: Suggestion) => {
    onAdd({ '@type': s.type || 'bf:Topic', ...(s.uri ? { '@id': s.uri } : {}), 'rdfs:label': s.label });
    setList((l) => (l || []).filter((x) => x !== s));
  };

  const box: React.CSSProperties = { borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)' };
  return (
    <div className="p-3 space-y-2" style={box} dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white"><Tags className="h-4 w-4" /> {t('اقتراح الموضوعات', 'Suggest subjects')}</div>
        <button type="button" onClick={suggest} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50" style={box}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tags className="h-3.5 w-3.5" />} {t('اقترح', 'Suggest')}
        </button>
      </div>
      {!list && !message && <p className="text-xs text-white/70">{t('يجد أقرب التسجيلات المنشورة إلى هذه بكلماتها، ويعرض موضوعاتها لتختار منها.', 'Finds the published records nearest to this one by their words, and shows their subjects for you to choose from.')}</p>}
      {message && <p className="text-xs text-white/80">{message}</p>}
      {list && list.length > 0 && (
        <ul className="space-y-1">
          {list.map((s) => (
            <li key={s.uri || s.label} className="flex items-start gap-2 text-xs text-white">
              <button type="button" onClick={() => add(s)} className="shrink-0 p-1 rounded-full hover:bg-white/20" aria-label={t(`أضف ${s.label}`, `Add ${s.label}`)}><Plus className="h-3.5 w-3.5" /></button>
              <span className="flex-1">
                <b dir="auto">{s.label}</b>
                <span className="block text-white/60" dir="auto">{t('في: ', 'Used in: ')}{s.records.slice(0, 3).map((r) => r.title).join(' · ')}{s.records.length > 3 ? ` +${s.records.length - 3}` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

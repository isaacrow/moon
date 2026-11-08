/**
 * Links to check (Phase 13 S16): Moon's links from people, places and subjects to LC, VIAF and Wikidata
 * that look wrong: the source calls it something else, two entities share one link, or the source record is
 * gone. A report for a person to look at; nothing is blocked or changed.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { moonFetch } from '../utils/moonApi';

interface Issue { entityId: string; entityLabel: string; uri: string; kind: 'name-mismatch' | 'shared-link' | 'gone'; detail: string }
const KIND: Record<Issue['kind'], [string, string]> = {
  gone: ['لم يعد في المصدر', 'Gone at the source'],
  'shared-link': ['رابط واحد لكيانين', 'One link, two entities'],
  'name-mismatch': ['الاسم لا يطابق', "Name doesn't match"],
};

export function LinkReportCard({ ar, onOpen }: { ar: boolean; onOpen: (entityId: string) => void }) {
  const t = (a: string, e: string) => (ar ? a : e);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [checked, setChecked] = useState(0);
  useEffect(() => {
    moonFetch<{ issues?: Issue[]; checked?: number }>('/entities/link-report').then((r) => {
      if (r.ok) { setIssues(r.data.issues || []); setChecked(r.data.checked || 0); }
    }).catch(() => {});
  }, []);
  if (!issues || !issues.length) return null;
  return (
    <details className="rounded-2xl bg-white/60 border border-white p-4 mb-4">
      <summary className="cursor-pointer font-bold text-slate-900 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" /> {t(`روابط تحتاج نظرة (${issues.length})`, `Links to check (${issues.length})`)}
        <ChevronDown className="h-4 w-4 ms-auto" />
      </summary>
      <p className="text-xs text-slate-600 mt-2">{t(`فُحصت روابط ${checked} كياناً بما تسمّيها به مكتبة الكونغرس وويكي بيانات. هذا تقرير فقط: لا يُغيَّر شيء ولا يُمنع.`, `Links of ${checked} entities checked against what LC and Wikidata call them. A report only: nothing is changed or blocked.`)}</p>
      <ul className="mt-2 space-y-1.5">
        {issues.slice(0, 100).map((i, n) => (
          <li key={n} className="text-sm">
            <span className="rounded-full bg-amber-100 text-amber-900 text-[11px] px-2 py-0.5 me-2">{t(...KIND[i.kind])}</span>
            <button className="font-semibold text-sky-800 hover:underline" dir="auto" onClick={() => onOpen(i.entityId)}>{i.entityLabel}</button>
            <a href={i.uri.startsWith('http') ? i.uri : `https://${i.uri}`} target="_blank" rel="noreferrer" dir="ltr" className="ms-2 font-mono text-[11px] text-slate-500 break-all">{i.uri.replace(/^https?:\/\/(www\.)?/, '')}</a>
            <span className="block text-xs text-slate-600" dir="auto">{i.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

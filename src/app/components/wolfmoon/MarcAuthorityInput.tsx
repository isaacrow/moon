/**
 * A MARC subfield box that suggests authorities as the cataloguer types: Moon's own entities first, then LC,
 * VIAF, Wikidata, FAST … (the same search as the BIBFRAME fields). When nothing matches, it offers to make the
 * heading a Moon entity, so the field still gets an address.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus } from 'lucide-react';
import { searchAllAuthorities, type AuthorityResult } from '../../../services/authoritySearch';
import type { AuthoritySpec } from '../../../services/marc/marcAuthorityFields';
import { moonFetch } from '../../utils/moonApi';

interface Props {
  value: string;
  spec: AuthoritySpec;
  ar: boolean;
  className: string;
  style?: CSSProperties;
  placeholder?: string;
  ariaLabel: string;
  onChange: (v: string) => void;
  onPick: (r: AuthorityResult) => void;
}

const SOURCE_STYLE: Record<string, string> = { Moon: 'bg-sky-400/25 text-sky-100', LOC: 'bg-white/20 text-white', VIAF: 'bg-white/15 text-white/90', Wikidata: 'bg-white/15 text-white/90' };

export function MarcAuthorityInput({ value, spec, ar, className, style, placeholder, ariaLabel, onChange, onPick }: Props) {
  const t = (a: string, e: string) => (ar ? a : e);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<AuthorityResult[]>([]);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const query = value.replace(/[\s.,:;/=]+$/, '').trim();

  // Search after a short pause, only once the cataloguer has typed in this box.
  useEffect(() => {
    if (!typed || query.length < 2) { setResults([]); return; }
    let live = true;
    setLoading(true);
    const id = setTimeout(async () => {
      const found = await searchAllAuthorities(query, spec.context).catch(() => []);
      if (!live) return;
      setResults(found.slice(0, 8));
      setActive(0);
      setLoading(false);
    }, 350);
    return () => { live = false; clearTimeout(id); setLoading(false); };
  }, [query, typed, spec.context]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (box.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (r: AuthorityResult) => { onPick(r); setOpen(false); setTyped(false); setResults([]); };

  const create = async () => {
    if (!spec.entityKind || !query) return;
    setCreating(true);
    const res = await moonFetch<any>('/authorities', {
      body: { kind: spec.entityKind, label: query, data: spec.entityKind === 'agent' ? { agentType: spec.agentType || 'person' } : {} },
    }).catch(() => null);
    setCreating(false);
    const made = res?.ok ? res.data?.authority : null;
    if (made?.uri) pick({ label: made.label, uri: made.uri, source: 'Moon', sameAs: made.sameAs || [] });
    else pick({ label: query, uri: '', source: 'Local' });
  };

  const KIND: Record<string, [string, string]> = {
    person: ['شخص', 'person'], organization: ['هيئة أو ناشر', 'organization or publisher'], subject: ['موضوع', 'subject'],
    genre: ['نوع أو شكل', 'genre/form'], place: ['مكان', 'place'], work: ['عمل', 'work'],
  };
  const showMenu = open && typed && query.length >= 2;

  // The list is drawn at the top of the page (a portal), placed under the box: glass rows each make their
  // own layer, so a list inside one row would be covered by the rows after it. Above the box when there is
  // more room there.
  useLayoutEffect(() => {
    if (!showMenu) { setPlace(null); return; }
    const measure = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
      const up = below < 220 && above > below;
      const width = Math.max(r.width, 300);
      const left = Math.min(Math.max(8, ar ? r.right - width : r.left), window.innerWidth - width - 8);
      setPlace({ position: 'fixed', left, width, zIndex: 1000, maxHeight: Math.min(360, up ? above : below),
        ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) });
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [showMenu, ar]);
  const canCreate = !!spec.entityKind && !loading && !results.some((r) => r.label.trim().toLowerCase() === query.toLowerCase());

  return (
    <div ref={box} className="relative flex-1 min-w-[200px]">
      <input value={value} dir="auto" placeholder={placeholder} aria-label={ariaLabel} aria-autocomplete="list" aria-expanded={showMenu}
        className={className} style={style}
        onChange={(e) => { onChange(e.target.value); setTyped(true); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showMenu) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]); }
          if (e.key === 'Escape') setOpen(false);
        }} />
      {showMenu && place && createPortal(
        <ul ref={menu} role="listbox" dir={ar ? 'rtl' : 'ltr'} className="overflow-auto p-1.5 text-sm text-white"
          style={{ ...place, background: 'rgba(30,41,59,0.92)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          {loading && <li className="flex items-center gap-2 px-3 py-2 text-white/70"><Loader2 className="h-4 w-4 animate-spin" />{t('يبحث في Moon و LC و VIAF و Wikidata…', 'Searching Moon, LC, VIAF, Wikidata…')}</li>}
          {!loading && results.map((r, k) => (
            <li key={`${r.source}|${r.uri}|${k}`} role="option" aria-selected={k === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}
                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-start ${k === active ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${SOURCE_STYLE[r.source] || 'bg-white/15 text-white/90'}`}>{r.source === 'LOC' ? 'LC' : r.source}</span>
                <span className="flex-1">
                  <span className="block" dir="auto">{r.label}</span>
                  {r.description && <span className="block text-[11px] text-white/60" dir="auto">{r.description}</span>}
                </span>
              </button>
            </li>
          ))}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-white/70">{t(`لا يوجد ${KIND[spec.context][0]} بهذا الاسم في Moon أو LC أو VIAF أو Wikidata.`, `No ${KIND[spec.context][1]} with this name in Moon, LC, VIAF or Wikidata.`)}</li>
          )}
          {canCreate && (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={create} disabled={creating}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start font-semibold text-sky-200 hover:bg-white/10 disabled:opacity-60">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span dir="auto">{t(`أنشئ «${query}» كياناً جديداً في Moon (${KIND[spec.context][0]})`, `Create "${query}" as a Moon ${KIND[spec.context][1]}`)}</span>
              </button>
            </li>
          )}
        </ul>,
        document.body,
      )}
    </div>
  );
}

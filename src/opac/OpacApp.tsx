/**
 * Moon OPAC — the public catalog, redesigned.
 *
 * One material (white glass) over a quiet grey page. Readers see books, authors and
 * subjects in plain Arabic; the linked-data formats live behind one disclosure on the
 * book page for the people who need them.
 *
 * Data comes from wolfMoonOpacService, the same service the previous OPAC used, so the
 * published records, authors and subjects are the live ones.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  Search, Bookmark, BookmarkCheck, Quote, Link2, X, Menu, Download, Copy, Check, ArrowUpRight,
} from 'lucide-react';
import {
  wolfMoonOpacService,
  OpacWorkEntity,
  OpacPersonEntity,
  OpacSubjectEntity,
  resolveWorkCover,
  normalizeArabic,
} from '../services/wolfMoonOpacService';
import { bookJsonLd, metaDescription, pageUrl, workUri } from './schemaOrg';
import {
  FACETS, SORTS as SORT_OPTIONS, applyFacets, facetCounts, sortWorks, readState, writeState, toggle, valueLabel, valuesOf,
  workYearOf, realCopies, libraryOf, languageName, type FacetKey, type FacetValue, type Selection, type SortKey,
} from './facets';
import { MOON_API, moonHeaders } from '../app/utils/moonApi';
import './opac.css';

type View =
  | { mode: 'home' }
  | { mode: 'search'; query: string; params?: string }
  | { mode: 'work'; id: string }
  | { mode: 'person'; key: string }
  | { mode: 'subject'; key: string }
  | { mode: 'hub'; key: string }
  | { mode: 'authors' }
  | { mode: 'subjects' };

function viewFromUrl(): View {
  const p = new URLSearchParams(window.location.search);
  if (p.get('work')) return { mode: 'work', id: p.get('work')! };
  if (p.get('person')) return { mode: 'person', key: p.get('person')! };
  if (p.get('subject')) return { mode: 'subject', key: p.get('subject')! };
  if (p.get('hub')) return { mode: 'hub', key: p.get('hub')! };
  if (p.get('dir') === 'persons') return { mode: 'authors' };
  if (p.get('dir') === 'subjects') return { mode: 'subjects' };
  if (p.has('q')) return { mode: 'search', query: p.get('q') || '' };
  return { mode: 'home' };
}

function urlFor(v: View): string {
  const u = new URL(window.location.href);
  ['work', 'person', 'subject', 'hub', 'dir', 'q', 'view', 'sort', 'page'].forEach(k => u.searchParams.delete(k));
  [...u.searchParams.keys()].filter(k => k.startsWith('f_')).forEach(k => u.searchParams.delete(k));
  if (v.mode === 'work') u.searchParams.set('work', v.id);
  if (v.mode === 'person') u.searchParams.set('person', v.key);
  if (v.mode === 'subject') u.searchParams.set('subject', v.key);
  if (v.mode === 'hub') u.searchParams.set('hub', v.key);
  if (v.mode === 'authors') u.searchParams.set('dir', 'persons');
  if (v.mode === 'subjects') u.searchParams.set('dir', 'subjects');
  if (v.mode === 'search') {
    u.searchParams.set('q', v.query);
    // Back to a filtered list: its filters, sort and page come along.
    new URLSearchParams(v.params || '').forEach((val, k) => { if (k.startsWith('f_') || k === 'sort' || k === 'page') u.searchParams.append(k, val); });
  }
  return u.toString();
}

const STATUS_LABEL: Record<string, string> = {
  available: 'متاح للإعارة',
  checked_out: 'معار حالياً',
  paged: 'قيد التجهيز',
  reference_only: 'للاطلاع داخل المكتبة',
  digital_access: 'نسخة رقمية',
  not_connected: 'لا توجد نسخ بعد',
};

function personName(p?: OpacPersonEntity): string {
  if (!p) return '';
  return p.nameArabic || p.name || p.nameEnglish || '';
}

function workYear(w: OpacWorkEntity): string {
  const y = w.instances.find(i => i.publicationYear)?.publicationYear || w.originDate || '';
  return String(y).replace(/[^\d٠-٩\-–/ ]/g, '').trim() || String(y);
}

/** Some imported subjects carry only an authority id (sh96010368) as their label; keep those off the browse surfaces. */
function isReadableLabel(label: string): boolean {
  const t = (label || '').trim();
  return t.length > 1 && !/^[a-z]{0,4}\d{4,}$/i.test(t) && !/^https?:/i.test(t);
}

/** "Author (مؤلف)" → "مؤلف": readers get the Arabic role only. */
function roleLabel(role?: string): string {
  if (!role) return '';
  const inParens = role.match(/\(([^)]*[؀-ۿ][^)]*)\)/);
  if (inParens) return inParens[1].trim();
  return /[؀-ۿ]/.test(role) ? role.trim() : '';
}

function initial(s: string) {
  const t = s.replace(/^(د\.|الدكتور|الشيخ|السيد)\s*/, '').trim();
  return t.charAt(0) || '؟';
}

/**
 * Moves between views with the browser's View Transitions: the old page fades and blurs out,
 * the new one rises in, and anything sharing a view-transition-name (a book's cover, an
 * author's photo, the header, the current-section pill) glides from its old place to its new one.
 * Browsers without the API, and people who ask for reduced motion, get the plain update
 * (plus a short CSS fade-in where the API is missing).
 */
function withTransition(update: () => void) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const run = () => {
    flushSync(update);
    window.scrollTo({ top: 0 });
  };
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (reduce || !doc.startViewTransition) { run(); return; }
  doc.startViewTransition(run);
}

/** Pages render as one keyed block so the fallback fade and the card stagger replay on each visit. */
function viewKey(v: View): string {
  return v.mode + ':' + ('id' in v ? v.id : 'key' in v ? v.key : 'query' in v ? v.query : '');
}

// ---------------------------------------------------------------------------

export function OpacApp({ onOpenEditor }: { onOpenEditor?: () => void }) {
  const [view, setView] = useState<View>(() => viewFromUrl());
  const [ready, setReady] = useState(false);
  const [rev, setRev] = useState(0);
  const [saved, setSaved] = useState<string[]>(() => wolfMoonOpacService.getBookbagIds());
  const [savedOpen, setSavedOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    wolfMoonOpacService.initDatabase().then(() => { if (alive) { setReady(true); setRev(r => r + 1); } });
    const off = wolfMoonOpacService.subscribe(() => { setReady(true); setRev(r => r + 1); });
    const onPop = () => withTransition(() => setView(viewFromUrl()));
    window.addEventListener('popstate', onPop);
    if (!(document as any).startViewTransition) document.documentElement.classList.add('no-vt');
    return () => { alive = false; off(); window.removeEventListener('popstate', onPop); };
  }, []);

  const go = useCallback((v: View) => {
    window.history.pushState({}, '', urlFor(v));
    withTransition(() => {
      setView(v);
      setNavOpen(false);
    });
  }, []);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout((say as any)._t);
    (say as any)._t = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const toggleSave = useCallback((id: string) => {
    const r = wolfMoonOpacService.toggleBookbag(id);
    setSaved(r.items);
    say(r.added ? 'أُضيف إلى قائمتك' : 'أُزيل من قائمتك');
  }, [say]);

  useEffect(() => {
    const titles: Record<View['mode'], string> = {
      home: 'فهرس مون', search: 'نتائج البحث — فهرس مون', work: 'فهرس مون', person: 'فهرس مون',
      subject: 'فهرس مون', hub: 'فهرس مون', authors: 'المؤلفون — فهرس مون', subjects: 'الموضوعات — فهرس مون',
    };
    // A record page sets its own title (the book's), with its schema.org data.
    if (view.mode !== 'work') document.title = titles[view.mode];
  }, [view]);

  const ctx: Ctx = { go, saved, toggleSave, say, rev };

  return (
    <div className="app" dir="rtl" lang="ar">
      <div className="ambient" aria-hidden="true" />
      <header className="topbar wrap">
        <div className="topbar-inner glass">
          <button className="brand" onClick={() => go({ mode: 'home' })} aria-label="فهرس مون، الصفحة الرئيسية">
            <img className="brand-logo" src="/opac-logo.png" alt="مون" width={230} height={120} />
          </button>
          <nav className={`nav ${navOpen ? 'open glass' : ''}`} aria-label="الأقسام">
            {([
              ['الرئيسية', { mode: 'home' }, view.mode === 'home'],
              ['الكتب', { mode: 'search', query: '' }, view.mode === 'search' || view.mode === 'work'],
              ['المؤلفون', { mode: 'authors' }, view.mode === 'authors' || view.mode === 'person'],
              ['الموضوعات', { mode: 'subjects' }, view.mode === 'subjects' || view.mode === 'subject'],
            ] as [string, View, boolean][]).map(([label, target, current]) => (
              <button key={label} aria-current={current ? 'page' : undefined} onClick={() => go(target)}>
                {current && <span className="nav-pill" aria-hidden="true" />}
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => setSavedOpen(true)} aria-label={`قائمتي، ${saved.length} كتاب`}>
              <Bookmark size={20} strokeWidth={1.8} />
              {saved.length > 0 && <span className="badge">{saved.length}</span>}
            </button>
            <button className="btn-black" onClick={onOpenEditor}>دخول المفهرسين</button>
            <button className="icon-btn menu-toggle" onClick={() => setNavOpen(o => !o)} aria-expanded={navOpen} aria-label="القائمة">
              {navOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main>
        {!ready ? <Loading /> : (
          <div className="view" key={viewKey(view)}>
            {view.mode === 'home' && <Home ctx={ctx} />}
            {view.mode === 'search' && <Results key={view.query} ctx={ctx} query={view.query} />}
            {view.mode === 'work' && <WorkPage key={view.id} ctx={ctx} id={view.id} />}
            {view.mode === 'person' && <PersonPage key={view.key} ctx={ctx} k={view.key} />}
            {view.mode === 'subject' && <SubjectPage key={view.key} ctx={ctx} k={view.key} />}
            {view.mode === 'hub' && <HubPage key={view.key} ctx={ctx} k={view.key} />}
            {view.mode === 'authors' && <AuthorsPage ctx={ctx} />}
            {view.mode === 'subjects' && <SubjectsPage ctx={ctx} />}
          </div>
        )}
      </main>

      <footer className="footer wrap">
        <div className="footer-inner glass">
          <span className="footer-brand"><img src="/opac-logo.png" alt="مون" width={230} height={120} /> الفهرس العام للمكتبة</span>
          <span>{ready ? `${wolfMoonOpacService.getAllWorks().length} كتاب منشور` : ''}</span>
        </div>
      </footer>

      {savedOpen && <SavedSheet ctx={ctx} onClose={() => setSavedOpen(false)} />}
      {toast && <div className="toast glass" role="status">{toast}</div>}
    </div>
  );
}

type Ctx = {
  go: (v: View) => void;
  saved: string[];
  toggleSave: (id: string) => void;
  say: (m: string) => void;
  rev: number;
};

// ---------------------------------------------------------------------------
// Shared pieces

function coverUrlOf(work: OpacWorkEntity): string | undefined {
  return work.coverUrl || resolveWorkCover(work) || work.instances.find(i => i.coverUrl)?.coverUrl || undefined;
}

/** A record without a cover image gets a typographic jacket (title + author); tiny thumbnails get a plain moon. */
function Cover({ work, big, jacket = true, morph = true }: { work: OpacWorkEntity; big?: boolean; jacket?: boolean; morph?: boolean }) {
  const url = coverUrlOf(work);
  const [broken, setBroken] = useState(false);
  return (
    <div className={`cover ${big ? 'big' : ''}`} style={morph ? { viewTransitionName: vtName('cover', work.id) } as React.CSSProperties : undefined}>
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className={`cover-blank ${jacket ? 'with-title' : ''}`} aria-hidden="true">
          {jacket ? (
            <>
              <span className="ct" dir="auto">{work.title}</span>
              {big ? <span className="ca" dir="auto">{personName(work.primaryCreator)}</span> : <span className="cover-moon small" />}
            </>
          ) : <span className="cover-moon" />}
        </div>
      )}
    </div>
  );
}

/** A view-transition-name must be a CSS identifier and unique on the page; record ids are neither guaranteed to be. */
function vtName(kind: string, id: string): string {
  return `${kind}-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

const stagger = (i = 0) => ({ '--i': Math.min(i, 12) } as React.CSSProperties);

function BookCard({ work, ctx, i }: { work: OpacWorkEntity; ctx: Ctx; i?: number }) {
  return (
    <button className="book glass rise" style={stagger(i)} onClick={() => ctx.go({ mode: 'work', id: work.id })}>
      <Cover work={work} />
      <div className="book-meta">
        {coverUrlOf(work) && <div className="t" dir="auto">{work.title}</div>}
        <div className="a" dir="auto">{personName(work.primaryCreator)}</div>
        {workYear(work) && <div className="y">{workYear(work)}</div>}
      </div>
    </button>
  );
}

function Avatar({ p, cls = '', morph }: { p: OpacPersonEntity; cls?: string; morph?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`avatar ${cls}`} aria-hidden="true" style={morph ? { viewTransitionName: vtName('avatar', p.id) } as React.CSSProperties : undefined}>
      {p.avatarUrl && !broken ? <img src={p.avatarUrl} alt="" onError={() => setBroken(true)} /> : initial(personName(p))}
    </span>
  );
}

function PersonCard({ p, ctx, i }: { p: OpacPersonEntity; ctx: Ctx; i?: number }) {
  return (
    <button className="person glass rise" style={stagger(i)} onClick={() => ctx.go({ mode: 'person', key: p.id })}>
      <Avatar p={p} morph />
      <span>
        <span className="t" dir="auto" style={{ display: 'block' }}>{personName(p)}</span>
        <span className="s">{p.lifespan ? `${p.lifespan} · ` : ''}{p.worksCount} {p.worksCount === 1 ? 'كتاب' : 'كتب'}</span>
      </span>
    </button>
  );
}

function SearchBox({ ctx, initial = '', autoFocus, compact }: { ctx: Ctx; initial?: string; autoFocus?: boolean; compact?: boolean }) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); inputRef.current?.focus(); }
    };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  const s = useMemo(() => (q.trim() ? wolfMoonOpacService.deepCategorizedSearch(q) : null), [q, ctx.rev]);
  const items = useMemo(() => {
    if (!s) return [] as { kind: string; label: string; sub: string; view: View }[];
    return [
      ...s.works.slice(0, 5).map(w => ({ kind: 'الكتب', label: w.title, sub: personName(w.primaryCreator), view: { mode: 'work', id: w.id } as View })),
      ...s.persons.slice(0, 3).map(p => ({ kind: 'المؤلفون', label: personName(p), sub: `${p.worksCount} كتب`, view: { mode: 'person', key: p.id } as View })),
      ...s.subjects.slice(0, 4).map(x => ({ kind: 'الموضوعات', label: x.label, sub: `${x.worksCount} كتب`, view: { mode: 'subject', key: x.id } as View })),
    ];
  }, [s]);

  const submit = () => { setOpen(false); ctx.go({ mode: 'search', query: q.trim() }); };

  let lastKind = '';
  return (
    <div className="search" ref={ref} role="search">
      <form className={`search-field glass ${compact ? 'compact' : ''}`} onSubmit={e => { e.preventDefault(); active >= 0 && items[active] ? ctx.go(items[active].view) : submit(); }}>
        <Search size={22} strokeWidth={1.8} aria-hidden="true" />
        <label className="sr-only" htmlFor="opac-q">ابحث في الفهرس</label>
        <input
          id="opac-q" ref={inputRef} value={q} autoFocus={autoFocus} autoComplete="off"
          placeholder="عنوان، مؤلف، موضوع، أو رقم ISBN"
          onChange={e => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)); }
            if (e.key === 'Escape') setOpen(false);
          }}
          role="combobox" aria-expanded={open && items.length > 0} aria-controls="opac-suggest"
        />
        <span className="kbd" aria-hidden="true">/</span>
        <button type="submit" className="btn-black">بحث</button>
      </form>
      {open && s && (
        <div className="suggest glass" id="opac-suggest" role="listbox">
          {items.length === 0 && <div className="suggest-head">لا نتائج لـ «{q}». جرّب كلمة أقصر أو اسم المؤلف.</div>}
          {items.map((it, i) => {
            const head = it.kind !== lastKind ? it.kind : null;
            lastKind = it.kind;
            return (
              <React.Fragment key={i}>
                {head && <div className="suggest-head">{head}</div>}
                <button type="button" role="option" aria-selected={i === active} data-active={i === active} className="suggest-item" onMouseEnter={() => setActive(i)} onClick={() => { setOpen(false); ctx.go(it.view); }}>
                  <span className="t">{it.label}</span>
                  <span className="s">{it.sub}</span>
                </button>
              </React.Fragment>
            );
          })}
          {items.length > 0 && <button type="button" className="suggest-all" onClick={submit}>كل النتائج لـ «{q.trim()}»</button>}
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="wrap" aria-busy="true" aria-label="جارٍ تحميل الفهرس">
      <div className="hero">
        <div className="skeleton" style={{ height: 64, maxWidth: 520, margin: '0 auto' }} />
        <div className="skeleton" style={{ height: 68, maxWidth: 720, margin: '40px auto 0' }} />
      </div>
      <div className="shelf">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '2/3.6' }} />)}
      </div>
    </div>
  );
}

function Crumbs({ ctx, items }: { ctx: Ctx; items: { label: string; view?: View }[] }) {
  return (
    <nav className="crumbs" aria-label="المسار">
      <button onClick={() => ctx.go({ mode: 'home' })}>الرئيسية</button>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <span aria-hidden="true">/</span>
          {it.view ? <button onClick={() => ctx.go(it.view!)}>{it.label}</button> : <span aria-current="page">{it.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Home

function Shelf({ title, works, ctx, more }: { title: string; works: OpacWorkEntity[]; ctx: Ctx; more?: { label: string; view: View } }) {
  if (!works.length) return null;
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {more && <button className="link-btn" onClick={() => ctx.go(more.view)}>{more.label}</button>}
      </div>
      <div className="shelf">{works.map((w, i) => <BookCard key={w.id} work={w} ctx={ctx} i={i} />)}</div>
    </section>
  );
}

function Home({ ctx }: { ctx: Ctx }) {
  const works = useMemo(() => wolfMoonOpacService.getAllWorks(), [ctx.rev]);
  const recent = useMemo(() => [...works].sort((a, b) => (b.modifiedAt || '').localeCompare(a.modifiedAt || '')).slice(0, 12), [works]);
  const authors = useMemo(() => wolfMoonOpacService.getAllPersons().filter(p => p.worksCount > 0).slice(0, 8), [ctx.rev]);
  const subjects = useMemo(() => wolfMoonOpacService.getAllSubjects().filter(s => s.worksCount > 0 && isReadableLabel(s.label)).slice(0, 14), [ctx.rev]);
  // Libris's home: categories to start from, then shelves.
  const categories = useMemo(() => facetCounts(works, {}).category.slice(0, 8), [works]);
  const manuscripts = useMemo(() => works.filter(w => /مخطوط|manuscript/i.test([...(w.genreForm || []), ...valuesOf(w, 'format')].join(' '))).slice(0, 12), [works]);
  const withCopies = useMemo(() => works.filter(w => realCopies(w).length > 0).slice(0, 12), [works]);
  const featured = useMemo(() => {
    const top = [...wolfMoonOpacService.getAllPersons()].filter(p => p.worksCount > 1).sort((a, b) => b.worksCount - a.worksCount)[0];
    return top ? { person: top, works: wolfMoonOpacService.getPersonByNameOrUri(top.id)?.works.slice(0, 12) || [] } : null;
  }, [ctx.rev]);
  const languages = useMemo(() => facetCounts(works, {}).lang.slice(0, 6), [works]);

  return (
    <>
      <section className="hero wrap">
        <h1>اعثر على كتابك التالي</h1>
        <p className="hero-sub">ابحث في {works.length} كتاباً بالعنوان أو المؤلف أو الموضوع، واعرف أين تجده في المكتبة.</p>
        <SearchBox ctx={ctx} />
        {categories.length > 0 && (
          <div className="quick" aria-label="الفئات">
            <span className="quick-lbl">الفئات</span>
            {categories.map(c => (
              <button key={c.value} className="chip" onClick={() => ctx.go({ mode: 'search', query: '', params: `f_category=${encodeURIComponent(c.value)}` })}>
                {c.label} <span className="n">{c.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="wrap">
        <Shelf title="أُضيف حديثاً" works={recent} ctx={ctx} more={{ label: 'كل الكتب', view: { mode: 'search', query: '', params: 'sort=date-desc' } }} />
        {featured && featured.works.length > 1 && (
          <Shelf title={`من أعمال ${personName(featured.person)}`} works={featured.works} ctx={ctx} more={{ label: 'صفحة المؤلف', view: { mode: 'person', key: featured.person.id } }} />
        )}
        <Shelf title="مخطوطات" works={manuscripts} ctx={ctx} />
        <Shelf title="على رفوف المكتبة" works={withCopies} ctx={ctx} more={{ label: 'كل ما له نسخ', view: { mode: 'search', query: '', params: 'f_avail=physical' } }} />

        {languages.length > 1 && (
          <section className="section">
            <div className="section-head"><h2>حسب اللغة</h2></div>
            <div className="subjects">
              {languages.map(l => (
                <button key={l.value} className="chip" onClick={() => ctx.go({ mode: 'search', query: '', params: `f_lang=${encodeURIComponent(l.value)}` })}>
                  {l.label} <span className="n">{l.count}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {authors.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2>مؤلفون في الفهرس</h2>
              <button className="link-btn" onClick={() => ctx.go({ mode: 'authors' })}>كل المؤلفين</button>
            </div>
            <div className="people">{authors.map((p, i) => <PersonCard key={p.id} p={p} ctx={ctx} i={i} />)}</div>
          </section>
        )}

        {subjects.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2>تصفّح حسب الموضوع</h2>
              <button className="link-btn" onClick={() => ctx.go({ mode: 'subjects' })}>كل الموضوعات</button>
            </div>
            <div className="subjects">
              {subjects.map(s => (
                <button key={s.id} className="chip" onClick={() => ctx.go({ mode: 'subject', key: s.id })}>
                  {s.label} <span className="n">{s.worksCount}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="linked-strip glass">
            <div>
              <h2>الفهرس كبيانات مترابطة</h2>
              <p className="muted">كل كتاب وشخص وموضوع هنا له عنوان دائم على mooon.site بصيغة BIBFRAME، يمكن للمكتبات والباحثين ربطه وإعادة استخدامه.</p>
            </div>
            <div className="dl-links">
              <a href="/resource/">قائمة السجلات</a>
              <a href="/resource/sparql">SPARQL</a>
              <a href="/resource/dump.jsonld">تنزيل الفهرس (JSON-LD)</a>
              <a href="/resource/dump.nt">N-Triples</a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Search results

const PAGE_SIZE = 20;
const RESULTS_KEY = 'moon-opac:last-results';

/** The result list a record page was opened from, so it can offer "previous / next result". */
export function lastResults(): { ids: string[]; url: string; query: string } | null {
  try { return JSON.parse(sessionStorage.getItem(RESULTS_KEY) || 'null'); } catch { return null; }
}

function holdingsSummary(w: OpacWorkEntity): { text: string; s: string } {
  const copies = realCopies(w);
  const libs = new Set(copies.map(c => libraryOf(c.heldBy)).filter(Boolean)).size;
  if (valuesOf(w, 'avail').includes('online')) return { text: 'متاح على الإنترنت', s: 'digital_access' };
  if (copies.length) {
    const c = copies.length === 1 ? 'نسخة واحدة' : copies.length === 2 ? 'نسختان' : `${copies.length} نسخ`;
    return { text: libs > 1 ? `${c} · ${libs} مكتبات` : c, s: 'available' };
  }
  return { text: 'لا نسخ مسجلة', s: 'not_connected' };
}

function contributorsLine(w: OpacWorkEntity): React.ReactNode[] {
  const main = personName(w.primaryCreator);
  const others = (w.contributors || []).filter(c => c !== w.primaryCreator && personName(c) && personName(c) !== main);
  const parts: React.ReactNode[] = [];
  if (main) parts.push(<span key="m" className="who">{main}</span>);
  others.slice(0, 2).forEach((c, i) => parts.push(
    <span key={i} className="who">{personName(c)}{c.role && roleLabel(c.role) ? <span className="role"> ({roleLabel(c.role)})</span> : null}</span>,
  ));
  if (others.length > 2) parts.push(<span key="more" className="more">+{others.length - 2}</span>);
  return parts;
}

/** One result, as Libris shows it: category · language, the title, who made it (with roles), format · year, holdings. */
function ResultCard({ w, ctx, i }: { w: OpacWorkEntity; ctx: Ctx; i: number }) {
  const meta = [w.genreForm?.[0], languageName(w.languageLabel, w.language)].filter(Boolean).join(' · ');
  const fmt = valuesOf(w, 'format')[0];
  const year = workYearOf(w);
  const h = holdingsSummary(w);
  const who = contributorsLine(w);
  return (
    <button className="row result glass rise" style={stagger(i)} onClick={() => ctx.go({ mode: 'work', id: w.id })}>
      <Cover work={w} jacket={false} />
      <div style={{ minWidth: 0 }}>
        {meta && <div className="kicker">{meta}</div>}
        <div className="t" dir="auto">{w.title}{w.subtitle ? <span className="sub"> : {w.subtitle}</span> : null}</div>
        {w.expressionOfHub?.label && <div className="hub" dir="auto">من العمل: <span className="inline-link" role="link" tabIndex={0} onClick={(e) => { e.stopPropagation(); ctx.go({ mode: 'hub', key: w.expressionOfHub!.uri }); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); ctx.go({ mode: 'hub', key: w.expressionOfHub!.uri }); } }}>{w.expressionOfHub.label}</span></div>}
        {who.length > 0 && <div className="s" dir="auto">{who.reduce<React.ReactNode[]>((a, n, k) => (k ? [...a, '، ', n] : [n]), [])}</div>}
        <div className="m">{[fmt, year].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="side">
        <span className="status" data-s={h.s}>{h.text}</span>
      </div>
    </button>
  );
}

function FacetGroup({ title, k, values, sel, onToggle, needle, startOpen }: {
  title: string; k: FacetKey; values: FacetValue[]; sel: Selection; onToggle: (k: FacetKey, v: string) => void; needle: string; startOpen: boolean;
}) {
  const [more, setMore] = useState(false);
  const chosen = sel[k] || [];
  const shown = needle ? values.filter(v => normalizeArabic(v.label).includes(needle)) : values;
  if (!shown.length) return null;
  const list = more || needle ? shown : shown.slice(0, 6);
  return (
    <details className="group" open={startOpen || chosen.length > 0 || !!needle}>
      <summary><span>{title}</span>{chosen.length > 0 && <span className="badge">{chosen.length}</span>}</summary>
      <div className="opts">
        {list.map(o => {
          const on = chosen.includes(o.value);
          return (
            <button key={o.value} className="opt" role="checkbox" aria-checked={on} aria-pressed={on} disabled={!on && o.count === 0}
              onClick={() => onToggle(k, o.value)}>
              <span className="box" aria-hidden="true">{on ? '✓' : ''}</span>
              <span className="l" dir="auto">{o.label}</span>
              <span className="n">{o.count}</span>
            </button>
          );
        })}
        {!needle && shown.length > 6 && (
          <button className="opt-more" onClick={() => setMore(m => !m)}>{more ? 'عرض أقل' : `عرض المزيد (+${shown.length - 6})`}</button>
        )}
      </div>
    </details>
  );
}

function Results({ ctx, query }: { ctx: Ctx; query: string }) {
  const initial = useMemo(() => readState(new URLSearchParams(window.location.search)), [query]);
  const [sel, setSel] = useState<Selection>(initial.sel);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [page, setPage] = useState(initial.page);
  const [needle, setNeedle] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Every work matching the words, in order of relevance; the filters and the sort apply on top.
  const base = useMemo(
    () => wolfMoonOpacService.searchWorks(query, 'all', 'all', 'all', 'all', 'relevance', 1, 100000).works,
    [query, ctx.rev],
  );
  const filtered = useMemo(() => sortWorks(applyFacets(base, sel), sort), [base, sel, sort]);
  const counts = useMemo(() => facetCounts(base, sel), [base, sel]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);

  // The filters live in the address, so a filtered list can be shared, bookmarked and come back with Back.
  useEffect(() => {
    const p = writeState(new URLSearchParams(window.location.search), { sel, sort, page });
    const url = `${window.location.pathname}?${p.toString()}`;
    if (url !== `${window.location.pathname}${window.location.search}`) history.replaceState(history.state, '', url);
    try { sessionStorage.setItem(RESULTS_KEY, JSON.stringify({ ids: filtered.map(w => w.id), url, query })); } catch { /* private mode */ }
  }, [sel, sort, page, filtered, query]);

  const onToggle = (k: FacetKey, v: string) => { setSel(s => toggle(s, k, v)); setPage(1); };
  const clear = () => { setSel({}); setPage(1); };
  const chips = (Object.entries(sel) as [FacetKey, string[]][]).flatMap(([k, vs]) => vs.map(v => ({ k, v, label: valueLabel(k, v) })));
  const activeCount = chips.length;
  const n = normalizeArabic(needle.trim());

  return (
    <div className="wrap">
      <div className="page-head">
        <Crumbs ctx={ctx} items={[{ label: query ? 'نتائج البحث' : 'الكتب' }]} />
        <h1 className="page-title">{query ? <>نتائج «{query}»</> : 'كل الكتب'}</h1>
      </div>
      <div style={{ maxWidth: 720 }}><SearchBox ctx={ctx} initial={query} compact /></div>

      <div className="results-layout">
        <aside className={`filters glass ${showFilters ? 'open' : ''}`} aria-label="تضييق النتائج">
          <div className="filters-head">
            <h2>الفلاتر</h2>
            {activeCount > 0 && <button className="link-btn" onClick={clear}>مسح الكل</button>}
          </div>
          <label className="filter-search">
            <span className="sr-only">ابحث في الفلاتر</span>
            <input value={needle} onChange={e => setNeedle(e.target.value)} placeholder="ابحث في الفلاتر…" />
          </label>
          {FACETS.map(({ key, title }, idx) => (
            <FacetGroup key={key} k={key} title={title} values={counts[key]} sel={sel} onToggle={onToggle} needle={n} startOpen={idx < 4} />
          ))}
        </aside>

        <section aria-live="polite">
          <div className="results-bar glass">
            <span className="count">عدد النتائج: {filtered.length}</span>
            <button className="btn-ghost filters-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(s => !s)}>
              الفلاتر{activeCount ? ` (${activeCount})` : ''}
            </button>
            <label className="sort">
              <span>الترتيب:</span>
              <select className="select" value={sort} onChange={e => { setSort(e.target.value as SortKey); setPage(1); }}>
                {SORT_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="chips" aria-label="الفلاتر المختارة">
              {chips.map(c => (
                <button key={`${c.k}:${c.v}`} className="chip-x" onClick={() => onToggle(c.k, c.v)} aria-label={`إزالة ${c.label}`}>
                  <span dir="auto">{c.label}</span><span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <div className="empty glass">
              <h3>لم نجد كتباً تطابق بحثك</h3>
              <p>تأكد من الإملاء، أو ابحث باسم المؤلف وحده، أو أزل بعض الفلاتر.</p>
              {activeCount ? <button className="btn-black" onClick={clear}>إزالة الفلاتر</button> : <button className="btn-black" onClick={() => ctx.go({ mode: 'search', query: '' })}>تصفّح كل الكتب</button>}
            </div>
          ) : (
            <div className="rows">
              {shown.map((w, i) => <ResultCard key={w.id} w={w} ctx={ctx} i={i} />)}
            </div>
          )}

          {pages > 1 && (
            <nav className="pager" aria-label="الصفحات">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</button>
              {Array.from({ length: pages }).slice(0, 9).map((_, i) => (
                <button key={i} className="btn-ghost" aria-pressed={page === i + 1} aria-label={`الصفحة ${i + 1}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>التالي</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work page

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * The record page's <head> for search engines: its title, description, canonical address, and the
 * book as schema.org JSON-LD. Put back to the catalogue's own when the page is left.
 */
function useRecordHead(work: OpacWorkEntity | undefined) {
  useEffect(() => {
    if (!work) return;
    const head = document.head;
    const meta = head.querySelector<HTMLMetaElement>('meta[name="description"]');
    const before = { title: document.title, description: meta?.content };
    const who = work.primaryCreator?.nameArabic || work.primaryCreator?.name;
    document.title = [work.title, who].filter(Boolean).join(' — ') + ' | فهرس مون';
    if (meta) meta.content = metaDescription(work);
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = pageUrl(work.id);
    const data = document.createElement('script');
    data.type = 'application/ld+json';
    data.id = 'schema-org-book';
    data.textContent = JSON.stringify(bookJsonLd(work));
    head.append(canonical, data);
    return () => {
      canonical.remove();
      data.remove();
      document.title = before.title;
      if (meta && before.description !== undefined) meta.content = before.description;
    };
  }, [work]);
}

/** "Result 3 of 15", previous / next, and back to the filtered list the record was opened from. */
function ResultNav({ ctx, id }: { ctx: Ctx; id: string }) {
  const last = lastResults();
  const idx = last ? last.ids.indexOf(id) : -1;
  if (!last || idx < 0) return null;
  const params = new URL(last.url, window.location.origin).searchParams;
  const back = () => ctx.go({ mode: 'search', query: last.query, params: params.toString() });
  const open = (k: number) => ctx.go({ mode: 'work', id: last.ids[k] });
  return (
    <nav className="result-nav glass" aria-label="التنقل بين النتائج">
      <button className="link-btn" onClick={back}>→ العودة إلى النتائج</button>
      <span className="pos">النتيجة {idx + 1} من {last.ids.length}</span>
      <span className="pn">
        <button className="btn-ghost" disabled={idx <= 0} onClick={() => open(idx - 1)}>السابق</button>
        <button className="btn-ghost" disabled={idx >= last.ids.length - 1} onClick={() => open(idx + 1)}>التالي</button>
      </span>
    </nav>
  );
}

/** Downloads the record as MARC 21 (ISO 2709), MARCXML or MarcEdit text, made from its stored BIBFRAME. */
async function downloadMarc(work: OpacWorkEntity, kind: 'mrc' | 'xml' | 'mrk', say: (s: string) => void) {
  try {
    const [{ bibframeToMarc }, marc] = await Promise.all([import('../services/marc/bibframeToMarc'), import('../services/marc/marcRecord')]);
    const rec = bibframeToMarc(work.document && Array.isArray(work.document['@graph']) ? work.document : { '@graph': [] }, { recordId: work.id });
    if (kind === 'mrc') {
      const bytes = marc.toIso2709(rec);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/marc' }));
      a.download = `${work.id}.mrc`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } else if (kind === 'xml') {
      download(`${work.id}.xml`, marc.toMarcXml([rec]), 'application/marcxml+xml');
    } else {
      download(`${work.id}.mrk`, marc.toMrk(rec), 'text/plain');
    }
  } catch {
    say('تعذّر إنشاء ملف MARC لهذا الكتاب');
  }
}

function WorkPage({ ctx, id }: { ctx: Ctx; id: string }) {
  const work = useMemo(() => wolfMoonOpacService.getWorkByIdOrUri(id), [id, ctx.rev]);
  useRecordHead(work);
  const related = useMemo(() => (work ? wolfMoonOpacService.getRelatedWorks(work.id, 6).filter(w => w.id !== work.id) : []), [work]);
  // Other works of the same hub: its translations, other editions, selections.
  const siblings = useMemo(() => (work?.expressionOfHub?.uri
    ? wolfMoonOpacService.getAllWorks().filter(w => w.id !== work.id && w.expressionOfHub?.uri === work.expressionOfHub!.uri)
    : []), [work]);
  const [citeOpen, setCiteOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (!work) {
    return (
      <div className="wrap">
        <div className="page-head"><Crumbs ctx={ctx} items={[{ label: 'كتاب غير موجود' }]} /></div>
        <div className="empty glass">
          <h3>هذا الكتاب غير موجود في الفهرس</h3>
          <p>ربما حُذف أو لم يُنشر بعد. ابحث عنه بالعنوان.</p>
          <button className="btn-black" onClick={() => ctx.go({ mode: 'search', query: '' })}>تصفّح كل الكتب</button>
        </div>
      </div>
    );
  }

  const inst = work.instances[0];
  const isSaved = ctx.saved.includes(work.id);
  const summary = work.summaryArabic || work.summaryEnglish;
  const copies = realCopies(work);
  const libraries = [...new Set(copies.map(c => libraryOf(c.heldBy)).filter(Boolean))];
  const online = valuesOf(work, 'avail').includes('online');
  const kicker = [work.genreForm?.join('، '), languageName(work.languageLabel, work.language)].filter(Boolean).join(' · ');
  const fmt = valuesOf(work, 'format')[0];
  const year = workYearOf(work);
  const uri = workUri(work);
  const people = [work.primaryCreator, ...(work.contributors || [])]
    .filter((p, i, all) => p && personName(p) && all.findIndex(q => q && personName(q) === personName(p)) === i);
  const publisher = inst?.publisher || work.publisher?.name;
  const searchFor = (q: string) => ctx.go({ mode: 'search', query: q });

  const details: [string, React.ReactNode][] = ([
    ['المساهمون والأدوار', people.length ? (
      <span className="people">{people.map((p, i) => (
        <React.Fragment key={p.id || i}>
          {i > 0 && '، '}
          <button className="inline-link" onClick={() => ctx.go({ mode: 'person', key: p.id })}>{personName(p)}</button>
          {roleLabel(p.role) && <span className="role"> ({roleLabel(p.role)})</span>}
          {p.lifespan && <span className="role"> {p.lifespan}</span>}
        </React.Fragment>
      ))}</span>
    ) : null],
    ['العنوان', [work.title, work.subtitle].filter(Boolean).join(' : ')],
    ['النشر', [[inst?.publicationPlace, publisher].filter(Boolean).join(' : '), inst?.publicationYear || work.originDate].filter(Boolean).join('، ')],
    ['الوصف المادي', [inst?.extent || work.extent, inst?.dimensions || work.dimensions].filter(Boolean).join(' ؛ ')],
    ['السلسلة', work.series],
    ['المعرّفات', [...new Set(work.instances.map(i => i.isbn).filter(Boolean))].map(x => `ISBN ${x}`).join('، ')],
    ['التصنيف', [work.classificationLcc && `${work.classificationLcc} (LCC)`, work.classificationDdc && `${work.classificationDdc} (ديوي)`].filter(Boolean).join('، ')],
    ['رقم الاستدعاء', inst?.callNumber],
    ['ملاحظات', (work.notes || []).filter(Boolean).join(' — ')],
    ['المحتويات', work.tableOfContents],
    ['رقم التسجيلة', work.id],
  ] as [string, any][]).filter(([, v]) => v && (typeof v !== 'string' || v.trim()));
  const shownDetails = showAll ? details : details.slice(0, 6);

  const copyLink = async () => {
    await navigator.clipboard?.writeText(pageUrl(work.id)).catch(() => {});
    ctx.say('نُسخ رابط الكتاب');
  };

  return (
    <div className="wrap">
      <div className="page-head" style={{ paddingBottom: 0 }}>
        <Crumbs ctx={ctx} items={[{ label: 'الكتب', view: { mode: 'search', query: '' } }, { label: work.title }]} />
      </div>
      <ResultNav ctx={ctx} id={work.id} />

      <div className="work">
        <aside className="work-aside">
          <div className="frame glass"><Cover work={work} big /></div>
          <div className="actions glass">
            <button className="btn-black" onClick={() => ctx.toggleSave(work.id)} aria-pressed={isSaved}>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}{isSaved ? 'في قائمتك' : 'احفظ في قائمتك'}
              </span>
            </button>
            <button className="btn-ghost" onClick={() => setCiteOpen(true)}><Quote size={16} />استشهد</button>
            <button className="btn-ghost" onClick={copyLink}><Link2 size={16} />انسخ الرابط</button>
          </div>
        </aside>

        <div className="work-main">
          <section className="work-intro glass rise">
            {kicker && <div className="kicker">{kicker}</div>}
            <h1 className="page-title book-title">{work.title}</h1>
            {work.subtitle && <div className="subtitle">{work.subtitle}</div>}
            {people.length > 0 && (
              <div className="byline">
                {work.primaryCreator && personName(work.primaryCreator) && <Avatar p={work.primaryCreator} morph />}
                <div className="people">
                  {people.slice(0, 4).map((p, i) => (
                    <React.Fragment key={p.id || i}>
                      {i > 0 && '، '}
                      <button onClick={() => ctx.go({ mode: 'person', key: p.id })}>{personName(p)}</button>
                      {roleLabel(p.role) && <span className="role"> ({roleLabel(p.role)})</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
            <div className="pubfacts">
              {inst?.isbn && <div>ISBN {inst.isbn}{fmt ? ` · ${fmt}` : ''}</div>}
              {(publisher || year) && (
                <div>
                  النشر: {inst?.publicationPlace ? `${inst.publicationPlace} : ` : ''}
                  {publisher ? <button className="inline-link" onClick={() => searchFor(publisher)}>{publisher}</button> : null}
                  {year ? `، ${year}` : ''}
                </div>
              )}
              {(inst?.extent || work.extent) && <div>{inst?.extent || work.extent}</div>}
              {!inst?.isbn && fmt && <div>{fmt}</div>}
            </div>
            <div className="holdings-cta">
              {online || copies.length ? (
                <a className="btn-black" href="#h-where" onClick={(e) => { e.preventDefault(); document.getElementById('h-where')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                  {online ? 'متاح على الإنترنت' : `نسخة ورقية · ${libraries.length > 1 ? `${libraries.length} مكتبات` : (libraries[0] || 'المكتبة')}`}
                </a>
              ) : <span className="status" data-s="not_connected">لا نسخ مسجلة بعد</span>}
              {work.instances.length > 1 && <a className="btn-ghost" href="#h-eds" onClick={(e) => { e.preventDefault(); document.getElementById('h-eds')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{work.instances.length} طبعات</a>}
            </div>
            {(work.genreForm?.length || work.subjects.length) ? (
              <div className="terms">
                {work.genreForm && work.genreForm.length > 0 && (
                  <div><span className="lbl">الفئة</span>{work.genreForm.map(g => <button key={g} className="chip" onClick={() => searchFor(g)}>{g}</button>)}</div>
                )}
                {work.subjects.filter(s => isReadableLabel(s.label)).length > 0 && (
                  <div><span className="lbl">الموضوع</span>{work.subjects.filter(s => isReadableLabel(s.label)).map(s => <button key={s.id} className="chip" onClick={() => ctx.go({ mode: 'subject', key: s.id })}>{s.label}</button>)}</div>
                )}
              </div>
            ) : null}
          </section>

          {summary && (
            <section className="panel glass rise" aria-labelledby="h-sum">
              <h2 id="h-sum">نبذة</h2>
              <p className="summary">{summary}</p>
            </section>
          )}

          {details.length > 0 && (
            <section className="panel glass rise" aria-labelledby="h-det">
              <h2 id="h-det">التفاصيل</h2>
              <dl className="dl">
                {shownDetails.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}
              </dl>
              {details.length > 6 && <button className="link-btn" onClick={() => setShowAll(s => !s)} style={{ marginTop: 12 }}>{showAll ? 'تفاصيل أقل' : 'كل التفاصيل'}</button>}
            </section>
          )}

          <section className="panel glass rise" aria-labelledby="h-where-t" id="h-where">
            <h2 id="h-where-t">أين تجده</h2>
            {copies.length === 0 ? (
              <p className="muted">لم تُسجَّل نسخ لهذا الكتاب بعد. اسأل المكتبة عنه برقم التسجيلة {work.id}.</p>
            ) : (
              <div className="libraries">
                {(libraries.length ? libraries : ['']).map(lib => {
                  const here = copies.filter(c => libraryOf(c.heldBy) === lib);
                  return (
                    <div key={lib || 'x'} className="library">
                      <div className="lib-name">{lib || 'المكتبة'} <span className="n">{here.length === 1 ? 'نسخة واحدة' : here.length === 2 ? 'نسختان' : `${here.length} نسخ`}</span></div>
                      {here.map(c => {
                        const where = String(c.heldBy || '').split(' — ').slice(1).join(' — ');
                        const s = c.status && c.status !== 'not_connected' ? c.status : 'not_connected';
                        return (
                          <div key={c.id} className="copy">
                            <span className="t">{[where, c.shelfMark && `الرف ${c.shelfMark}`].filter(Boolean).join(' · ') || 'نسخة'}</span>
                            <span className="status" data-s={s}>{s === 'not_connected' ? 'اسأل المكتبة عن إتاحتها' : STATUS_LABEL[s] || s}</span>
                            <span className="m">{[c.copyNumber && `نسخة رقم ${c.copyNumber}`, c.barcode && `الباركود ${c.barcode}`, ...(c.notes || [])].filter(Boolean).join('، ')}</span>
                            {c.accessUrl && <a className="link-btn" href={c.accessUrl} target="_blank" rel="noreferrer">افتح النسخة الرقمية</a>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {work.instances.length > 1 && (
            <section className="panel glass rise" aria-labelledby="h-eds-t" id="h-eds">
              <h2 id="h-eds-t">طبعات هذا العمل</h2>
              <div className="copies">
                {work.instances.map(i => (
                  <div key={i.id} className="copy">
                    <span className="t">{[i.publicationPlace, i.publisher].filter(Boolean).join(' : ') || i.title}{i.publicationYear ? `، ${i.publicationYear}` : ''}</span>
                    <span className="m">{[i.isbn && `ISBN ${i.isbn}`, i.extent].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {siblings.length > 0 && (
            <section className="panel glass rise" aria-labelledby="h-hub">
              <h2 id="h-hub">من العمل نفسه{work.expressionOfHub?.label ? <>: <button className="inline-link" onClick={() => ctx.go({ mode: 'hub', key: work.expressionOfHub!.uri })}>{work.expressionOfHub.label}</button></> : ''}</h2>
              <p className="muted">ترجمات وطبعات أخرى مرتبطة بالمحور نفسه (bf:Hub).</p>
              <div className="rows">{siblings.map((w, i) => <ResultCard key={w.id} w={w} ctx={ctx} i={i} />)}</div>
            </section>
          )}

          <section className="panel glass rise linked" aria-labelledby="h-ld">
            <h2 id="h-ld">البيانات المترابطة</h2>
            <div className="perma">
              <span className="lbl">المعرّف الدائم</span>
              <a href={uri} dir="ltr">{uri}</a>
            </div>
            <div className="dl-links">
              <span className="lbl">نزّل البيانات الوصفية</span>
              <a href={`${uri}.jsonld`} target="_blank" rel="noreferrer">JSON-LD</a>
              <a href={`${uri}.ttl`} target="_blank" rel="noreferrer">Turtle</a>
              <a href={`${uri}.nt`} target="_blank" rel="noreferrer">N-Triples</a>
              <button className="inline-link" onClick={() => downloadMarc(work, 'mrc', ctx.say)}>MARC 21 (ISO 2709)</button>
              <button className="inline-link" onClick={() => downloadMarc(work, 'xml', ctx.say)}>MARCXML</button>
              <button className="inline-link" onClick={() => downloadMarc(work, 'mrk', ctx.say)}>MarcEdit (.mrk)</button>
            </div>
            <p className="muted">
              كل ما في هذه الصفحة بيانات BIBFRAME مترابطة: لكل عمل وطبعة ونسخة وشخص وموضوع عنوان دائم على mooon.site،
              ويمكن الاستعلام عنها عبر <a href="/resource/sparql">SPARQL</a> أو تنزيل الفهرس كاملاً من <a href="/resource/">قائمة السجلات</a>.
            </p>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>كتب قريبة منه</h2></div>
          <div className="shelf">{related.map((w, i) => <BookCard key={w.id} work={w} ctx={ctx} i={i} />)}</div>
        </section>
      )}

      {citeOpen && <CiteDialog work={work} ctx={ctx} onClose={() => setCiteOpen(false)} />}
    </div>
  );
}

function CiteDialog({ work, ctx, onClose }: { work: OpacWorkEntity; ctx: Ctx; onClose: () => void }) {
  const c = useMemo(() => wolfMoonOpacService.generateCitations(work), [work]);
  const [copied, setCopied] = useState<string | null>(null);
  useEscape(onClose);
  const rows: [string, string][] = [['APA', c.apa], ['Chicago', c.chicago], ['MLA', c.mla], ['BibTeX', c.bibtex]];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog glass" role="dialog" aria-modal="true" aria-labelledby="cite-h">
        <div className="sheet-head">
          <h2 id="cite-h">استشهد بهذا الكتاب</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 6 }}>{k}</div>
              <div className="cite-row">
                <div className="cite" style={k === 'BibTeX' ? { direction: 'ltr', textAlign: 'left', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13, whiteSpace: 'pre-wrap' } : undefined}>{v}</div>
                <button className="icon-btn" aria-label={`انسخ ${k}`} onClick={() => { navigator.clipboard?.writeText(v); setCopied(k); ctx.say(`نُسخ استشهاد ${k}`); }}>
                  {copied === k ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fn(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [fn]);
}

// ---------------------------------------------------------------------------
// Person, subject, directories

/** Works as a list, newest first (Libris lists an entity's works this way). */
function WorkRows({ works, ctx }: { works: OpacWorkEntity[]; ctx: Ctx }) {
  const sorted = useMemo(() => sortWorks(works, 'date-desc'), [works]);
  return <div className="rows">{sorted.map((w, i) => <ResultCard key={w.id} w={w} ctx={ctx} i={i} />)}</div>;
}

/** The years a set of works spans, e.g. "1650–2026". */
function yearSpan(works: OpacWorkEntity[]): string {
  const ys = works.map(workYearOf).filter((y): y is number => !!y).sort((a, b) => a - b);
  if (!ys.length) return '';
  return ys[0] === ys[ys.length - 1] ? String(ys[0]) : `${ys[0]}–${ys[ys.length - 1]}`;
}

/** A Moon authority entry (mooon.site/resource/agent|topic|hub/…) whose name or variant is exactly this one. */
interface MoonEntry { id: string; uri: string; label: string; variants: string[]; sameAs: string[]; note?: string | null }
function useMoonAuthority(kind: 'agent' | 'topic' | 'hub', name: string | undefined): MoonEntry | null {
  const [entry, setEntry] = useState<MoonEntry | null>(null);
  useEffect(() => {
    setEntry(null);
    const n = normalizeArabic(String(name || '').trim());
    if (!n) return;
    let live = true;
    const params = new URLSearchParams({ q: String(name), kind, limit: '5' });
    fetch(`${MOON_API}/authorities?${params}`, { headers: moonHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live) return;
        const found = (d?.authorities || []).find((a: MoonEntry) =>
          [a.label, ...(a.variants || [])].some(x => normalizeArabic(x) === n));
        setEntry(found || null);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [kind, name]);
  return entry;
}

const SAME_AS_LABEL = (u: string) =>
  /viaf\.org/.test(u) ? 'VIAF' : /id\.loc\.gov/.test(u) ? 'مكتبة الكونغرس' : /wikidata\.org/.test(u) ? 'ويكي بيانات' : /isni/.test(u) ? 'ISNI' : new URL(u).hostname;

/** The entity's own address and data, and where it links out to (owl:sameAs). */
function LinkedPanel({ uri, sameAs, note }: { uri?: string; sameAs: string[]; note?: string }) {
  const own = uri && uri.startsWith('https://mooon.site/resource/') ? uri : undefined;
  const links = [...new Set(sameAs.filter(u => /^https?:\/\//.test(u)))];
  if (!own && !links.length) return null;
  return (
    <section className="panel glass rise linked" aria-labelledby="h-ld">
      <h2 id="h-ld">البيانات المترابطة</h2>
      {own && (
        <>
          <div className="perma"><span className="lbl">المعرّف الدائم</span><a href={own} dir="ltr">{own}</a></div>
          <div className="dl-links">
            <span className="lbl">نزّل</span>
            <a href={`${own}.jsonld`} target="_blank" rel="noreferrer">JSON-LD</a>
            <a href={`${own}.ttl`} target="_blank" rel="noreferrer">Turtle</a>
            <a href={`${own}.nt`} target="_blank" rel="noreferrer">N-Triples</a>
          </div>
        </>
      )}
      {links.length > 0 && (
        <div className="dl-links">
          <span className="lbl">الكيان نفسه في</span>
          {links.map(u => <a key={u} href={u} target="_blank" rel="noreferrer">{SAME_AS_LABEL(u)} <ArrowUpRight size={13} /></a>)}
        </div>
      )}
      {note && <p className="muted">{note}</p>}
    </section>
  );
}

function PersonPage({ ctx, k }: { ctx: Ctx; k: string }) {
  const r = useMemo(() => wolfMoonOpacService.getPersonByNameOrUri(k), [k, ctx.rev]);
  const moon = useMoonAuthority('agent', r ? personName(r.person) : undefined);
  if (!r) return <NotFound ctx={ctx} what="المؤلف" back={{ mode: 'authors' }} backLabel="كل المؤلفين" />;
  const { person: p, works } = r;
  const name = personName(p);
  // Libris groups a person's works by what they did: wrote it, translated it, edited it …
  const roleIn = (w: OpacWorkEntity) => {
    if (personName(w.primaryCreator) === name) return roleLabel(w.primaryCreator.role) || 'مؤلف';
    const c = (w.contributors || []).find(x => personName(x) === name);
    return roleLabel(c?.role) || 'مشارك';
  };
  const groups = new Map<string, OpacWorkEntity[]>();
  works.forEach(w => { const g = roleIn(w); groups.set(g, [...(groups.get(g) || []), w]); });
  const subjects = [...new Map(works.flatMap(w => w.subjects).filter(s => isReadableLabel(s.label)).map(s => [s.label, s])).values()].slice(0, 10);
  const langs = [...new Set(works.map(w => languageName(w.languageLabel, w.language)).filter(Boolean))];
  const sameAs = [
    p.viafUri, p.locUri, p.isniUri,
    p.wikidataId ? (p.wikidataId.startsWith('http') ? p.wikidataId : `https://www.wikidata.org/wiki/${p.wikidataId}`) : undefined,
    ...(moon?.sameAs || []),
  ].filter((u): u is string => !!u);
  const variants = (moon?.variants || []).filter(v => v !== name);
  const span = yearSpan(works);

  return (
    <div className="wrap">
      <div className="page-head" style={{ paddingBottom: 0 }}>
        <Crumbs ctx={ctx} items={[{ label: 'المؤلفون', view: { mode: 'authors' } }, { label: name }]} />
      </div>
      <section className="person-hero glass rise">
        <Avatar p={p} cls="xl" morph />
        <div>
          <div className="kicker">شخص</div>
          <h1 className="page-title">{name}</h1>
          <p className="lede">{[p.nameEnglish && p.nameEnglish !== name ? p.nameEnglish : '', p.lifespan, p.city].filter(Boolean).join('، ')}</p>
          {variants.length > 0 && <p className="muted">أشكال أخرى للاسم: {variants.join(' · ')}</p>}
          {(p.bioArabic || p.bioEnglish) && <p className="bio">{p.bioArabic || p.bioEnglish}</p>}
          <div className="entity-facts">
            <span><b>{works.length}</b> {works.length === 1 ? 'عمل' : 'أعمال'} في الفهرس</span>
            {span && <span>{span.includes('–') ? 'بين' : 'سنة'} <b>{span}</b></span>}
            {langs.length > 0 && <span>بـ{langs.join(' و')}</span>}
          </div>
        </div>
      </section>

      <div className="entity-layout">
        <div className="entity-main">
          {[...groups].map(([role, ws]) => (
            <section key={role} className="section" style={{ marginTop: 24 }}>
              <div className="section-head"><h2>{role === 'مؤلف' ? 'من تأليفه' : `بصفته ${role}`} <span className="count-n">{ws.length}</span></h2>
                <button className="link-btn" onClick={() => ctx.go({ mode: 'search', query: '', params: `f_author=${encodeURIComponent(name)}` })}>في البحث مع الفلاتر</button>
              </div>
              <WorkRows works={ws} ctx={ctx} />
            </section>
          ))}
        </div>
        <aside className="entity-side">
          <LinkedPanel uri={moon?.uri} sameAs={sameAs} note={moon ? undefined : 'لهذا الشخص سجل في ملفات الاستناد العالمية؛ يمكن إضافته إلى ملف مون الاستنادي من محرر مون.'} />
          {subjects.length > 0 && (
            <section className="panel glass rise">
              <h2>يكتب في</h2>
              <div className="subjects">{subjects.map(s => <button key={s.id} className="chip" onClick={() => ctx.go({ mode: 'subject', key: s.id })}>{s.label}</button>)}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SubjectPage({ ctx, k }: { ctx: Ctx; k: string }) {
  const r = useMemo(() => wolfMoonOpacService.getSubjectByLabelOrUri(k), [k, ctx.rev]);
  const moon = useMoonAuthority('topic', r?.subject.label);
  if (!r) return <NotFound ctx={ctx} what="الموضوع" back={{ mode: 'subjects' }} backLabel="كل الموضوعات" />;
  const { subject: s, works } = r;
  const near = [s.broader, ...(s.narrower || []), ...(s.related || [])].filter(Boolean) as string[];
  const authors = [...new Map(works.map(w => w.primaryCreator).filter(p => p && personName(p)).map(p => [personName(p), p])).values()].slice(0, 8);
  const span = yearSpan(works);
  const sameAs = [s.uri, ...(moon?.sameAs || [])].filter((u): u is string => !!u && /^https?:\/\//.test(u) && !u.startsWith('https://mooon.site/'));
  return (
    <div className="wrap">
      <div className="page-head">
        <Crumbs ctx={ctx} items={[{ label: 'الموضوعات', view: { mode: 'subjects' } }, { label: s.label }]} />
        <div className="kicker">موضوع</div>
        <h1 className="page-title">{s.label}</h1>
        <p className="lede">{[s.labelEnglish, `${works.length} ${works.length === 1 ? 'عمل' : 'أعمال'}`, span].filter(Boolean).join('، ')}</p>
        {near.length > 0 && (
          <div className="terms" style={{ borderTop: 0, paddingTop: 0 }}>
            <div><span className="lbl">موضوعات قريبة</span>{near.map(n => <button key={n} className="chip" onClick={() => ctx.go({ mode: 'subject', key: n })}>{n}</button>)}</div>
          </div>
        )}
      </div>
      <div className="entity-layout">
        <div className="entity-main">
          <div className="section-head">
            <h2>الأعمال <span className="count-n">{works.length}</span></h2>
            <button className="link-btn" onClick={() => ctx.go({ mode: 'search', query: '', params: `f_subject=${encodeURIComponent(s.label)}` })}>في البحث مع الفلاتر</button>
          </div>
          <WorkRows works={works} ctx={ctx} />
        </div>
        <aside className="entity-side">
          <LinkedPanel uri={moon?.uri} sameAs={sameAs} />
          {authors.length > 0 && (
            <section className="panel glass rise">
              <h2>كتب فيه</h2>
              <div className="subjects">{authors.map(p => <button key={p.id} className="chip" onClick={() => ctx.go({ mode: 'person', key: p.id })}>{personName(p)}</button>)}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

/** A hub (bf:Hub): one creative work across its translations, editions and selections. */
function HubPage({ ctx, k }: { ctx: Ctx; k: string }) {
  const works = useMemo(() => wolfMoonOpacService.getAllWorks().filter(w => w.expressionOfHub?.uri === k), [k, ctx.rev]);
  const label = works[0]?.expressionOfHub?.label || '';
  const moon = useMoonAuthority('hub', label);
  if (!works.length) return <NotFound ctx={ctx} what="العمل" back={{ mode: 'search', query: '' }} backLabel="كل الكتب" />;
  const langs = [...new Set(works.map(w => languageName(w.languageLabel, w.language)).filter(Boolean))];
  const own = k.startsWith('https://mooon.site/resource/hub/') ? k : moon?.uri;
  const sameAs = [k, ...(moon?.sameAs || [])].filter(u => !u.startsWith('https://mooon.site/'));
  return (
    <div className="wrap">
      <div className="page-head">
        <Crumbs ctx={ctx} items={[{ label: 'الكتب', view: { mode: 'search', query: '' } }, { label }]} />
        <div className="kicker">عمل (محور bf:Hub)</div>
        <h1 className="page-title" dir="auto">{label}</h1>
        <p className="lede">{works.length} {works.length === 1 ? 'تعبير' : 'تعبيرات'} في الفهرس{langs.length ? ` · ${langs.join('، ')}` : ''}{yearSpan(works) ? ` · ${yearSpan(works)}` : ''}</p>
      </div>
      <div className="entity-layout">
        <div className="entity-main">
          <div className="section-head"><h2>الترجمات والطبعات</h2></div>
          <WorkRows works={works} ctx={ctx} />
        </div>
        <aside className="entity-side">
          <LinkedPanel uri={own} sameAs={sameAs} note="المحور يجمع كل ترجمات العمل الواحد وطبعاته ومختاراته، كما تفعل مكتبة الكونغرس ولِبريس." />
        </aside>
      </div>
    </div>
  );
}

function useFilter<T>(list: T[], text: (t: T) => string) {
  const [q, setQ] = useState('');
  const out = useMemo(() => {
    const n = normalizeArabic(q.trim());
    return n ? list.filter(x => normalizeArabic(text(x)).includes(n)) : list;
  }, [list, q]);
  return { q, setQ, out };
}

function FilterField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="search-field glass">
      <Search size={20} strokeWidth={1.8} aria-hidden="true" />
      <input aria-label={label} placeholder={label} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function AuthorsPage({ ctx }: { ctx: Ctx }) {
  const all = useMemo(() => wolfMoonOpacService.getAllPersons(), [ctx.rev]);
  const { q, setQ, out } = useFilter(all, p => `${p.nameArabic} ${p.name} ${p.nameEnglish || ''}`);
  return (
    <div className="wrap">
      <div className="page-head">
        <Crumbs ctx={ctx} items={[{ label: 'المؤلفون' }]} />
        <h1 className="page-title">المؤلفون</h1>
        <p className="lede">{all.length} مؤلفاً ومساهماً في الفهرس</p>
        <div className="dir-tools"><FilterField value={q} onChange={setQ} label="ابحث عن مؤلف" /></div>
      </div>
      <section className="section" style={{ marginTop: 28 }}>
        {out.length ? <div className="people">{out.map((p, i) => <PersonCard key={p.id} p={p} ctx={ctx} i={i} />)}</div>
          : <div className="empty glass"><h3>لا يوجد مؤلف بهذا الاسم</h3><p>جرّب جزءاً من الاسم فقط.</p></div>}
      </section>
    </div>
  );
}

function SubjectsPage({ ctx }: { ctx: Ctx }) {
  const all = useMemo(() => wolfMoonOpacService.getAllSubjects().filter(s => isReadableLabel(s.label)), [ctx.rev]);
  const { q, setQ, out } = useFilter(all, s => `${s.label} ${s.labelEnglish || ''}`);
  return (
    <div className="wrap">
      <div className="page-head">
        <Crumbs ctx={ctx} items={[{ label: 'الموضوعات' }]} />
        <h1 className="page-title">الموضوعات</h1>
        <p className="lede">{all.length} موضوعاً</p>
        <div className="dir-tools"><FilterField value={q} onChange={setQ} label="ابحث عن موضوع" /></div>
      </div>
      <section className="section" style={{ marginTop: 28 }}>
        {out.length ? (
          <div className="subject-list">
            {out.map((s, i) => (
              <button key={s.id} className="subject-row glass rise" style={stagger(i)} onClick={() => ctx.go({ mode: 'subject', key: s.id })}>
                <span className="t">{s.label}</span>
                <span className="n">{s.worksCount} {s.worksCount === 1 ? 'كتاب' : 'كتب'}</span>
              </button>
            ))}
          </div>
        ) : <div className="empty glass"><h3>لا يوجد موضوع بهذا الاسم</h3><p>جرّب كلمة أعم.</p></div>}
      </section>
    </div>
  );
}

function NotFound({ ctx, what, back, backLabel }: { ctx: Ctx; what: string; back: View; backLabel: string }) {
  return (
    <div className="wrap">
      <div className="page-head"><Crumbs ctx={ctx} items={[{ label: backLabel, view: back }]} /></div>
      <div className="empty glass">
        <h3>لم نجد هذا {what} في الفهرس</h3>
        <p>ربما تغيّر الرابط. اختره من القائمة.</p>
        <button className="btn-black" onClick={() => ctx.go(back)}>{backLabel}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved list

function SavedSheet({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const works = useMemo(() => ctx.saved.map(id => wolfMoonOpacService.getWorkByIdOrUri(id)).filter(Boolean) as OpacWorkEntity[], [ctx.saved]);
  useEscape(onClose);
  const exp = (f: 'ris' | 'bibtex') => download(`moon-list.${f === 'ris' ? 'ris' : 'bib'}`, wolfMoonOpacService.exportBookbag(f), 'text/plain');
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="sheet glass" role="dialog" aria-modal="true" aria-labelledby="saved-h">
        <div className="sheet-head">
          <h2 id="saved-h">قائمتي</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="sheet-body">
          {works.length === 0 ? (
            <p style={{ color: 'var(--ink-2)' }}>احفظ الكتب التي تهمّك من صفحة كل كتاب، وستجدها هنا.</p>
          ) : works.map(w => (
            <div key={w.id} className="mini">
              <Cover work={w} jacket={false} morph={false} />
              <button style={{ background: 'none', border: 0, padding: 0, textAlign: 'start' }} onClick={() => { onClose(); ctx.go({ mode: 'work', id: w.id }); }}>
                <div className="t">{w.title}</div>
                <div className="s">{personName(w.primaryCreator)}</div>
              </button>
              <button className="icon-btn" aria-label={`أزل ${w.title}`} onClick={() => ctx.toggleSave(w.id)}><X size={16} /></button>
            </div>
          ))}
        </div>
        {works.length > 0 && (
          <div className="sheet-foot">
            <button className="btn-ghost" style={{ justifyContent: 'center' }} onClick={() => exp('ris')}><Download size={16} />RIS</button>
            <button className="btn-ghost" style={{ justifyContent: 'center' }} onClick={() => exp('bibtex')}><Download size={16} />BibTeX</button>
          </div>
        )}
      </aside>
    </>
  );
}

export default OpacApp;

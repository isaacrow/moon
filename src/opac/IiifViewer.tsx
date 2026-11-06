/**
 * Page viewer for a record's digitised copy: when one of its links is a IIIF manifest, its pages are shown
 * here (thumbnails, one page large, previous / next, arrow keys). Nothing is shown when no link is a manifest.
 */
import React, { useEffect, useState } from 'react';
import { findManifest, IiifManifest, looksLikeManifest } from '../services/iiif';
import { t, opacLang } from './i18n';

export function IiifViewer({ urls }: { urls: string[] }) {
  const [manifest, setManifest] = useState<IiifManifest | null>(null);
  const [page, setPage] = useState(0);
  const key = urls.filter(looksLikeManifest).join(' ');

  useEffect(() => {
    let live = true;
    setManifest(null);
    setPage(0);
    if (key) findManifest(key.split(' ')).then((m) => { if (live) setManifest(m); });
    return () => { live = false; };
  }, [key]);

  if (!manifest) return null;
  const rtl = opacLang() === 'ar';
  const last = manifest.pages.length - 1;
  const go = (n: number) => setPage(Math.max(0, Math.min(last, n)));
  const current = manifest.pages[page];

  return (
    <section className="panel glass rise" aria-labelledby="h-iiif">
      <h2 id="h-iiif">{t('صفحات النسخة الرقمية', 'Pages of the digital copy')}</h2>
      <div
        className="iiif-stage"
        tabIndex={0}
        aria-roledescription={t('عارض الصفحات', 'page viewer')}
        onKeyDown={(e) => {
          // In Arabic the next page is to the left, as in the book.
          if (e.key === 'ArrowLeft') go(page + (rtl ? 1 : -1));
          if (e.key === 'ArrowRight') go(page + (rtl ? -1 : 1));
        }}
        style={{ textAlign: 'center' }}
      >
        <img
          src={current.image(1000)}
          alt={`${manifest.label || t('صفحة', 'Page')} — ${current.label}`}
          style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 8 }}
        />
        <div className="iiif-controls" style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}>
          <button type="button" className="link-btn" onClick={() => go(page - 1)} disabled={page === 0}>{t('السابقة', 'Previous')}</button>
          <span className="muted" aria-live="polite">{current.label} · {page + 1} / {last + 1}</span>
          <button type="button" className="link-btn" onClick={() => go(page + 1)} disabled={page === last}>{t('التالية', 'Next')}</button>
          <a className="link-btn" href={current.image(3000)} target="_blank" rel="noreferrer">{t('بحجم كامل', 'Full size')}</a>
        </div>
      </div>
      <div className="iiif-thumbs" role="list" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBlock: 8 }}>
        {manifest.pages.map((p, i) => (
          <button key={i} type="button" role="listitem" onClick={() => go(i)} aria-label={`${t('صفحة', 'Page')} ${p.label}`}
            aria-current={i === page ? 'true' : undefined}
            style={{ flex: '0 0 auto', padding: 0, border: i === page ? '2px solid #0ea5e9' : '1px solid rgba(0,0,0,0.15)', borderRadius: 6, background: 'none', cursor: 'pointer' }}>
            <img src={p.thumb} alt="" loading="lazy" style={{ height: 72, display: 'block', borderRadius: 4 }} />
          </button>
        ))}
      </div>
      {manifest.attribution && <p className="muted" style={{ fontSize: 12 }}>{manifest.attribution}</p>}
    </section>
  );
}

/**
 * IIIF (https://iiif.io): page images of a digitised book or manuscript, shared by libraries and archives.
 * A record links to a IIIF Presentation manifest (bf:electronicLocator on its Item); this reads the
 * manifest (Presentation 2 or 3) into pages with image addresses at the size the viewer needs.
 */

export interface IiifPage { label: string; image: (width: number) => string; thumb: string }
export interface IiifManifest { label: string; pages: IiifPage[]; attribution?: string; rights?: string }

/** A link worth trying as a manifest (most manifest URLs say so); others are not fetched. */
export const looksLikeManifest = (url: string) => /^https:\/\/.+(manifest|iiif)/i.test(url);

/** A IIIF language map ({ "ar": ["…"], "none": ["…"] }), a v2 value list, or a plain string → text. */
function text(v: any, lang = 'ar'): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => text(x, lang)).filter(Boolean).join(' ');
  if (v['@value'] !== undefined) return String(v['@value']);
  const pick = v[lang] || v.en || v.none || Object.values(v)[0];
  return Array.isArray(pick) ? pick.join(' ') : String(pick || '');
}

/** An image at a given width: through the IIIF Image API service when there is one, else the file as is. */
function imageOf(serviceId: string | undefined, file: string | undefined): (width: number) => string {
  if (serviceId) {
    const base = serviceId.replace(/\/(info\.json)?$/, '');
    return (w) => `${base}/full/${w},/0/default.jpg`;
  }
  return () => file || '';
}

const firstOf = (v: any) => (Array.isArray(v) ? v[0] : v);
const serviceIdOf = (s: any): string | undefined => {
  const svc = firstOf(s);
  return svc ? (svc['@id'] || svc.id) : undefined;
};

export function parseManifest(json: any): IiifManifest | null {
  if (!json || typeof json !== 'object') return null;
  const type = String(json['@type'] || json.type || '');
  let pages: IiifPage[] = [];
  if (type === 'sc:Manifest') {
    // Presentation 2: sequences[0].canvases[].images[0].resource (+ service)
    const canvases = firstOf(json.sequences)?.canvases || [];
    pages = canvases.map((c: any, i: number) => {
      const res = firstOf(c.images)?.resource || {};
      const image = imageOf(serviceIdOf(res.service), res['@id']);
      return { label: text(c.label) || String(i + 1), image, thumb: image(200) };
    });
  } else if (type === 'Manifest') {
    // Presentation 3: items[] canvases → items[0] page → items[0] annotation → body (+ service)
    pages = (json.items || []).map((c: any, i: number) => {
      const body = firstOf(firstOf(firstOf(c.items)?.items)?.body) || {};
      const image = imageOf(serviceIdOf(body.service), body.id);
      return { label: text(c.label) || String(i + 1), image, thumb: image(200) };
    });
  } else {
    return null;
  }
  pages = pages.filter((p) => p.image(800));
  if (!pages.length) return null;
  return {
    label: text(json.label),
    pages,
    ...(text(json.attribution || json.requiredStatement?.value) ? { attribution: text(json.attribution || json.requiredStatement?.value) } : {}),
    ...(json.rights || json.license ? { rights: String(json.rights || json.license) } : {}),
  };
}

/** The first link that is a IIIF manifest, read; null when none is. Never throws. */
export async function findManifest(urls: string[], fetchImpl: typeof fetch = fetch): Promise<IiifManifest | null> {
  for (const url of [...new Set(urls)].filter(looksLikeManifest).slice(0, 4)) {
    try {
      const res = await fetchImpl(url, { headers: { Accept: 'application/ld+json, application/json' } });
      if (!res.ok) continue;
      const manifest = parseManifest(await res.json());
      if (manifest) return manifest;
    } catch { /* not a manifest, or the server does not allow it: try the next link */ }
  }
  return null;
}

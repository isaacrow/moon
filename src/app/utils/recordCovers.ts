/**
 * Record covers: one picture per record, stored by the server in the public "covers" bucket.
 * Uploads are shrunk in the browser first (at most 600 px on the longer side, JPEG), so a phone photo
 * of a book becomes a cover of a few dozen KB.
 */
import { moonFetch } from './moonApi';

const MAX_SIDE = 600;

/** Scales a picture down to at most 600 px on its longer side and encodes it as a JPEG data URL. */
export function shrinkCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error('Your browser cannot resize images.')); return; }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image Moon can read.')); };
    img.src = url;
  });
}

type CoverResult = { ok: true; coverUrl: string; source?: string } | { ok: false; status: number; error: string };

async function put(recordId: string, body: Record<string, unknown>): Promise<CoverResult> {
  try {
    const { ok, status, data } = await moonFetch(`/records/${encodeURIComponent(recordId)}/cover`, { method: 'PUT', body });
    return ok ? { ok: true, coverUrl: data.coverUrl, source: data.source } : { ok: false, status, error: data?.error || `HTTP ${status}` };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function uploadCover(recordId: string, file: File): Promise<CoverResult> {
  let image: string;
  try {
    image = await shrinkCover(file);
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
  return put(recordId, { image });
}

/** Takes the cover from Open Library or Google Books by ISBN. */
export function coverFromIsbn(recordId: string, isbn: string): Promise<CoverResult> {
  return put(recordId, { isbn });
}

export async function deleteCover(recordId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { ok, status, data } = await moonFetch(`/records/${encodeURIComponent(recordId)}/cover`, { method: 'DELETE' });
    return ok ? { ok: true } : { ok: false, error: data?.error || `HTTP ${status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The first ISBN in an Instance (bf:identifiedBy → bf:Isbn), as digits; undefined when there is none. */
export function findIsbn(instance: any): string | undefined {
  const seen = new Set<any>();
  const walk = (v: any): string | undefined => {
    if (!v || typeof v !== 'object' || seen.has(v)) return undefined;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) { const r = walk(x); if (r) return r; } return undefined; }
    const type = [].concat(v['@type'] ?? []).join(' ');
    if (/Isbn/i.test(type)) {
      const raw = v['rdf:value'] ?? v.value ?? v['bf:value'];
      const value = typeof raw === 'object' ? raw?.['@value'] : raw;
      const d = String(value ?? '').toUpperCase().replace(/[^0-9X]/g, '');
      if (/^(\d{9}[\dX]|\d{13})$/.test(d)) return d;
    }
    for (const x of Object.values(v)) { const r = walk(x); if (r) return r; }
    return undefined;
  };
  return walk(instance);
}

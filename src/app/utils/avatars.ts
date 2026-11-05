/**
 * Profile pictures: fetched once per user and shared by every place that shows one
 * (top bar, editing warning, ...). Uploads are shrunk in the browser to a 128×128 JPEG first.
 */
import { moonFetch } from './moonApi';

const cache = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

/** Re-renders every avatar after a photo changes. */
export function onAvatarsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getAvatar(username: string): Promise<string | null> {
  const key = username.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  let pending = cache.get(key);
  if (!pending) {
    pending = moonFetch<{ image: string | null }>(`/api/accounts/avatar/${encodeURIComponent(key)}`)
      .then(({ ok, data }) => (ok ? data?.image || null : null))
      .catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

/** Crops the picture to a centred square and shrinks it to 128×128. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Your browser cannot resize images.')); return; }
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 128, 128);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image Moon can read.')); };
    img.src = url;
  });
}

async function changed(username: string, image: string | null) {
  cache.set(username.trim().toLowerCase(), Promise.resolve(image));
  listeners.forEach((l) => l());
}

export async function uploadAvatar(username: string, file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPEG, PNG or WebP).');
  const image = await shrink(file);
  const { ok, data } = await moonFetch('/api/accounts/me/avatar', { method: 'PUT', body: { image } });
  if (!ok) throw new Error((data as any)?.message || 'The photo could not be saved.');
  await changed(username, image);
}

export async function removeAvatar(username: string): Promise<void> {
  const { ok, data } = await moonFetch('/api/accounts/me/avatar', { method: 'DELETE' });
  if (!ok) throw new Error((data as any)?.message || 'The photo could not be removed.');
  await changed(username, null);
}

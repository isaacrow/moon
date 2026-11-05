// Who is online, for the Super Admin's account list. The signed-in app sends a heartbeat about
// once a minute while its tab is visible; the server marks someone online when it heard from
// them within the last 2 minutes and keeps the time it last did as `lastSeenAt`.

export const HEARTBEAT_MS = 60_000;

export interface Presence {
  username: string;
  lastSeenAt?: string | null;
  online?: boolean;
}

const seenTime = (u: Presence) => {
  const t = u.lastSeenAt ? Date.parse(u.lastSeenAt) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
};

/** Online users first, then by most recently seen; those never seen keep their order at the end. */
export function sortByPresence<T extends Presence>(users: T[]): T[] {
  return users
    .map((u, i) => ({ u, i }))
    .sort((a, b) =>
      Number(!!b.u.online) - Number(!!a.u.online) ||
      (seenTime(b.u) === seenTime(a.u) ? 0 : seenTime(b.u) > seenTime(a.u) ? 1 : -1) ||
      a.i - b.i)
    .map(({ u }) => u);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Last seen 5 minutes ago", "Last seen yesterday 14:20", … or the Arabic equivalent. */
export function formatLastSeen(iso: string | null | undefined, ar: boolean, now: number = Date.now()): string {
  const prefix = ar ? 'آخر ظهور: ' : 'Last seen ';
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return ar ? 'لم يظهر بعد' : 'Never seen';

  const locale = ar ? 'ar' : 'en';
  const diff = Math.max(0, now - t);
  const minutes = Math.floor(diff / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 1) return prefix + (ar ? 'قبل لحظات' : 'just now');
  if (minutes < 60) return prefix + rtf.format(-minutes, 'minute');

  const seen = new Date(t);
  const today = new Date(now);
  const time = seen.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const days = Math.round((startOfDay(today) - startOfDay(seen)) / 86_400_000);
  if (days === 0) return prefix + rtf.format(-Math.floor(minutes / 60), 'hour');
  if (days === 1) return prefix + (ar ? `أمس ${time}` : `yesterday ${time}`);
  const date = seen.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(seen.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
  return prefix + `${date} ${time}`;
}

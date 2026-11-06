/**
 * After a deploy, a tab opened earlier still asks for the previous build's files (AuthorFinder-<oldhash>.js),
 * which are gone, so a lazy page fails with "Failed to fetch dynamically imported module". The fix is the
 * new build: reload once. A short guard stops a reload loop if the file really is missing.
 */
const KEY = 'moon:stale-chunk-reload';

export function isStaleChunkError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg);
}

/** Reloads the page unless it already did so in the last 30 seconds. Returns whether it reloads. */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // no storage: no loop guard, so never reload automatically
  }
  window.location.reload();
  return true;
}

/** Vite fires vite:preloadError when a lazy chunk cannot be loaded. */
export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault();
  });
}

// Tells the server this user is here: a heartbeat about once a minute while the tab is visible,
// none while it is hidden. The Super Admin's account list shows it as "online now" / "last seen".
import { useEffect } from 'react';
import { moonFetch } from './moonApi';
import { HEARTBEAT_MS } from './presence';

export function usePresenceHeartbeat(username: string | null | undefined): void {
  useEffect(() => {
    if (!username || typeof document === 'undefined') return;
    let timer: number | undefined;
    const beat = () => {
      moonFetch('/api/accounts/me/heartbeat', { method: 'POST', body: {} }).catch(() => {});
    };
    const start = () => {
      if (timer !== undefined) return;
      beat();
      timer = window.setInterval(beat, HEARTBEAT_MS);
    };
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [username]);
}

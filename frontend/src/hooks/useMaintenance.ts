import { useEffect } from 'react';

const POLL_INTERVAL = 30_000;
const MAINTENANCE_PATH = '/maintenance.html';

export function useMaintenance() {
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/maintenance.json', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        const onMaintenancePage = window.location.pathname === MAINTENANCE_PATH;
        if (res.ok && !onMaintenancePage) {
          window.location.replace(MAINTENANCE_PATH);
        } else if (res.status === 404 && onMaintenancePage) {
          window.location.replace('/');
        }
      } catch {
        // Network error — don't redirect
      }
    }

    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);
}

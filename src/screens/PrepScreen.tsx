/**
 * DemoGuard — PrepScreen (device + permissions collection)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect } from 'react';
import { collectDeviceContext } from '../demoguard/collectors/deviceCollector';
import { collectPermissions } from '../demoguard/collectors/permissionCollector';
import { PhaseHeader } from '../components/PhaseHeader';

interface Props {
  onDeviceCollected: (device: ReturnType<typeof collectDeviceContext>) => void;
  onPermissionsCollected: (perms: Awaited<ReturnType<typeof collectPermissions>>) => void;
  onReady: () => void;
  onError: (reason: string) => void;
}

export function PrepScreen({ onDeviceCollected, onPermissionsCollected, onReady, onError }: Props) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const device = collectDeviceContext();
        if (cancelled) return;
        onDeviceCollected(device);

        const perms = await collectPermissions();
        if (cancelled) return;
        onPermissionsCollected(perms);

        onReady();
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Prep failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="screen">
      <PhaseHeader title="Préparation" progress="0/7" progressPct={0} />
      <div className="screen-center">
        <div style={{ fontSize: 32 }}>⚙️</div>
        <p className="muted">Collecte des informations appareil…</p>
      </div>
    </div>
  );
}

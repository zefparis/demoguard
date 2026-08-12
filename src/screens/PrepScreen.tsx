/**
 * DemoGuard — PrepScreen (device + permissions + continuous signals start)
 *
 * Two-phase flow:
 *   1. useEffect auto-collects device context + permission status (no user
 *      gesture needed — these are read-only queries).
 *   2. A "Continue" button is shown. Its onClick handler calls
 *      onUserContinue(perms) which triggers requestSensorPermissions()
 *      (iOS 13+ requires requestPermission() from a user gesture) then
 *      start() then onReady().
 *
 * On Android/desktop where requestPermission() does not exist, the button
 * still works — requestSensorPermissions() returns immediately and start()
 * registers listeners with permission='granted'.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState } from 'react';
import { collectDeviceContext } from '../demoguard/collectors/deviceCollector';
import { collectPermissions } from '../demoguard/collectors/permissionCollector';
import { PhaseHeader } from '../components/PhaseHeader';
import { useI18n } from '../i18n/I18nContext';
import type { DemoGuardPermissions } from '../demoguard/types';

interface Props {
  onDeviceCollected: (device: ReturnType<typeof collectDeviceContext>) => void;
  onPermissionsCollected: (perms: DemoGuardPermissions) => void;
  /**
   * Called synchronously from the Continue button onClick handler.
   * MUST trigger requestSensorPermissions() + start() within the same
   * user-activation window. Resolves when continuous signals are started.
   */
  onUserContinue: (perms: DemoGuardPermissions) => Promise<void>;
  onReady: () => void;
  onError: (reason: string) => void;
}

export function PrepScreen({ onDeviceCollected, onPermissionsCollected, onUserContinue, onReady, onError }: Props) {
  const { t } = useI18n();
  const [perms, setPerms] = useState<DemoGuardPermissions | null>(null);
  const [starting, setStarting] = useState(false);

  // Phase 1: auto-collect device + permission status (read-only, no gesture needed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const device = collectDeviceContext();
        if (cancelled) return;
        onDeviceCollected(device);

        const collected = await collectPermissions();
        if (cancelled) return;
        onPermissionsCollected(collected);
        setPerms(collected);
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Prep failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Phase 2: user clicks Continue → requestSensorPermissions() + start() + onReady()
  const handleContinue = async () => {
    if (!perms || starting) return;
    setStarting(true);
    try {
      await onUserContinue(perms);
      onReady();
    } catch (err) {
      setStarting(false);
      onError(err instanceof Error ? err.message : 'Sensor start failed');
    }
  };

  return (
    <div className="screen">
      <PhaseHeader title={t('prep.title')} progress={t('prep.progress')} progressPct={0} />
      <div className="screen-center">
        {perms ? (
          <>
            <div style={{ fontSize: 32 }}>⚙️</div>
            <p className="muted">{t('prep.ready')}</p>
            <button
              className="prep-continue-btn"
              onClick={handleContinue}
              disabled={starting}
            >
              {starting ? '…' : t('prep.continue')}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32 }}>⚙️</div>
            <p className="muted">{t('prep.collecting')}</p>
          </>
        )}
      </div>
    </div>
  );
}

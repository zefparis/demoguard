/**
 * DemoGuard — PrepScreen (device + permissions + continuous signals start)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect } from 'react';
import { collectDeviceContext } from '../demoguard/collectors/deviceCollector';
import { collectPermissions } from '../demoguard/collectors/permissionCollector';
import { PhaseHeader } from '../components/PhaseHeader';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onDeviceCollected: (device: ReturnType<typeof collectDeviceContext>) => void;
  onPermissionsCollected: (perms: Awaited<ReturnType<typeof collectPermissions>>) => void;
  onContinuousSignalsStart: (perms: Awaited<ReturnType<typeof collectPermissions>>) => Promise<void>;
  onReady: () => void;
  onError: (reason: string) => void;
}

export function PrepScreen({ onDeviceCollected, onPermissionsCollected, onContinuousSignalsStart, onReady, onError }: Props) {
  const { t } = useI18n();
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

        await onContinuousSignalsStart(perms);
        if (cancelled) return;

        onReady();
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Prep failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="screen">
      <PhaseHeader title={t('prep.title')} progress={t('prep.progress')} progressPct={0} />
      <div className="screen-center">
        <div style={{ fontSize: 32 }}>⚙️</div>
        <p className="muted">{t('prep.collecting')}</p>
      </div>
    </div>
  );
}

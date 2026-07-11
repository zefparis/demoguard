/**
 * DemoGuard — DeviceSignalsScreen (motion, orientation, touch, visibility, network)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState } from 'react';
import { collectMotion, isMotionSupported, requestMotionPermission } from '../demoguard/collectors/motionCollector';
import { collectOrientation, isOrientationSupported, requestOrientationPermission } from '../demoguard/collectors/orientationCollector';
import { collectTouch } from '../demoguard/collectors/touchCollector';
import { collectVisibility } from '../demoguard/collectors/visibilityCollector';
import { collectNetwork } from '../demoguard/collectors/networkCollector';
import type { DemoGuardSignals } from '../demoguard/types';
import { PhaseHeader } from '../components/PhaseHeader';

interface Props {
  onCollected: (signals: Partial<DemoGuardSignals>) => void;
  onContinue: () => void;
  onError: (reason: string) => void;
}

export function DeviceSignalsScreen({ onCollected, onContinue, onError }: Props) {
  const [status, setStatus] = useState('Collecte des signaux appareil…');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const signals: Partial<DemoGuardSignals> = {};

        if (isMotionSupported()) {
          await requestMotionPermission().catch(() => {});
          const motion = await collectMotion(3000).catch(() => null);
          if (motion && !cancelled) signals.motion = motion;
        }

        if (isOrientationSupported()) {
          await requestOrientationPermission().catch(() => {});
          const orientation = await collectOrientation(3000).catch(() => null);
          if (orientation && !cancelled) signals.orientation = orientation;
        }

        const touch = await collectTouch(2000).catch(() => null);
        if (touch && !cancelled) signals.touch = touch;

        const visibility = await collectVisibility(2000).catch(() => null);
        if (visibility && !cancelled) signals.visibility = visibility;

        const network = collectNetwork();
        if (network && !cancelled) signals.network = network;

        if (cancelled) return;
        onCollected(signals);
        setStatus('Signaux collectés ✓');
        setDone(true);
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Device signals failed');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="screen">
      <PhaseHeader title="Signaux appareil" progress="Collecte…" progressPct={93} />
      <div className="screen-center">
        <div style={{ fontSize: 32 }}>📡</div>
        <p className="muted">{status}</p>
        {done && (
          <button className="btn" onClick={onContinue}>
            Continuer
          </button>
        )}
      </div>
    </div>
  );
}

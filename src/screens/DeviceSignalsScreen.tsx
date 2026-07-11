/**
 * DemoGuard — DeviceSignalsScreen (transition + summary)
 *
 * In continuous signals mode, this screen no longer collects signals.
 * It displays a brief summary of what was collected during the session
 * and lets the user continue to readiness.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { PhaseHeader } from '../components/PhaseHeader';
import type { DemoGuardSignals } from '../demoguard/types';

interface Props {
  signals: Partial<DemoGuardSignals>;
  onContinue: () => void;
}

export function DeviceSignalsScreen({ signals, onContinue }: Props) {
  const summary: string[] = [];
  if (signals.motion) summary.push(`Motion: ${signals.motion.sample_count} échantillons`);
  if (signals.orientation) summary.push(`Orientation: ${signals.orientation.changes} changements`);
  if (signals.touch) summary.push(`Touch: ${signals.touch.touch_count} interactions`);
  if (signals.visibility) summary.push(`Visibility: ${signals.visibility.blur_count} blur`);
  if (signals.network) summary.push(`Network: ${signals.network.online ? 'online' : 'offline'}`);

  return (
    <div className="screen">
      <PhaseHeader title="Signaux appareil" progress="Collecte continue ✓" progressPct={93} />
      <div className="screen-center">
        <div style={{ fontSize: 32 }}>📡</div>
        <p className="muted">Signaux collectés en continu pendant la session</p>
        {summary.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0', fontSize: 14, color: '#888' }}>
            {summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
        <button className="btn" onClick={onContinue}>
          Continuer
        </button>
      </div>
    </div>
  );
}

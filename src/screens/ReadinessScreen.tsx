/**
 * DemoGuard — ReadinessScreen (quality check + submit button)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useMemo } from 'react';
import { PhaseHeader } from '../components/PhaseHeader';
import type { DemoGuardState } from '../state/demoguardReducer';
import { computeQuality } from '../demoguard/quality/signalCompleteness';

interface Props {
  state: DemoGuardState;
  onSubmit: () => void;
  onError: (reason: string) => void;
}

export function ReadinessScreen({ state, onSubmit }: Props) {
  const quality = useMemo(() => {
    if (!state.device || !state.permissions) return null;
    return computeQuality(state.signals, state.device, state.permissions);
  }, [state.signals, state.device, state.permissions]);

  const canSubmit = quality?.overall_ready ?? false;

  return (
    <div className="screen">
      <PhaseHeader title="Prêt ?" progress="Vérification finale" progressPct={97} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {quality && (
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Qualité des signaux</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Complétude</span>
              <span className="muted">{Math.round(quality.signal_completeness * 100)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Appareil</span>
              <span className="muted">{quality.device_ready ? '✅' : '❌'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Permissions</span>
              <span className="muted">{quality.permissions_ready ? '✅' : '❌'}</span>
            </div>
            {quality.critical_missing.length > 0 && (
              <p style={{ color: 'var(--danger)', marginTop: 8 }}>
                Critiques manquants: {quality.critical_missing.join(', ')}
              </p>
            )}
          </div>
        )}
        <button className="btn" onClick={onSubmit} disabled={!canSubmit}>
          {canSubmit ? 'Soumettre' : 'Signaux insuffisants'}
        </button>
        {!canSubmit && (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
            Certains signaux critiques sont manquants. Vous pouvez soumettre quand même si le backend l'accepte.
          </p>
        )}
        <button className="btn btn-secondary" onClick={onSubmit}>
          Forcer la soumission
        </button>
      </div>
    </div>
  );
}

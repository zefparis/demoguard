/**
 * DemoGuard — ReviewScreen (signal review + behavior collection)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { PhaseHeader } from '../components/PhaseHeader';
import type { DemoGuardState } from '../state/demoguardReducer';
import type { BehaviorPayload } from '../demoguard/behavior/behaviorTypes';

interface Props {
  state: DemoGuardState;
  behaviorPayload: BehaviorPayload | null;
  onContinue: () => void;
  onError: (reason: string) => void;
}

export function ReviewScreen({ state, behaviorPayload, onContinue }: Props) {
  const cognitive = state.cognitiveSignals;
  const cogModules = cognitive
    ? [
        { name: 'Réflexe', signal: cognitive.reflex },
        { name: 'Stroop', signal: cognitive.stroop },
        { name: 'Digit Span', signal: cognitive.digit_span },
        { name: 'N-Back', signal: cognitive.n_back },
        { name: 'Trail Tap', signal: cognitive.trail_tap },
        { name: 'Vocal RAN', signal: cognitive.vocal_ran },
      ]
    : [];

  return (
    <div className="screen">
      <PhaseHeader title="Revue" progress="Signaux collectés" progressPct={90} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Selfie</h3>
          <p className="muted">{state.signals.selfie?.captured ? '✅ Capturé' : '❌ Manquant'}</p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Tests cognitifs</h3>
          {cogModules.map((m) => (
            <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{m.name}</span>
              <span className="muted">{m.signal ? '✅' : '—'}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Voix</h3>
          <p className="muted">{state.signals.voice?.recorded ? '✅ Enregistrée' : '❌ Manquante'}</p>
        </div>
        {behaviorPayload && (
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Comportement</h3>
            <p className="muted">Interactions: {behaviorPayload.summary.totalInteractions}</p>
            <p className="muted">Tâches observées: {behaviorPayload.summary.tasksObserved}</p>
            <p className="muted">Qualité: {behaviorPayload.summary.quality}</p>
          </div>
        )}
        <button className="btn" onClick={onContinue} style={{ marginTop: 8 }}>
          Continuer
        </button>
      </div>
    </div>
  );
}

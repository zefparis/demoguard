/**
 * DemoGuard — DoneScreen (result display)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardSafeResponse } from '../demoguard/types';

interface Props {
  response: DemoGuardSafeResponse | null;
  onReset: () => void;
}

export function DoneScreen({ response, onReset }: Props) {
  const ok = response?.ok ?? false;
  const fusion = response?.hybridFusion;
  const decision = fusion?.globalDecision;
  const decisionLabel = decision === 'APPROVED' ? 'Accepté'
    : decision === 'REVIEW' ? 'À réviser'
    : decision === 'REJECTED' ? 'Rejeté'
    : null;

  return (
    <div className="screen-center">
      <div className="result-icon">{ok ? '✅' : '⚠️'}</div>
      <h2>{ok ? 'Contrôle terminé' : 'Résultat incertain'}</h2>
      {response && (
        <div className="card" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>Statut</span>
            <span className="muted">{response.status}</span>
          </div>
          {response.quality_score !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Score qualité</span>
              <span className="muted">{response.quality_score}</span>
            </div>
          )}
          {decisionLabel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Décision</span>
              <span className="muted">{decisionLabel}</span>
            </div>
          )}
          {fusion?.trustLevel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Niveau de confiance</span>
              <span className="muted">{fusion.trustLevel}</span>
            </div>
          )}
          {fusion?.cognitiveStatus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Cognition</span>
              <span className="muted">{fusion.cognitiveStatus}</span>
            </div>
          )}
          {fusion?.vocalStatus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Voix</span>
              <span className="muted">{fusion.vocalStatus}</span>
            </div>
          )}
          {fusion?.behaviorStatus && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Comportement</span>
              <span className="muted">{fusion.behaviorStatus}</span>
            </div>
          )}
          {response.traceId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Trace</span>
              <span className="muted" style={{ fontSize: 12 }}>{response.traceId}</span>
            </div>
          )}
          {response.message && (
            <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{response.message}</p>
          )}
        </div>
      )}
      <button className="btn" onClick={onReset}>
        Nouveau contrôle
      </button>
    </div>
  );
}

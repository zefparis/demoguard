/**
 * DemoGuard — DoneScreen (result display)
 *
 * Shows a viral "brain age" score computed client-side from cognitive
 * metrics, with technical details available in a collapsible section.
 *
 * INVARIANTS:
 *   - Brain age is purely cosmetic (computed client-side, never sent to backend).
 *   - Technical details (status, decision, trust level) remain available
 *     for admin/debug via a collapsible <details> element.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState } from 'react';
import type { DemoGuardSafeResponse } from '../demoguard/types';
import type { CognitiveSignals } from '../demoguard/cognitive/cognitiveTypes';
import { computeBrainAge } from '../demoguard/cognitive/brainAge';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  response: DemoGuardSafeResponse | null;
  cognitiveSignals: CognitiveSignals | null;
  testScope: string | null;
  onReset: () => void;
}

export function DoneScreen({ response, cognitiveSignals, testScope: _testScope, onReset }: Props) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const ok = response?.ok ?? false;
  const fusion = response?.hybridFusion;
  const decision = fusion?.globalDecision;
  const decisionLabel = decision === 'APPROVED' ? t('done.decision.approved')
    : decision === 'REVIEW' ? t('done.decision.review')
    : decision === 'REJECTED' ? t('done.decision.rejected')
    : null;

  // ── Brain age (cosmetic, client-only) ────────────────────────────
  const brainAge = computeBrainAge(cognitiveSignals);

  const ageEmoji = brainAge
    ? brainAge.age <= 25 ? '⚡'
    : brainAge.age <= 35 ? '🧠'
    : brainAge.age <= 45 ? '💪'
    : '🧓'
    : '🧠';

  const ageColor = brainAge
    ? brainAge.age <= 25 ? '#10b981'
    : brainAge.age <= 35 ? '#3b82f6'
    : brainAge.age <= 45 ? '#f59e0b'
    : '#ef4444'
    : '#3b82f6';

  return (
    <div className="screen-center">
      {/* ── Brain Age — viral display ─────────────────────────────── */}
      {brainAge ? (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>{ageEmoji}</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            {t('done.brainAge.title')}
          </h2>
          <div style={{
            fontSize: 56,
            fontWeight: 900,
            color: ageColor,
            lineHeight: 1.1,
            marginBottom: 8,
          }}>
            {brainAge.age}
          </div>
          <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 4 }}>
            {t(`done.brainAge.${brainAge.label}`)}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', opacity: 0.7, marginTop: 8 }}>
            {t('done.brainAge.disclaimer')}
          </p>
        </div>
      ) : (
        <div className="result-icon">{ok ? '✅' : '⚠️'}</div>
      )}

      {!brainAge && (
        <h2>{ok ? t('done.complete') : t('done.uncertain')}</h2>
      )}

      {/* ── Technical details (collapsible) ───────────────────────── */}
      {response && (
        <div style={{ width: '100%' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 13,
              cursor: 'pointer',
              padding: '8px 0',
              textAlign: 'center',
            }}
          >
            {showDetails ? '▼' : '▶'} {t('done.technicalDetails')}
          </button>
          {showDetails && (
            <div className="card" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{t('done.status')}</span>
                <span className="muted">{response.status}</span>
              </div>
              {response.quality_score !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.qualityScore')}</span>
                  <span className="muted">{response.quality_score}</span>
                </div>
              )}
              {decisionLabel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.decision')}</span>
                  <span className="muted">{decisionLabel}</span>
                </div>
              )}
              {fusion?.trustLevel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.trustLevel')}</span>
                  <span className="muted">{fusion.trustLevel}</span>
                </div>
              )}
              {fusion?.cognitiveStatus && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.cognition')}</span>
                  <span className="muted">{fusion.cognitiveStatus}</span>
                </div>
              )}
              {fusion?.vocalStatus && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.voice')}</span>
                  <span className="muted">{fusion.vocalStatus}</span>
                </div>
              )}
              {fusion?.behaviorStatus && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.behavior')}</span>
                  <span className="muted">{fusion.behaviorStatus}</span>
                </div>
              )}
              {response.traceId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.trace')}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{response.traceId}</span>
                </div>
              )}
              {response.message && (
                <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{response.message}</p>
              )}
              {/* Brain age breakdown for debug */}
              {brainAge && (
                <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Brain Age Breakdown:</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Reflex: {brainAge.breakdown.reflexDelta >= 0 ? '+' : ''}{brainAge.breakdown.reflexDelta}y ·
                    Stroop: {brainAge.breakdown.stroopDelta >= 0 ? '+' : ''}{brainAge.breakdown.stroopDelta}y ·
                    Memory: {brainAge.breakdown.memoryDelta >= 0 ? '+' : ''}{brainAge.breakdown.memoryDelta}y
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <button className="btn" onClick={onReset} style={{ marginTop: 16 }}>
        {t('done.newControl')}
      </button>
    </div>
  );
}

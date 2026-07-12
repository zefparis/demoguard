/**
 * DemoGuard — DoneScreen (result display)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardSafeResponse } from '../demoguard/types';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  response: DemoGuardSafeResponse | null;
  onReset: () => void;
}

export function DoneScreen({ response, onReset }: Props) {
  const { t } = useI18n();
  const ok = response?.ok ?? false;
  const fusion = response?.hybridFusion;
  const decision = fusion?.globalDecision;
  const decisionLabel = decision === 'APPROVED' ? t('done.decision.approved')
    : decision === 'REVIEW' ? t('done.decision.review')
    : decision === 'REJECTED' ? t('done.decision.rejected')
    : null;

  return (
    <div className="screen-center">
      <div className="result-icon">{ok ? '✅' : '⚠️'}</div>
      <h2>{ok ? t('done.complete') : t('done.uncertain')}</h2>
      {response && (
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
        </div>
      )}
      <button className="btn" onClick={onReset}>
        {t('done.newControl')}
      </button>
    </div>
  );
}

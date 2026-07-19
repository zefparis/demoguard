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
import { useI18n } from '../i18n/I18nContext';

interface Props {
  state: DemoGuardState;
  onSubmit: () => void;
  onError: (reason: string) => void;
}

export function ReadinessScreen({ state, onSubmit }: Props) {
  const { t } = useI18n();
  const quality = useMemo(() => {
    if (!state.device || !state.permissions) return null;
    return computeQuality(state.signals, state.device, state.permissions, state.testScope);
  }, [state.signals, state.device, state.permissions, state.testScope]);

  const canSubmit = quality?.overall_ready ?? false;

  return (
    <div className="screen">
      <PhaseHeader title={t('readiness.title')} progress={t('readiness.progress')} progressPct={97} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {quality && (
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>{t('readiness.quality')}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{t('readiness.completeness')}</span>
              <span className="muted">{Math.round(quality.signal_completeness * 100)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{t('readiness.device')}</span>
              <span className="muted">{quality.device_ready ? '✅' : '❌'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>{t('readiness.permissions')}</span>
              <span className="muted">{quality.permissions_ready ? '✅' : '❌'}</span>
            </div>
            {quality.critical_missing.length > 0 && (
              <p style={{ color: 'var(--danger)', marginTop: 8 }}>
                {t('readiness.criticalMissing')}: {quality.critical_missing.join(', ')}
              </p>
            )}
          </div>
        )}
        <button className="btn" onClick={onSubmit} disabled={!canSubmit}>
          {canSubmit ? t('readiness.submit') : t('readiness.insufficient')}
        </button>
        {!canSubmit && (
          <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>
            {t('readiness.insufficientHint')}
          </p>
        )}
        <button className="btn btn-secondary" onClick={onSubmit}>
          {t('readiness.forceSubmit')}
        </button>
      </div>
    </div>
  );
}

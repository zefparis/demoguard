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
import { useI18n } from '../i18n/I18nContext';

interface Props {
  signals: Partial<DemoGuardSignals>;
  onContinue: () => void;
}

export function DeviceSignalsScreen({ signals, onContinue }: Props) {
  const { t } = useI18n();
  const summary: string[] = [];
  if (signals.motion) summary.push(`${t('deviceSignals.motion')}: ${signals.motion.sample_count} ${t('deviceSignals.samples')}`);
  if (signals.orientation) summary.push(`${t('deviceSignals.orientation')}: ${signals.orientation.changes} ${t('deviceSignals.changes')}`);
  if (signals.touch) summary.push(`${t('deviceSignals.touch')}: ${signals.touch.touch_count} ${t('deviceSignals.interactions')}`);
  if (signals.visibility) summary.push(`${t('deviceSignals.visibility')}: ${signals.visibility.blur_count} ${t('deviceSignals.blur')}`);
  if (signals.network) summary.push(`${t('deviceSignals.network')}: ${signals.network.online ? t('deviceSignals.online') : t('deviceSignals.offline')}`);

  return (
    <div className="screen">
      <PhaseHeader title={t('deviceSignals.title')} progress={t('deviceSignals.progress')} progressPct={93} />
      <div className="screen-center">
        <div style={{ fontSize: 32 }}>📡</div>
        <p className="muted">{t('deviceSignals.continuous')}</p>
        {summary.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0', fontSize: 14, color: '#888' }}>
            {summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
        <button className="btn" onClick={onContinue}>
          {t('review.continue')}
        </button>
      </div>
    </div>
  );
}

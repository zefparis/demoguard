/**
 * DemoGuard — ErrorScreen
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useI18n } from '../i18n/I18nContext';

interface Props {
  error: string;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorScreen({ error, onRetry, onReset }: Props) {
  const { t } = useI18n();
  return (
    <div className="screen-center">
      <div className="result-icon">❌</div>
      <h3>{t('error.title')}</h3>
      <p className="muted">{error}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onRetry}>{t('error.retry')}</button>
        <button className="btn" onClick={onReset}>{t('error.reset')}</button>
      </div>
    </div>
  );
}

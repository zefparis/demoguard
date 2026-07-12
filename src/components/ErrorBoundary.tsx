/**
 * DemoGuard — ErrorBoundary
 *
 * Catches crashes per test screen. Shows retry button, never a blank card.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { Component, useContext } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { I18nContext } from '../i18n/I18nContext';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
}

function ErrorBoundaryFallback({ onRetry }: { onRetry?: () => void }) {
  const ctx = useContext(I18nContext);
  const t = ctx?.t ?? ((k: string) => k);
  return (
    <div className="error-boundary">
      <h3>{t('error.boundary.title')}</h3>
      <p className="muted">{t('error.boundary.message')}</p>
      <button className="btn" onClick={onRetry}>
        {t('error.boundary.retry')}
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[dg2_error]', { message: error.message, componentStack: info.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    if (this.props.onRetry) this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

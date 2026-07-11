/**
 * DemoGuard — ErrorBoundary
 *
 * Catches crashes per test screen. Shows retry button, never a blank card.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
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
      return (
        <div className="error-boundary">
          <h3>Erreur</h3>
          <p className="muted">Une erreur est survenue pendant ce test.</p>
          <button className="btn" onClick={this.handleRetry}>
            Réessayer ce test
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

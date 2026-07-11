/**
 * DemoGuard — ErrorScreen
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

interface Props {
  error: string;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorScreen({ error, onRetry, onReset }: Props) {
  return (
    <div className="screen-center">
      <div className="result-icon">❌</div>
      <h3>Erreur</h3>
      <p className="muted">{error}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onRetry}>Réessayer</button>
        <button className="btn" onClick={onReset}>Recommencer</button>
      </div>
    </div>
  );
}

/**
 * DemoGuard — SubmittingScreen (loading)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

export function SubmittingScreen() {
  return (
    <div className="screen-center">
      <div style={{ fontSize: 32 }}>📤</div>
      <p>Soumission en cours…</p>
      <div className="progress-bar" style={{ width: '100%' }}>
        <div className="progress-bar-fill" style={{ width: '50%', animation: 'pulse 1s ease-in-out infinite' }} />
      </div>
    </div>
  );
}

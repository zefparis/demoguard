/**
 * DemoGuard — PhaseHeader (compact, constant height)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

interface Props {
  title: string;
  progress: string;
  progressPct?: number;
  /** Optional segmented progress bar (e.g. 6 Stroop trials).
   *  When provided, renders segments instead of the continuous bar.
   *  `current` is 0-indexed; segments 0..current-1 are "done",
   *  segment `current` is "current", the rest are "pending". */
  segments?: { current: number; total: number };
}

export function PhaseHeader({ title, progress, progressPct, segments }: Props) {
  return (
    <div>
      <div className="phase-header">
        <h2>{title}</h2>
        <span className="phase-progress">{progress}</span>
      </div>
      {segments ? (
        <div className="segment-progress">
          <div className="segment-progress-bar">
            {Array.from({ length: segments.total }, (_, i) => (
              <div
                key={i}
                className={`segment-progress-seg ${
                  i < segments.current ? 'done' : i === segments.current ? 'current' : ''
                }`}
              />
            ))}
          </div>
          <span className="segment-progress-count">
            {Math.min(segments.current + 1, segments.total)}/{segments.total}
          </span>
        </div>
      ) : progressPct !== undefined ? (
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

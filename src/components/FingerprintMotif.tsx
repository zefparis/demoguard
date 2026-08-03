/**
 * DemoGuard — FingerprintMotif (shared SVG component)
 *
 * Reproduces the fingerprint motif from public/favicon.svg:
 * 5 open arcs with a central vertical ridge, cyan→violet gradient,
 * decreasing opacity outward. Used on IdleScreen and DoneScreen
 * for visual continuity with the favicon and OG image.
 *
 * The paths are adapted from favicon.svg (viewBox 0 0 64 64) to
 * a 0 0 64 64 viewBox here — identical coordinates, just rendered
 * at whatever size the consumer specifies via the `size` prop.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

interface Props {
  size?: number;
  className?: string;
}

export function FingerprintMotif({ size = 120, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="fp-grad-shared" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4CF2E0" />
          <stop offset="100%" stopColor="#8A7CFF" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#fp-grad-shared)" strokeLinecap="round">
        {/* Central vertical ridge */}
        <path d="M32 50 L32 33" strokeWidth="4.5" />
        {/* Inner left arc (highest opacity) */}
        <path d="M21 49 C18 38 19 29 24 24 C29 19 38 20 41 26" strokeWidth="4" opacity="0.9" />
        {/* Inner right arc */}
        <path d="M43 49 C45 40 45 33 43 28" strokeWidth="4" opacity="0.75" />
        {/* Outer left arc */}
        <path d="M11 45 C8 30 12 19 21 13 C31 7 44 11 49 21" strokeWidth="3.6" opacity="0.55" />
        {/* Outer right arc (lowest opacity) */}
        <path d="M53 45 C56 34 55 25 51 18" strokeWidth="3.6" opacity="0.45" />
      </g>
    </svg>
  );
}

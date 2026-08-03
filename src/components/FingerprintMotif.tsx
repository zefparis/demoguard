/**
 * DemoGuard — FingerprintMotif (shared SVG component)
 *
 * Fingerprint motif with open arcs resembling a real fingerprint:
 * central vertical ridge, paired arcs opening downward, wider than tall,
 * spaced apart with reduced curvature. Cyan→violet gradient, decreasing
 * opacity outward. Used on IdleScreen (120px) and DoneScreen (52px).
 *
 * viewBox 0 0 96 64 — wider than tall to give horizontal breathing room.
 * Stroke widths scaled for clarity at both 52px and 120px render sizes.
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
      viewBox="0 0 96 64"
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
        {/* Central vertical ridge — the core of the fingerprint */}
        <path d="M48 52 L48 30" strokeWidth="2.5" />

        {/* Inner-left arc: opens downward, gentle curve, wider than tall */}
        <path d="M36 50 C33 42 34 35 38 31 C42 28 48 29 52 33" strokeWidth="2.2" opacity="0.9" />

        {/* Inner-right arc: mirror of inner-left */}
        <path d="M60 50 C63 42 62 35 58 31 C54 28 48 29 44 33" strokeWidth="2.2" opacity="0.75" />

        {/* Mid-left arc: wider, lower opacity */}
        <path d="M26 48 C22 38 24 28 30 22 C36 17 48 19 56 25" strokeWidth="2" opacity="0.55" />

        {/* Mid-right arc: mirror */}
        <path d="M70 48 C74 38 72 28 66 22 C60 17 48 19 40 25" strokeWidth="2" opacity="0.45" />

        {/* Outer-left arc: widest, faintest */}
        <path d="M16 45 C11 33 14 21 22 14 C32 7 48 10 60 18" strokeWidth="1.8" opacity="0.3" />

        {/* Outer-right arc: mirror, faintest */}
        <path d="M80 45 C85 33 82 21 74 14 C64 7 48 10 36 18" strokeWidth="1.8" opacity="0.22" />
      </g>
    </svg>
  );
}

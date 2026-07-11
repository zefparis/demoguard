/**
 * DemoGuard — TestCard (shared card with frozen height)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  height?: number | null;
}

export function TestCard({ children, height }: Props) {
  const style = height ? { height: `${height}px` } : undefined;
  return (
    <div className="test-card" style={style}>
      {children}
    </div>
  );
}

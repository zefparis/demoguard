/**
 * DemoGuard — useLockedShell hook
 *
 * Measures visualViewport.height ONCE at phase entry, freezes card height.
 * No re-measurement during the phase. No 100vh/dvh/clamp during tests.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useLockedShell(phase: string) {
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);
  const [showRotateOverlay, setShowRotateOverlay] = useState(false);
  const lastPhaseRef = useRef<string>('');

  const lock = useCallback(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      setLockedHeight(window.innerHeight);
      return;
    }
    const h = window.visualViewport.height;
    setLockedHeight(h);
  }, []);

  useEffect(() => {
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase;
      lock();
    }
  }, [phase, lock]);

  useEffect(() => {
    const onOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setShowRotateOverlay(isLandscape);
    };
    window.addEventListener('orientationchange', onOrientationChange);
    return () => window.removeEventListener('orientationchange', onOrientationChange);
  }, []);

  return { lockedHeight, showRotateOverlay, lock };
}

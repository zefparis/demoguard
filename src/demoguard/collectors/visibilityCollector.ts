/**
 * DemoGuard — Visibility/focus collector
 *
 * Tracks visibilitychange, blur, focus events.
 * Returns safe summary only.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardVisibilitySignal } from '../types';

export function collectVisibility(durationMs: number = 5000): Promise<DemoGuardVisibilitySignal> {
  return new Promise((resolve) => {
    let blurCount = 0;
    let focusCount = 0;
    let visibilityHiddenCount = 0;
    let hiddenDurationMs = 0;
    let hiddenAt = 0;
    let pageFocusLost = false;

    const onVisibilityChange = () => {
      if (document.hidden) {
        visibilityHiddenCount++;
        hiddenAt = performance.now();
        pageFocusLost = true;
      } else if (hiddenAt > 0) {
        hiddenDurationMs += Math.round(performance.now() - hiddenAt);
        hiddenAt = 0;
      }
    };

    const onBlur = () => {
      blurCount++;
      pageFocusLost = true;
    };

    const onFocus = () => {
      focusCount++;
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);

      if (hiddenAt > 0) {
        hiddenDurationMs += Math.round(performance.now() - hiddenAt);
      }

      const quality: DemoGuardVisibilitySignal['quality'] =
        blurCount === 0 ? 'ok' : 'low';

      resolve({
        blur_count: blurCount,
        focus_count: focusCount,
        visibility_hidden_count: visibilityHiddenCount,
        hidden_duration_ms: hiddenDurationMs,
        page_focus_lost: pageFocusLost,
        quality,
      });
    }, durationMs);
  });
}

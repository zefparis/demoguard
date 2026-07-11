/**
 * DemoGuard — Visibility/focus collector (streaming mode)
 *
 * Tracks visibilitychange, blur, focus events.
 * Returns safe summary only.
 *
 * Streaming API: startVisibilityCollection() / stopVisibilityCollection()
 * One-shot API: collectVisibility(durationMs) — kept for backward compat.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardVisibilitySignal } from '../types';

let streamingState: {
  running: boolean;
  blurCount: number;
  focusCount: number;
  visibilityHiddenCount: number;
  hiddenDurationMs: number;
  hiddenAt: number;
  pageFocusLost: boolean;
  onVisibilityChange: (() => void) | null;
  onBlur: (() => void) | null;
  onFocus: (() => void) | null;
} | null = null;

export function startVisibilityCollection(): void {
  if (streamingState?.running) return;

  let blurCount = 0;
  let focusCount = 0;
  let visibilityHiddenCount = 0;
  let hiddenDurationMs = 0;
  let hiddenAt = 0;
  let pageFocusLost = false;

  const onVisibilityChange = () => {
    if (!streamingState?.running) return;
    if (document.hidden) {
      visibilityHiddenCount++;
      hiddenAt = performance.now();
      pageFocusLost = true;
    } else if (hiddenAt > 0) {
      hiddenDurationMs += Math.round(performance.now() - hiddenAt);
      hiddenAt = 0;
    }
    streamingState.blurCount = blurCount;
    streamingState.focusCount = focusCount;
    streamingState.visibilityHiddenCount = visibilityHiddenCount;
    streamingState.hiddenDurationMs = hiddenDurationMs;
    streamingState.hiddenAt = hiddenAt;
    streamingState.pageFocusLost = pageFocusLost;
  };

  const onBlur = () => {
    if (!streamingState?.running) return;
    blurCount++;
    pageFocusLost = true;
    streamingState.blurCount = blurCount;
    streamingState.pageFocusLost = pageFocusLost;
  };

  const onFocus = () => {
    if (!streamingState?.running) return;
    focusCount++;
    streamingState.focusCount = focusCount;
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  streamingState = {
    running: true,
    blurCount,
    focusCount,
    visibilityHiddenCount,
    hiddenDurationMs,
    hiddenAt,
    pageFocusLost,
    onVisibilityChange,
    onBlur,
    onFocus,
  };
}

export function stopVisibilityCollection(): DemoGuardVisibilitySignal {
  if (!streamingState) {
    return {
      blur_count: 0,
      focus_count: 0,
      visibility_hidden_count: 0,
      hidden_duration_ms: 0,
      page_focus_lost: false,
      quality: 'missing',
    };
  }

  const s = streamingState;
  streamingState = null;

  if (s.onVisibilityChange) document.removeEventListener('visibilitychange', s.onVisibilityChange);
  if (s.onBlur) window.removeEventListener('blur', s.onBlur);
  if (s.onFocus) window.removeEventListener('focus', s.onFocus);

  let hiddenDurationMs = s.hiddenDurationMs;
  if (s.hiddenAt > 0) {
    hiddenDurationMs += Math.round(performance.now() - s.hiddenAt);
  }

  const quality: DemoGuardVisibilitySignal['quality'] =
    s.blurCount === 0 ? 'ok' : 'low';

  return {
    blur_count: s.blurCount,
    focus_count: s.focusCount,
    visibility_hidden_count: s.visibilityHiddenCount,
    hidden_duration_ms: hiddenDurationMs,
    page_focus_lost: s.pageFocusLost,
    quality,
  };
}

export function isVisibilityCollecting(): boolean {
  return streamingState?.running ?? false;
}

// ─── One-shot API (backward compat) ───────────────────────────────

export function collectVisibility(durationMs: number = 5000): Promise<DemoGuardVisibilitySignal> {
  return new Promise((resolve) => {
    startVisibilityCollection();
    setTimeout(() => {
      resolve(stopVisibilityCollection());
    }, durationMs);
  });
}

/**
 * DemoGuard — Network collector (streaming mode)
 *
 * Uses navigator.connection if available.
 * Falls back gracefully on unsupported browsers.
 *
 * Streaming API: startNetworkCollection() / stopNetworkCollection()
 * One-shot API: collectNetwork() — kept for backward compat.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardNetworkSignal } from '../types';

interface NetworkInformation {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
}

function getConnection(): NetworkInformation | null {
  const nav = navigator as unknown as {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function isNetworkInfoSupported(): boolean {
  return getConnection() !== null;
}

// ─── Streaming state ──────────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;

let streamingState: {
  running: boolean;
  lastSnapshot: DemoGuardNetworkSignal;
  intervalId: ReturnType<typeof setInterval> | null;
} | null = null;

function snapshot(): DemoGuardNetworkSignal {
  const conn = getConnection();
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!conn) {
    return { online, quality: 'unsupported' };
  }

  const quality: DemoGuardNetworkSignal['quality'] =
    conn.effectiveType ? 'ok' : 'low';

  return {
    online,
    effective_type: conn.effectiveType,
    rtt: conn.rtt,
    downlink: conn.downlink,
    quality,
  };
}

export function startNetworkCollection(): void {
  if (streamingState?.running) return;

  const initial = snapshot();
  const intervalId = setInterval(() => {
    if (!streamingState?.running) return;
    streamingState.lastSnapshot = snapshot();
  }, POLL_INTERVAL_MS);

  streamingState = {
    running: true,
    lastSnapshot: initial,
    intervalId,
  };
}

export function stopNetworkCollection(): DemoGuardNetworkSignal {
  if (!streamingState) {
    return snapshot();
  }

  const s = streamingState;
  streamingState = null;

  if (s.intervalId) {
    clearInterval(s.intervalId);
  }

  return s.lastSnapshot;
}

export function isNetworkCollecting(): boolean {
  return streamingState?.running ?? false;
}

// ─── One-shot API (backward compat) ───────────────────────────────

export function collectNetwork(): DemoGuardNetworkSignal {
  return snapshot();
}

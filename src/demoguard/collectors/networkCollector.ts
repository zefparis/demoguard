/**
 * DemoGuard — Network collector
 *
 * Uses navigator.connection if available.
 * Falls back gracefully on unsupported browsers.
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

export function collectNetwork(): DemoGuardNetworkSignal {
  const conn = getConnection();
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!conn) {
    return {
      online,
      quality: 'unsupported',
    };
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

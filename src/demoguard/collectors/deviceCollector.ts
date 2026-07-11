/**
 * DemoGuard — Device context collector
 *
 * Collects non-PII device metadata for demo signal readiness.
 * No selfies, no voice, no identity fields.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardDeviceContext } from '../types';

export function collectDeviceContext(): DemoGuardDeviceContext {
  const nav = navigator;
  const screen = window.screen;

  return {
    platform: nav.platform || 'unknown',
    osVersion: nav.userAgent || 'unknown',
    model: null,
    manufacturer: null,
    screenWidth: screen?.width ?? null,
    screenHeight: screen?.height ?? null,
    pixelRatio: window.devicePixelRatio ?? null,
    language: nav.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    online: nav.onLine,
  };
}

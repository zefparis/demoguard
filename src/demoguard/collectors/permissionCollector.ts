/**
 * DemoGuard — Permission collector
 *
 * Queries browser/device permission states without requesting access.
 * No PII collected.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardPermissions, PermissionStatus } from '../types';

async function queryPermission(name: string): Promise<PermissionStatus> {
  try {
    if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
      const result = await navigator.permissions.query({ name: name as PermissionName });
      return result.state as PermissionStatus;
    }
  } catch {
    // Permission API not supported or name invalid
  }
  return 'unknown';
}

function checkMotionSupport(): PermissionStatus {
  if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return 'unsupported';
  const DME = window.DeviceMotionEvent as unknown as { requestPermission?: unknown };
  if (typeof DME.requestPermission === 'function') return 'prompt';
  return 'granted';
}

function checkOrientationSupport(): PermissionStatus {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return 'unsupported';
  const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: unknown };
  if (typeof DOE.requestPermission === 'function') return 'prompt';
  return 'granted';
}

export async function collectPermissions(): Promise<DemoGuardPermissions> {
  const [camera, microphone, notifications, location] = await Promise.all([
    queryPermission('camera'),
    queryPermission('microphone'),
    queryPermission('notifications'),
    queryPermission('geolocation'),
  ]);

  const motion = checkMotionSupport();
  const orientation = checkOrientationSupport();

  return { camera, microphone, notifications, location, motion, orientation };
}

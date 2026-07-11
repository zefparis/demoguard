/**
 * DemoGuard — Camera collector
 *
 * Reuses technical utilities from lib/camera.ts (pure functions, no PayGuard coupling).
 * Returns safe metadata for UI + sensitive capture for proxy submit only.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { startCameraStream, stopStream, captureSelfie } from '../../lib/camera';
import type { DemoGuardSelfieSignal } from '../types';

export type CameraCollectorError =
  | { kind: 'permission-denied' }
  | { kind: 'unavailable' }
  | { kind: 'other'; message: string };

export interface CameraCollectorResult {
  safe: DemoGuardSelfieSignal;
  sensitive: { selfie_b64: string } | null;
  error: CameraCollectorError | null;
}

export async function requestCamera(): Promise<MediaStream> {
  return startCameraStream('user');
}

export function stopCamera(stream: MediaStream | null): void {
  stopStream(stream);
}

export async function captureSelfieFromVideo(
  videoEl: HTMLVideoElement,
  stream: MediaStream | null,
): Promise<CameraCollectorResult> {
  try {
    if (!stream) {
      return {
        safe: { captured: false, quality: 'missing' },
        sensitive: null,
        error: { kind: 'other', message: 'Camera stream not active' },
      };
    }

    const b64 = await captureSelfie(videoEl);
    const width = videoEl.videoWidth || 1280;
    const height = videoEl.videoHeight || 960;

    return {
      safe: {
        captured: true,
        quality: b64.length > 50000 ? 'ok' : 'low',
        width,
        height,
      },
      sensitive: { selfie_b64: b64 },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Capture failed';
    return {
      safe: { captured: false, quality: 'missing' },
      sensitive: null,
      error: { kind: 'other', message },
    };
  }
}

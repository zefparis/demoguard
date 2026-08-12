/**
 * DemoGuard — useContinuousSignals hook
 *
 * Manages the lifecycle of all 5 streaming device signal collectors
 * (motion, orientation, touch, visibility, network) across the entire
 * DemoGuard session. Start in prep phase, stop at submit.
 *
 * Also tracks the current phase via phaseTracker so collectors can
 * tag samples with the active cognitive phase.
 *
 * iOS 13+ Safari requires DeviceMotionEvent.requestPermission() and
 * DeviceOrientationEvent.requestPermission() to be called from a user
 * gesture handler (click/tap). The hook exposes requestSensorPermissions()
 * which MUST be called synchronously from an onClick handler — it calls
 * both requestPermission() back-to-back before any await that would break
 * the user-activation chain. start() then registers the listeners using
 * the resolved permission values.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DemoGuardSignals, PermissionStatus } from '../demoguard/types';
import { startMotionCollection, stopMotionCollection, isMotionCollecting, requestMotionPermission } from '../demoguard/collectors/motionCollector';
import { startOrientationCollection, stopOrientationCollection, isOrientationCollecting, requestOrientationPermission } from '../demoguard/collectors/orientationCollector';
import { startTouchCollection, stopTouchCollection, isTouchCollecting } from '../demoguard/collectors/touchCollector';
import { startVisibilityCollection, stopVisibilityCollection, isVisibilityCollecting } from '../demoguard/collectors/visibilityCollector';
import { startNetworkCollection, stopNetworkCollection, isNetworkCollecting } from '../demoguard/collectors/networkCollector';
import { phaseTracker } from '../demoguard/collectors/phaseTracker';

export interface SensorPermissions {
  motion: PermissionStatus;
  orientation: PermissionStatus;
  /** true if requestPermission() was actually called (iOS 13+), false if auto-granted (Android/desktop) */
  motionRequested: boolean;
  orientationRequested: boolean;
}

export interface ContinuousSignalsResult {
  /**
   * Request iOS motion/orientation permissions. MUST be called synchronously
   * from a user gesture handler (onClick). On Android/desktop where
   * requestPermission() does not exist, returns the input permissions as-is
   * with *Requested=false.
   *
   * Both requestPermission() calls are fired back-to-back (Promise.all) to
   * stay within the same user-activation window — no await between them.
   */
  requestSensorPermissions: (permissions: { motion: PermissionStatus; orientation: PermissionStatus }) => Promise<SensorPermissions>;
  /**
   * Register all streaming collectors. Call AFTER requestSensorPermissions()
   * has resolved (from the same click handler's async continuation is fine —
   * the listeners themselves don't require user activation, only the
   * requestPermission() calls do).
   */
  start: (permissions: SensorPermissions) => Promise<void>;
  stop: () => Partial<DemoGuardSignals>;
  setPhase: (phase: string) => void;
  isCollecting: () => boolean;
}

export function useContinuousSignals(): ContinuousSignalsResult {
  const startedRef = useRef(false);

  const requestSensorPermissions = useCallback(async (permissions: { motion: PermissionStatus; orientation: PermissionStatus }): Promise<SensorPermissions> => {
    let motionPerm: PermissionStatus = permissions.motion;
    let orientationPerm: PermissionStatus = permissions.orientation;
    let motionRequested = false;
    let orientationRequested = false;

    // Fire both requestPermission() calls back-to-back via Promise.all so
    // they execute within the same user-activation window on iOS Safari.
    // No await between them — Promise.all starts both microtasks immediately.
    const motionPromise = motionPerm === 'prompt'
      ? requestMotionPermission().catch(() => 'denied' as PermissionStatus).then((r) => { motionPerm = r; motionRequested = true; })
      : Promise.resolve();
    const orientationPromise = orientationPerm === 'prompt'
      ? requestOrientationPermission().catch(() => 'denied' as PermissionStatus).then((r) => { orientationPerm = r; orientationRequested = true; })
      : Promise.resolve();

    await Promise.all([motionPromise, orientationPromise]);

    return { motion: motionPerm, orientation: orientationPerm, motionRequested, orientationRequested };
  }, []);

  const start = useCallback(async (permissions: SensorPermissions): Promise<void> => {
    if (startedRef.current) return;
    startedRef.current = true;

    phaseTracker.startSession();

    startMotionCollection(permissions.motion, permissions.motionRequested);
    startOrientationCollection(permissions.orientation, permissions.orientationRequested);
    startTouchCollection();
    startVisibilityCollection();
    startNetworkCollection();
  }, []);

  const stop = useCallback((): Partial<DemoGuardSignals> => {
    if (!startedRef.current) {
      return {};
    }
    startedRef.current = false;

    const signals: Partial<DemoGuardSignals> = {};

    if (isMotionCollecting()) {
      signals.motion = stopMotionCollection();
    }
    if (isOrientationCollecting()) {
      signals.orientation = stopOrientationCollection();
    }
    if (isTouchCollecting()) {
      signals.touch = stopTouchCollection();
    }
    if (isVisibilityCollecting()) {
      signals.visibility = stopVisibilityCollection();
    }
    if (isNetworkCollecting()) {
      signals.network = stopNetworkCollection();
    }

    return signals;
  }, []);

  const setPhase = useCallback((phase: string) => {
    phaseTracker.setPhase(phase);
  }, []);

  const isCollecting = useCallback(() => startedRef.current, []);

  useEffect(() => {
    return () => {
      if (startedRef.current) {
        if (isMotionCollecting()) stopMotionCollection();
        if (isOrientationCollecting()) stopOrientationCollection();
        if (isTouchCollecting()) stopTouchCollection();
        if (isVisibilityCollecting()) stopVisibilityCollection();
        if (isNetworkCollecting()) stopNetworkCollection();
        startedRef.current = false;
      }
    };
  }, []);

  return { requestSensorPermissions, start, stop, setPhase, isCollecting };
}

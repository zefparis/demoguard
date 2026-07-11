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

export interface ContinuousSignalsResult {
  start: (permissions: { motion: PermissionStatus; orientation: PermissionStatus }) => Promise<void>;
  stop: () => Partial<DemoGuardSignals>;
  setPhase: (phase: string) => void;
  isCollecting: () => boolean;
}

export function useContinuousSignals(): ContinuousSignalsResult {
  const startedRef = useRef(false);

  const start = useCallback(async (permissions: { motion: PermissionStatus; orientation: PermissionStatus }) => {
    if (startedRef.current) return;
    startedRef.current = true;

    phaseTracker.startSession();

    let motionPerm: PermissionStatus = permissions.motion;
    let orientationPerm: PermissionStatus = permissions.orientation;

    if (motionPerm === 'prompt') {
      motionPerm = await requestMotionPermission().catch(() => 'denied' as PermissionStatus);
    }
    if (orientationPerm === 'prompt') {
      orientationPerm = await requestOrientationPermission().catch(() => 'denied' as PermissionStatus);
    }

    startMotionCollection(motionPerm);
    startOrientationCollection(orientationPerm);
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

  return { start, stop, setPhase, isCollecting };
}

/**
 * DemoGuard — useBehaviorSession hook
 *
 * Creates a BehaviorSession instance per session via useRef.
 * Reset guaranteed at START.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useRef, useCallback } from 'react';
import { BehaviorSession } from '../demoguard/behavior/behaviorSession';

export function useBehaviorSession() {
  const sessionRef = useRef<BehaviorSession>(new BehaviorSession());

  const reset = useCallback(() => {
    sessionRef.current = new BehaviorSession();
  }, []);

  const getPayload = useCallback(() => {
    return sessionRef.current.getPayload();
  }, []);

  const getTouchDiagnostics = useCallback(() => {
    return sessionRef.current.getTouchDiagnostics();
  }, []);

  const getSession = useCallback(() => {
    return sessionRef.current;
  }, []);

  return { session: sessionRef.current, reset, getPayload, getTouchDiagnostics, getSession };
}

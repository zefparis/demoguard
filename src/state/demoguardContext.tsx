/**
 * DemoGuard — Context provider
 *
 * Exposes state, dispatch, behavior session, and sensitive refs.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { DemoGuardState, Action } from './demoguardReducer';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';

export interface SensitiveRef {
  selfie_b64: string | null;
  voice_b64: string | null;
  mfcc_summary: number[] | null;
}

export interface DemoGuardContextValue {
  state: DemoGuardState;
  dispatch: React.Dispatch<Action>;
  behaviorSession: BehaviorSession;
  sensitive: React.MutableRefObject<SensitiveRef>;
}

export const DemoGuardContext = createContext<DemoGuardContextValue | null>(null);

export function DemoGuardProvider({ value, children }: { value: DemoGuardContextValue; children: ReactNode }) {
  return <DemoGuardContext.Provider value={value}>{children}</DemoGuardContext.Provider>;
}

export function useDemoGuard(): DemoGuardContextValue {
  const ctx = useContext(DemoGuardContext);
  if (!ctx) throw new Error('useDemoGuard must be used within DemoGuardProvider');
  return ctx;
}

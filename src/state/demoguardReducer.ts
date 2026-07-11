/**
 * DemoGuard — Reducer (single source of truth for state)
 *
 * All phase transitions go through this reducer. No setPhase elsewhere.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardSignals, DemoGuardPermissions, DemoGuardDeviceContext, DemoGuardQuality, DemoGuardSafeResponse, VoiceDiagnosticsSafe, TouchDiagnosticsSafe } from '../demoguard/types';
import type { CognitiveSignals } from '../demoguard/cognitive/cognitiveTypes';
import type { BehaviorPayload, TouchDiagnosticsBehaviorSafe } from '../demoguard/behavior/behaviorTypes';

export type Phase =
  | 'idle'
  | 'prep'
  | 'camera'
  | 'test_reflex'
  | 'test_colors'
  | 'test_memory'
  | 'test_compare'
  | 'test_path'
  | 'voice'
  | 'review'
  | 'device_signals'
  | 'readiness'
  | 'submitting'
  | 'done'
  | 'error';

export interface DemoGuardState {
  phase: Phase;
  sessionPublicId: string;
  startedAt: string | null;
  completedAt: string | null;
  device: DemoGuardDeviceContext | null;
  permissions: DemoGuardPermissions | null;
  signals: DemoGuardSignals;
  quality: DemoGuardQuality | null;
  cognitiveSignals: CognitiveSignals | null;
  voiceDiagnostic: VoiceDiagnosticsSafe | null;
  touchDiagnostic: TouchDiagnosticsSafe | null;
  behaviorPayload: BehaviorPayload | null;
  touchDiagnosticsBehavior: TouchDiagnosticsBehaviorSafe | null;
  response: DemoGuardSafeResponse | null;
  error: string | null;
}

export const initialState: DemoGuardState = {
  phase: 'idle',
  sessionPublicId: '',
  startedAt: null,
  completedAt: null,
  device: null,
  permissions: null,
  signals: {
    selfie: null,
    voice: null,
    motion: null,
    orientation: null,
    touch: null,
    visibility: null,
    network: null,
    cognitive: null,
    behavior: null,
    voiceDiagnostics: undefined,
    touchDiagnostics: undefined,
    touchDiagnosticsBehavior: undefined,
  },
  quality: null,
  cognitiveSignals: null,
  voiceDiagnostic: null,
  touchDiagnostic: null,
  behaviorPayload: null,
  touchDiagnosticsBehavior: null,
  response: null,
  error: null,
};

export type Action =
  | { type: 'START'; sessionPublicId: string }
  | { type: 'PREP_READY' }
  | { type: 'DEVICE_COLLECTED'; device: DemoGuardDeviceContext }
  | { type: 'PERMISSIONS_COLLECTED'; permissions: DemoGuardPermissions }
  | { type: 'SELFIE_CAPTURED'; selfie: DemoGuardSignals['selfie'] }
  | { type: 'TEST_COMPLETED'; testName: string; signal: unknown }
  | { type: 'COGNITIVE_COMPLETED'; cognitive: CognitiveSignals }
  | { type: 'VOICE_CAPTURED'; voice: DemoGuardSignals['voice']; diagnostic: VoiceDiagnosticsSafe | null }
  | { type: 'BEHAVIOR_COLLECTED'; payload: BehaviorPayload; touchDiag: TouchDiagnosticsBehaviorSafe }
  | { type: 'REVIEW_CONTINUE' }
  | { type: 'DEVICE_SIGNALS_COLLECTED'; signals: Partial<DemoGuardSignals> }
  | { type: 'DEVICE_SIGNALS_CONTINUE' }
  | { type: 'QUALITY_COMPUTED'; quality: DemoGuardQuality }
  | { type: 'SUBMIT' }
  | { type: 'RESPONSE_RECEIVED'; response: DemoGuardSafeResponse }
  | { type: 'ERROR'; reason: string }
  | { type: 'RETRY_PHASE' }
  | { type: 'RESET' };

const VALID_TRANSITIONS: Record<Phase, Phase[]> = {
  idle: ['prep'],
  prep: ['camera', 'error'],
  camera: ['test_reflex', 'error'],
  test_reflex: ['test_colors', 'error'],
  test_colors: ['test_memory', 'error'],
  test_memory: ['test_compare', 'error'],
  test_compare: ['test_path', 'error'],
  test_path: ['voice', 'error'],
  voice: ['review', 'error'],
  review: ['device_signals', 'error'],
  device_signals: ['readiness', 'error'],
  readiness: ['submitting', 'error'],
  submitting: ['done', 'error'],
  done: ['idle'],
  error: ['idle'],
};

function isValidTransition(from: Phase, to: Phase): boolean {
  if (to === 'error') return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function demoguardReducer(state: DemoGuardState, action: Action): DemoGuardState {
  switch (action.type) {
    case 'START': {
      return {
        ...initialState,
        phase: 'prep',
        sessionPublicId: action.sessionPublicId,
        startedAt: new Date().toISOString(),
      };
    }

    case 'PREP_READY': {
      if (!isValidTransition(state.phase, 'camera')) return state;
      return { ...state, phase: 'camera' };
    }

    case 'DEVICE_COLLECTED': {
      return { ...state, device: action.device };
    }

    case 'PERMISSIONS_COLLECTED': {
      return { ...state, permissions: action.permissions };
    }

    case 'SELFIE_CAPTURED': {
      return {
        ...state,
        signals: { ...state.signals, selfie: action.selfie },
        phase: 'test_reflex',
      };
    }

    case 'TEST_COMPLETED': {
      const testName = action.testName;
      const phaseAfter: Record<string, Phase> = {
        reflex: 'test_colors',
        stroop: 'test_memory',
        digit_span: 'test_compare',
        n_back: 'test_path',
        trail_tap: 'voice',
      };
      const nextPhase = phaseAfter[testName];
      if (!nextPhase || !isValidTransition(state.phase, nextPhase)) return state;

      const cognitive: CognitiveSignals = state.cognitiveSignals ?? {
        reflex: null, stroop: null, digit_span: null, n_back: null, trail_tap: null, vocal_ran: null, summary: null,
      };
      (cognitive as unknown as Record<string, unknown>)[testName] = action.signal;

      return {
        ...state,
        cognitiveSignals: cognitive,
        signals: { ...state.signals, cognitive },
        phase: nextPhase,
      };
    }

    case 'COGNITIVE_COMPLETED': {
      const nextPhase: Phase = 'voice';
      if (!isValidTransition(state.phase, nextPhase)) return state;
      return {
        ...state,
        cognitiveSignals: action.cognitive,
        signals: { ...state.signals, cognitive: action.cognitive },
        phase: nextPhase,
      };
    }

    case 'VOICE_CAPTURED': {
      const nextPhase: Phase = 'review';
      if (!isValidTransition(state.phase, nextPhase)) return state;
      return {
        ...state,
        signals: { ...state.signals, voice: action.voice, voiceDiagnostics: action.diagnostic ?? undefined },
        voiceDiagnostic: action.diagnostic,
        phase: nextPhase,
      };
    }

    case 'BEHAVIOR_COLLECTED': {
      return {
        ...state,
        behaviorPayload: action.payload,
        touchDiagnosticsBehavior: action.touchDiag,
        signals: {
          ...state.signals,
          behavior: action.payload,
          touchDiagnosticsBehavior: action.touchDiag,
        },
      };
    }

    case 'REVIEW_CONTINUE': {
      if (!isValidTransition(state.phase, 'device_signals')) return state;
      return { ...state, phase: 'device_signals' };
    }

    case 'DEVICE_SIGNALS_COLLECTED': {
      return {
        ...state,
        signals: { ...state.signals, ...action.signals },
      };
    }

    case 'DEVICE_SIGNALS_CONTINUE': {
      if (!isValidTransition(state.phase, 'readiness')) return state;
      return { ...state, phase: 'readiness' };
    }

    case 'QUALITY_COMPUTED': {
      const nextPhase: Phase = 'submitting';
      if (!isValidTransition(state.phase, nextPhase)) return state;
      return { ...state, quality: action.quality, phase: nextPhase };
    }

    case 'SUBMIT': {
      if (!isValidTransition(state.phase, 'submitting')) return state;
      return { ...state, phase: 'submitting' };
    }

    case 'RESPONSE_RECEIVED': {
      return {
        ...state,
        phase: 'done',
        response: action.response,
        completedAt: new Date().toISOString(),
      };
    }

    case 'ERROR': {
      return { ...state, phase: 'error', error: action.reason };
    }

    case 'RETRY_PHASE': {
      if (state.phase === 'error') {
        return { ...state, phase: 'prep', error: null };
      }
      return state;
    }

    case 'RESET': {
      return { ...initialState };
    }

    default:
      return state;
  }
}

/**
 * DemoGuard — App.tsx (main orchestrator)
 *
 * Wires reducer + context + hooks + screens.
 * All phase transitions go through the reducer.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useReducer, useRef, useCallback, useEffect } from 'react';
import { demoguardReducer, initialState } from './state/demoguardReducer';
import { DemoGuardProvider } from './state/demoguardContext';
import type { SensitiveRef } from './state/demoguardContext';
import { useBehaviorSession } from './hooks/useBehaviorSession';
import { useLockedShell } from './hooks/useLockedShell';
import { useContinuousSignals } from './hooks/useContinuousSignals';
import { buildDemoGuardPayload } from './payload/buildDemoGuardPayload';
import { submitDemoGuard } from './demoguard/api';
import type { DemoGuardSelfieSignal, DemoGuardVoiceSignal, VoiceDiagnosticsSafe } from './demoguard/types';

import { IdleScreen } from './screens/IdleScreen';
import { PrepScreen } from './screens/PrepScreen';
import { CameraScreen } from './screens/CameraScreen';
import { ReflexScreen } from './screens/ReflexScreen';
import { StroopScreen } from './screens/StroopScreen';
import { DigitSpanScreen } from './screens/DigitSpanScreen';
import { NBackScreen } from './screens/NBackScreen';
import { TrailTapScreen } from './screens/TrailTapScreen';
import { VoiceScreen } from './screens/VoiceScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { DeviceSignalsScreen } from './screens/DeviceSignalsScreen';
import { ReadinessScreen } from './screens/ReadinessScreen';
import { SubmittingScreen } from './screens/SubmittingScreen';
import { DoneScreen } from './screens/DoneScreen';
import { ErrorScreen } from './screens/ErrorScreen';

export default function App() {
  const [state, dispatch] = useReducer(demoguardReducer, initialState);
  const { session, reset, getPayload, getTouchDiagnostics } = useBehaviorSession();
  const { lockedHeight, showRotateOverlay } = useLockedShell(state.phase);
  const continuousSignals = useContinuousSignals();

  useEffect(() => {
    continuousSignals.setPhase(state.phase);
  }, [state.phase]);

  const sensitiveRef = useRef<SensitiveRef>({
    selfie_b64: null,
    voice_b64: null,
    mfcc_summary: null,
  });

  const handleStart = useCallback((sessionPublicId: string) => {
    reset();
    sensitiveRef.current = { selfie_b64: null, voice_b64: null, mfcc_summary: null };
    dispatch({ type: 'START', sessionPublicId });
  }, [reset]);

  const handleSelfieCaptured = useCallback((selfie: DemoGuardSelfieSignal, selfieB64: string) => {
    sensitiveRef.current.selfie_b64 = selfieB64;
    dispatch({ type: 'SELFIE_CAPTURED', selfie });
  }, []);

  const handleVoiceCaptured = useCallback((
    voice: DemoGuardVoiceSignal,
    diagnostic: VoiceDiagnosticsSafe | null,
    voiceB64: string | null,
    mfccSummary: number[] | null,
  ) => {
    sensitiveRef.current.voice_b64 = voiceB64;
    sensitiveRef.current.mfcc_summary = mfccSummary;
    dispatch({ type: 'VOICE_CAPTURED', voice, diagnostic });
  }, []);

  const handleSubmit = useCallback(async () => {
    dispatch({ type: 'SUBMIT' });

    try {
      const deviceSignals = continuousSignals.stop();
      if (Object.keys(deviceSignals).length > 0) {
        dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals });
      }

      const behaviorPayload = getPayload();
      const behaviorDiag = getTouchDiagnostics();
      dispatch({ type: 'BEHAVIOR_COLLECTED', payload: behaviorPayload, touchDiag: behaviorDiag });

      const payload = buildDemoGuardPayload(state, behaviorPayload, behaviorDiag, sensitiveRef.current);
      const response = await submitDemoGuard(payload);
      dispatch({ type: 'RESPONSE_RECEIVED', response });
    } catch (err) {
      dispatch({ type: 'ERROR', reason: err instanceof Error ? err.message : 'Submission failed' });
    }
  }, [state, getPayload, getTouchDiagnostics, continuousSignals]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const handleRetry = useCallback(() => {
    dispatch({ type: 'RETRY_PHASE' });
  }, []);

  const contextValue = {
    state,
    dispatch,
    behaviorSession: session,
    sensitive: sensitiveRef,
  };

  const shellStyle = lockedHeight ? { height: `${lockedHeight}px` } : undefined;

  return (
    <DemoGuardProvider value={contextValue}>
      <div className="app-shell" style={shellStyle}>
        {showRotateOverlay && (
          <div className="rotate-overlay">
            <div>📱</div>
            <p>Veuillez garder votre appareil en mode portrait</p>
          </div>
        )}

        {state.phase === 'idle' && <IdleScreen onStart={handleStart} />}

        {state.phase === 'prep' && (
          <PrepScreen
            onDeviceCollected={(device) => dispatch({ type: 'DEVICE_COLLECTED', device })}
            onPermissionsCollected={(permissions) => dispatch({ type: 'PERMISSIONS_COLLECTED', permissions })}
            onContinuousSignalsStart={async (perms) => {
              await continuousSignals.start({ motion: perms.motion, orientation: perms.orientation });
            }}
            onReady={() => dispatch({ type: 'PREP_READY' })}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'camera' && (
          <CameraScreen
            onCaptured={handleSelfieCaptured}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'test_reflex' && (
          <ReflexScreen
            session={session}
            onComplete={(signal) => dispatch({ type: 'TEST_COMPLETED', testName: 'reflex', signal })}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'test_colors' && (
          <StroopScreen
            session={session}
            onComplete={(signal) => dispatch({ type: 'TEST_COMPLETED', testName: 'stroop', signal })}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'test_memory' && (
          <DigitSpanScreen
            session={session}
            onComplete={(signal) => dispatch({ type: 'TEST_COMPLETED', testName: 'digit_span', signal })}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'test_compare' && (
          <NBackScreen
            session={session}
            onComplete={(signal) => dispatch({ type: 'TEST_COMPLETED', testName: 'n_back', signal })}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'test_path' && (
          <TrailTapScreen
            session={session}
            onComplete={(signal) => dispatch({ type: 'TEST_COMPLETED', testName: 'trail_tap', signal })}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'voice' && (
          <VoiceScreen
            session={session}
            onComplete={handleVoiceCaptured}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'review' && (
          <ReviewScreen
            state={state}
            behaviorPayload={state.behaviorPayload}
            onContinue={() => {
              const payload = getPayload();
              const touchDiag = getTouchDiagnostics();
              dispatch({ type: 'BEHAVIOR_COLLECTED', payload, touchDiag });
              dispatch({ type: 'REVIEW_CONTINUE' });
            }}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'device_signals' && (
          <DeviceSignalsScreen
            signals={state.signals}
            onContinue={() => dispatch({ type: 'DEVICE_SIGNALS_CONTINUE' })}
          />
        )}

        {state.phase === 'readiness' && (
          <ReadinessScreen
            state={state}
            onSubmit={handleSubmit}
            onError={(reason) => dispatch({ type: 'ERROR', reason })}
          />
        )}

        {state.phase === 'submitting' && <SubmittingScreen />}

        {state.phase === 'done' && (
          <DoneScreen response={state.response} onReset={handleReset} />
        )}

        {state.phase === 'error' && (
          <ErrorScreen
            error={state.error ?? 'Une erreur est survenue'}
            onRetry={handleRetry}
            onReset={handleReset}
          />
        )}
      </div>
    </DemoGuardProvider>
  );
}

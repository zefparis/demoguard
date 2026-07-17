/**
 * DemoGuard — VoiceScreen (voice recording with vocal RAN challenge)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef } from 'react';
import { recordVoiceChallenge, VOICE_DURATION_MS } from '../demoguard/collectors/audioCollector';
import { generateVocalRanChallenge, computeVocalRanResult } from '../demoguard/cognitive/vocalRanChallenge';
import type { VocalRanSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { DemoGuardVoiceSignal, VoiceDiagnosticsSafe } from '../demoguard/types';
import { recordTaskStart } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nContext';
import { generateChallengePhrase } from '../demoguard/collectors/audioCollector';

interface Props {
  session: BehaviorSession;
  onComplete: (voice: DemoGuardVoiceSignal, diagnostic: VoiceDiagnosticsSafe | null, voiceB64: string | null, mfccSummary: number[] | null, vocalRan: VocalRanSignal) => void;
  onError: (reason: string) => void;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

export function VoiceScreen({ session, onComplete, onError }: Props) {
  const { t, locale } = useI18n();
  const [challenge] = useState(() => generateVocalRanChallenge());
  const [phrase] = useState(() => generateChallengePhrase(challenge.challenge_id, locale));
  const [state, setState] = useState<RecordingState>('idle');
  const [interruptMsg, setInterruptMsg] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const retryRef = useRef<boolean>(false);

  useEffect(() => {
    recordTaskStart(session, 'vocal_ran');
  }, []);

  const handleRecord = async () => {
    setState('recording');
    setInterruptMsg(null);
    startTimeRef.current = performance.now();
    try {
      const result = await recordVoiceChallenge(VOICE_DURATION_MS, challenge.challenge_id);

      // ── T5: Handle audio interruption (mobile context suspension, visibility change, etc.)
      if (result.error?.kind === 'audio-interrupted') {
        if (!retryRef.current) {
          retryRef.current = true;
          setInterruptMsg(t('voice.interrupted'));
          setState('idle');
          return;
        }
        // Already retried once — fall through to error
        retryRef.current = false;
        onError(t('voice.interruptedFinal'));
        setState('idle');
        return;
      }

      retryRef.current = false;
      const durationMs = performance.now() - startTimeRef.current;
      const vocalRan = computeVocalRanResult(challenge, durationMs, result.safe.recorded);

      const diagnostic: VoiceDiagnosticsSafe | null = result.safe.recorded
        ? {
            status: 'not_checked',
            reasonSafe: 'voice_checked',
            analysisMode: result.diagnostic.analysisMode,
            audioCaptured: result.diagnostic.audioCaptured,
            payloadPrepared: result.diagnostic.payloadPrepared,
            relayAttempted: false,
            relayAccepted: false,
            hcsAnalyzed: false,
            featuresExtracted: result.safe.mfcc_available ?? false,
            livenessStatus: 'unknown',
            confidence: null,
            latencyMs: null,
          }
        : null;

      onComplete(result.safe, diagnostic, result.sensitive?.voice_b64 ?? null, result.sensitive?.mfcc_summary ?? null, vocalRan);
      setState('done');
    } catch (err) {
      retryRef.current = false;
      onError(err instanceof Error ? err.message : 'Voice recording failed');
      setState('idle');
    }
  };

  return (
    <div className="screen">
      <PhaseHeader title={t('voice.title')} progress="7/7" progressPct={95} />
      <ErrorBoundary onRetry={() => setState('idle')}>
        <div className="voice-visual">
          <div className={`voice-pulse ${state === 'recording' ? 'recording' : ''}`} />
          {state === 'idle' && (
            <>
              {interruptMsg && (
                <p style={{ color: '#e67e22', fontWeight: 600, marginBottom: 12 }}>{interruptMsg}</p>
              )}
              <p>{t('voice.readAloud')}</p>
              <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: 8 }}>
                {phrase}
              </p>
              <p className="muted">{t('voice.duration')}: {VOICE_DURATION_MS / 1000}s</p>
              <button className="btn" onClick={handleRecord}>{t('voice.record')}</button>
            </>
          )}
          {state === 'recording' && <p style={{ fontSize: 20, fontWeight: 600 }}>{t('voice.recording')}</p>}
          {state === 'processing' && <p className="muted">{t('voice.processing')}</p>}
          {state === 'done' && <p>{t('voice.done')}</p>}
        </div>
      </ErrorBoundary>
    </div>
  );
}

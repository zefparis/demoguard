/**
 * DemoGuard — NBackScreen (1-back matching test)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef } from 'react';
import {
  NBACK_TRIALS,
  generateNBackTrials,
  evaluateNBackTrial,
  computeNBackResult,
} from '../demoguard/cognitive/nBackChallenge';
import type { NBackSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { NBackTrialConfig, NBackTrialResult } from '../demoguard/cognitive/nBackChallenge';
import { recordTaskStart, recordNBackDecision } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface Props {
  session: BehaviorSession;
  onComplete: (signal: NBackSignal) => void;
  onError: (reason: string) => void;
}

export function NBackScreen({ session, onComplete }: Props) {
  const [trials] = useState<NBackTrialConfig[]>(() => generateNBackTrials(NBACK_TRIALS));
  const [trialIdx, setTrialIdx] = useState(0);
  const [results, setResults] = useState<NBackTrialResult[]>([]);
  const [showing, setShowing] = useState(true);
  const trialStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    recordTaskStart(session, 'n_back');
    showTrial();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const showTrial = () => {
    setShowing(true);
    trialStartRef.current = performance.now();
    timerRef.current = setTimeout(() => setShowing(false), 2000);
  };

  const handleResponse = (saidMatch: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const config = trials[trialIdx];
    const responseMs = performance.now() - trialStartRef.current;
    const result = evaluateNBackTrial(config, saidMatch, responseMs);
    recordNBackDecision(session, result.isHit || result.isCorrectRejection, responseMs);
    const newResults = [...results, result];
    setResults(newResults);

    if (trialIdx + 1 >= trials.length) {
      const signal = computeNBackResult(newResults);
      onComplete(signal);
    } else {
      setTrialIdx(trialIdx + 1);
      setTimeout(() => showTrial(), 300);
    }
  };

  return (
    <div className="screen">
      <PhaseHeader title="Comparaison (N-Back)" progress={`5/7 — ${trialIdx + 1}/${trials.length}`} progressPct={71} />
      <ErrorBoundary onRetry={() => { setTrialIdx(0); setResults([]); showTrial(); }}>
        <div className="nback-letter">
          {showing ? trials[trialIdx].letter : '—'}
        </div>
        {!showing && (
          <>
            <p className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
              Identique au précédent ?
            </p>
            <div className="nback-buttons">
              <button className="btn btn-secondary" onClick={() => handleResponse(false)}>Non</button>
              <button className="btn" onClick={() => handleResponse(true)}>Oui</button>
            </div>
          </>
        )}
        {showing && <p className="muted" style={{ textAlign: 'center' }}>Mémorisez…</p>}
      </ErrorBoundary>
    </div>
  );
}

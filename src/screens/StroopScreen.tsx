/**
 * DemoGuard — StroopScreen (color-word conflict test)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef } from 'react';
import {
  STROOP_TRIALS,
  generateStroopTrials,
  computeStroopResult,
} from '../demoguard/cognitive/stroopChallenge';
import type { StroopSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { StroopTrialConfig, StroopTrialResult } from '../demoguard/cognitive/stroopChallenge';
import { recordTaskStart, recordStroopSelection } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab700',
};

interface Props {
  session: BehaviorSession;
  onComplete: (signal: StroopSignal) => void;
  onError: (reason: string) => void;
}

export function StroopScreen({ session, onComplete }: Props) {
  const [trials] = useState<StroopTrialConfig[]>(() => generateStroopTrials(STROOP_TRIALS));
  const [trialIdx, setTrialIdx] = useState(0);
  const [results, setResults] = useState<StroopTrialResult[]>([]);
  const trialStartRef = useRef<number>(0);

  useEffect(() => {
    recordTaskStart(session, 'stroop');
    trialStartRef.current = performance.now();
  }, []);

  const handleSelect = (color: string) => {
    const config = trials[trialIdx];
    const responseMs = performance.now() - trialStartRef.current;
    const correct = color === config.displayColor;
    const result: StroopTrialResult = { config, selected: color as never, correct, response_ms: responseMs };
    recordStroopSelection(session, color, correct, responseMs, false);
    const newResults = [...results, result];
    setResults(newResults);

    if (trialIdx + 1 >= trials.length) {
      const signal = computeStroopResult(newResults);
      onComplete(signal);
    } else {
      setTrialIdx(trialIdx + 1);
      trialStartRef.current = performance.now();
    }
  };

  const current = trials[trialIdx];

  return (
    <div className="screen">
      <PhaseHeader title="Couleurs (Stroop)" progress={`3/7 — ${trialIdx + 1}/${trials.length}`} progressPct={42} />
      <ErrorBoundary onRetry={() => { setTrialIdx(0); setResults([]); trialStartRef.current = performance.now(); }}>
        <div className="stroop-word" style={{ color: COLOR_MAP[current.displayColor] ?? '#fff' }}>
          {current.word}
        </div>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
          Sélectionnez la COULEUR affichée
        </p>
        <div className="stroop-options">
          {Object.entries(COLOR_MAP).map(([name, hex]) => (
            <button
              key={name}
              className="stroop-option"
              style={{ color: hex }}
              onClick={() => handleSelect(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </ErrorBoundary>
    </div>
  );
}

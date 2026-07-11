/**
 * DemoGuard — NBackScreen (1-back matching test) — UX overhaul
 *
 * Phase 1: Intro screen with static visual example
 * Phase 2: 2 practice trials with explicit correct/incorrect feedback
 * Phase 3: Real test (8 trials) with single counter, permanent instruction,
 *          and discreet visual feedback (no answer reveal)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  NBACK_TRIALS,
  generateNBackTrials,
  evaluateNBackTrial,
  computeNBackResult,
  generateNBackPracticeTrials,
} from '../demoguard/cognitive/nBackChallenge';
import type { NBackSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { NBackTrialConfig, NBackTrialResult } from '../demoguard/cognitive/nBackChallenge';
import { recordTaskStart, recordNBackDecision } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';

type ScreenPhase = 'intro' | 'practice' | 'test';

type FeedbackState = 'none' | 'correct' | 'incorrect' | 'answered';

interface Props {
  session: BehaviorSession;
  onComplete: (signal: NBackSignal) => void;
  onError: (reason: string) => void;
}

export function NBackScreen({ session, onComplete }: Props) {
  const [phase, setPhase] = useState<ScreenPhase>('intro');
  const [trials, setTrials] = useState<NBackTrialConfig[]>([]);
  const [practiceTrials] = useState<NBackTrialConfig[]>(() => generateNBackPracticeTrials());
  const [trialIdx, setTrialIdx] = useState(0);
  const [results, setResults] = useState<NBackTrialResult[]>([]);
  const [showing, setShowing] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const trialStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    recordTaskStart(session, 'n_back');
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [session]);

  const showTrial = useCallback(() => {
    setShowing(true);
    setFeedback('none');
    trialStartRef.current = performance.now();
    timerRef.current = setTimeout(() => setShowing(false), 2000);
  }, []);

  const startPractice = () => {
    setPhase('practice');
    setTrialIdx(0);
    setResults([]);
    setTimeout(() => showTrial(), 100);
  };

  const startTest = () => {
    const newTrials = generateNBackTrials(NBACK_TRIALS);
    setTrials(newTrials);
    setPhase('test');
    setTrialIdx(0);
    setResults([]);
    setTimeout(() => showTrial(), 100);
  };

  const handleResponse = (saidMatch: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const currentTrials = phase === 'practice' ? practiceTrials : trials;
    const config = currentTrials[trialIdx];
    const responseMs = performance.now() - trialStartRef.current;
    const result = evaluateNBackTrial(config, saidMatch, responseMs);

    if (phase === 'practice') {
      const isCorrect = (config.isTarget && saidMatch) || (!config.isTarget && !saidMatch);
      setFeedback(isCorrect ? 'correct' : 'incorrect');
      const newResults = [...results, result];
      setResults(newResults);

      if (trialIdx + 1 >= practiceTrials.length) {
        setTimeout(() => startTest(), 1200);
      } else {
        setTrialIdx(trialIdx + 1);
        setTimeout(() => showTrial(), 1200);
      }
    } else {
      recordNBackDecision(session, result.isHit || result.isCorrectRejection, responseMs);
      setFeedback('answered');
      const newResults = [...results, result];
      setResults(newResults);

      if (trialIdx + 1 >= trials.length) {
        const signal = computeNBackResult(newResults);
        setTimeout(() => onComplete(signal), 400);
      } else {
        setTrialIdx(trialIdx + 1);
        setTimeout(() => showTrial(), 400);
      }
    }
  };

  // ── Intro Phase ──
  if (phase === 'intro') {
    return (
      <div className="screen">
        <PhaseHeader title="Comparaison (N-Back)" progress="5/7" progressPct={71} />
        <div className="nback-intro">
          <p className="nback-intro-title">
            Vous allez voir une suite de lettres.
          </p>
          <p className="nback-intro-subtitle">
            Dites si la lettre affichée est identique à la précédente.
          </p>

          <div className="nback-example">
            <div className="nback-example-row">
              <span className="nback-example-letter">C</span>
              <span className="nback-example-arrow">→</span>
              <span className="nback-example-letter">C</span>
              <span className="nback-example-badge nback-example-same">Identique → Oui</span>
            </div>
            <div className="nback-example-row">
              <span className="nback-example-letter">F</span>
              <span className="nback-example-arrow">→</span>
              <span className="nback-example-letter">B</span>
              <span className="nback-example-badge nback-example-diff">Différent → Non</span>
            </div>
          </div>

          <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>
            2 essais d'entraînement, puis le test réel.
          </p>

          <button className="btn" onClick={startPractice} style={{ width: '100%' }}>
            Commencer l'entraînement
          </button>
        </div>
      </div>
    );
  }

  // ── Practice / Test Phase ──
  const currentTrials = phase === 'practice' ? practiceTrials : trials;
  const totalTrials = currentTrials.length;
  const isPractice = phase === 'practice';

  return (
    <div className="screen">
      <PhaseHeader
        title={isPractice ? 'Comparaison — Entraînement' : 'Comparaison (N-Back)'}
        progress={`5/7 — ${trialIdx + 1}/${totalTrials}`}
        progressPct={71}
      />
      <ErrorBoundary onRetry={() => { setTrialIdx(0); setResults([]); showTrial(); }}>
        <div
          className="nback-letter"
          style={
            feedback === 'correct' ? { color: 'var(--success)' }
            : feedback === 'incorrect' ? { color: 'var(--danger)' }
            : undefined
          }
        >
          {showing ? currentTrials[trialIdx].letter : '—'}
        </div>

        {!showing && feedback === 'none' && (
          <>
            <p className="nback-instruction">
              Est-ce la même lettre qu'avant ?
            </p>
            <div className="nback-buttons">
              <button className="btn btn-secondary" onClick={() => handleResponse(false)}>Non</button>
              <button className="btn" onClick={() => handleResponse(true)}>Oui</button>
            </div>
          </>
        )}

        {showing && feedback === 'none' && (
          <p className="muted" style={{ textAlign: 'center', minHeight: 24 }}>&nbsp;</p>
        )}

        {feedback === 'correct' && (
          <p className="nback-feedback nback-feedback-correct">✓ Correct</p>
        )}
        {feedback === 'incorrect' && (
          <p className="nback-feedback nback-feedback-incorrect">
            {currentTrials[trialIdx].isTarget ? '✗ C"était identique' : '✗ C"était différent'}
          </p>
        )}
        {feedback === 'answered' && (
          <p className="nback-feedback nback-feedback-answered">✓</p>
        )}
      </ErrorBoundary>
    </div>
  );
}

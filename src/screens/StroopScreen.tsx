/**
 * DemoGuard — StroopScreen (color-word conflict test)
 *
 * UX refactored for public campaign: segmented progress, persistent
 * instruction card, immediate feedback (correct/incorrect + RT), and
 * selected-button outline — all purely presentational.
 *
 * CALIBRATION INVARIANTS (DO NOT CHANGE):
 *   - Line 46: trialStartRef.current = performance.now() (initial)
 *   - Line 51 (in handleSelect): responseMs = performance.now() - trialStartRef.current
 *   - The timestamp reset for the NEXT trial happens when that trial's
 *     stimulus becomes visible (after the 400ms feedback), NOT before.
 *     This keeps RT measurement identical to user behavior.
 *   - stroopChallenge.ts is untouched (trials, colors, thresholds).
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef } from 'react';
import {
  STROOP_TRIALS,
  generateStroopTrials,
  computeStroopResult,
  stroopColorWord,
  type StroopColor,
} from '../demoguard/cognitive/stroopChallenge';
import type { StroopSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { StroopTrialConfig, StroopTrialResult } from '../demoguard/cognitive/stroopChallenge';
import { recordTaskStart, recordStroopSelection } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nContext';

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab700',
};

const FEEDBACK_DURATION_MS = 400;

interface Props {
  session: BehaviorSession;
  onComplete: (signal: StroopSignal) => void;
  onError: (reason: string) => void;
}

type Feedback = { correct: boolean; ms: number; selectedColor: string } | null;

export function StroopScreen({ session, onComplete }: Props) {
  const { t, locale } = useI18n();
  const [trials] = useState<StroopTrialConfig[]>(() => generateStroopTrials(STROOP_TRIALS));
  const [trialIdx, setTrialIdx] = useState(0);
  const [results, setResults] = useState<StroopTrialResult[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const trialStartRef = useRef<number>(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    recordTaskStart(session, 'stroop');
    trialStartRef.current = performance.now();
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleSelect = (color: string) => {
    if (feedback) return; // ignore taps during feedback
    const config = trials[trialIdx];
    const responseMs = performance.now() - trialStartRef.current;
    const correct = color === config.displayColor;
    const result: StroopTrialResult = { config, selected: color as never, correct, response_ms: responseMs };
    recordStroopSelection(session, color, correct, responseMs, false);
    const newResults = [...results, result];
    setResults(newResults);

    // Show feedback AFTER measure + record (never before)
    setFeedback({ correct, ms: Math.round(responseMs), selectedColor: color });

    if (trialIdx + 1 >= trials.length) {
      // Last trial — complete after feedback display
      feedbackTimerRef.current = setTimeout(() => {
        const signal = computeStroopResult(newResults);
        onComplete(signal);
      }, FEEDBACK_DURATION_MS);
    } else {
      // Advance to next trial after feedback — reset timestamp HERE
      // so the next trial's RT starts when its stimulus is visible
      feedbackTimerRef.current = setTimeout(() => {
        setTrialIdx(trialIdx + 1);
        setFeedback(null);
        trialStartRef.current = performance.now();
      }, FEEDBACK_DURATION_MS);
    }
  };

  const current = trials[trialIdx];

  // Parse hint with |delimiters| for highlighted word
  const hintRaw = t('stroop.hint');
  const hintParts = hintRaw.split('|');

  return (
    <div className="screen">
      <PhaseHeader
        title={t('stroop.title')}
        progress={`3/7`}
        segments={{ current: trialIdx, total: trials.length }}
      />
      <ErrorBoundary onRetry={() => {
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        setTrialIdx(0);
        setResults([]);
        setFeedback(null);
        trialStartRef.current = performance.now();
      }}>
        {/* Persistent instruction card */}
        <div className="stroop-instruction-card">
          {hintParts.length === 3 ? (
            <>{hintParts[0]}<strong>{hintParts[1]}</strong>{hintParts[2]}</>
          ) : (
            hintRaw
          )}
        </div>

        <div className="stroop-word" style={{ color: COLOR_MAP[current.displayColor] ?? '#fff' }}>
          {stroopColorWord(current.word, locale)}
        </div>

        {/* Fixed-height feedback line (reserved even when empty) */}
        <div className="stroop-feedback-line">
          {feedback && (
            <span className={feedback.correct ? 'stroop-feedback-correct' : 'stroop-feedback-incorrect'}>
              {feedback.correct ? '✓' : '✗'} {feedback.correct ? t('stroop.feedback.correct') : t('stroop.feedback.incorrect')}
              <span className="stroop-feedback-ms">{feedback.ms} ms</span>
            </span>
          )}
        </div>

        <div className="stroop-options">
          {(Object.entries(COLOR_MAP) as [StroopColor, string][]).map(([name, hex]) => (
            <button
              key={name}
              className={`stroop-option stroop-option-campaign ${
                feedback?.selectedColor === name ? 'stroop-option-selected' : ''
              }`}
              style={{ color: hex }}
              onClick={() => handleSelect(name)}
              disabled={!!feedback}
            >
              {stroopColorWord(name, locale)}
            </button>
          ))}
        </div>
      </ErrorBoundary>
    </div>
  );
}

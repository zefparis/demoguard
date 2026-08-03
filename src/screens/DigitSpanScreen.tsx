/**
 * DemoGuard — DigitSpanScreen (memory sequence test) — campaign UX
 *
 * UX refactored: segmented progress, instruction card, immediate feedback
 * after submit (✓/✗ + expected sequence on error), keypad border-radius 10px.
 *
 * CALIBRATION INVARIANTS (DO NOT CHANGE):
 *   - digitSpanChallenge.ts untouched (trials=3, lengths 3→4→5, thresholds)
 *   - Duration = span * 800 + 500 ms (line 49) — unchanged
 *   - Inter-trial delay = 500ms (line 81) — feedback fits within this, not extended
 *   - recordDigitSpanSubmit called BEFORE any feedback display
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef } from 'react';
import {
  generateDigitSpanTrials,
  evaluateDigitSpanTrial,
  computeDigitSpanResult,
} from '../demoguard/cognitive/digitSpanChallenge';
import type { DigitSpanSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { DigitSpanTrialConfig, DigitSpanTrialResult } from '../demoguard/cognitive/digitSpanChallenge';
import { recordTaskStart, recordDigitSpanKey, recordDigitSpanSubmit } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  session: BehaviorSession;
  onComplete: (signal: DigitSpanSignal) => void;
  onError: (reason: string) => void;
}

type Feedback = { correct: boolean; expected: number[] } | null;

export function DigitSpanScreen({ session, onComplete }: Props) {
  const { t } = useI18n();
  const [trials] = useState<DigitSpanTrialConfig[]>(() => generateDigitSpanTrials());
  const [trialIdx, setTrialIdx] = useState(0);
  const [results, setResults] = useState<DigitSpanTrialResult[]>([]);
  const [showing, setShowing] = useState(true);
  const [input, setInput] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    recordTaskStart(session, 'digit_span');
    showSequence();
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, []);

  const showSequence = () => {
    setShowing(true);
    setInput([]);
    setFeedback(null);
    const span = trials[trialIdx].span;
    const duration = span * 800 + 500;
    showTimerRef.current = setTimeout(() => {
      setShowing(false);
    }, duration);
  };

  const handleDigit = (d: number) => {
    if (feedback) return;
    const newInput = [...input, d];
    setInput(newInput);
    recordDigitSpanKey(session, false);
  };

  const handleDelete = () => {
    if (feedback) return;
    if (input.length > 0) {
      setInput(input.slice(0, -1));
      recordDigitSpanKey(session, true);
    }
  };

  const handleSubmit = () => {
    if (feedback) return;
    const config = trials[trialIdx];
    const result = evaluateDigitSpanTrial(config, input);
    recordDigitSpanSubmit(session);
    const newResults = [...results, result];
    setResults(newResults);

    // Show feedback AFTER record (never before)
    setFeedback({ correct: result.correct, expected: config.sequence });

    if (trialIdx + 1 >= trials.length) {
      // Last trial — complete after the existing 500ms inter-trial delay
      setTimeout(() => {
        const signal = computeDigitSpanResult(newResults);
        onComplete(signal);
      }, 500);
    } else {
      // Advance after the existing 500ms inter-trial delay — not extended
      setTimeout(() => {
        setTrialIdx(trialIdx + 1);
        setInput([]);
        showSequence();
      }, 500);
    }
  };

  const current = trials[trialIdx];

  // Parse hint with |delimiters| for highlighted word
  const hintRaw = t('digitSpan.hint');
  const hintParts = hintRaw.split('|');

  return (
    <div className="screen">
      <PhaseHeader
        title={t('digitSpan.title')}
        progress={`4/7`}
        segments={{ current: trialIdx, total: trials.length }}
      />
      <ErrorBoundary onRetry={() => { setTrialIdx(0); setResults([]); setFeedback(null); showSequence(); }}>
        {/* Persistent instruction card */}
        <div className="camp-instruction-card">
          {hintParts.length === 3 ? (
            <>{hintParts[0]}<strong>{hintParts[1]}</strong>{hintParts[2]}</>
          ) : (
            hintRaw
          )}
        </div>

        {showing ? (
          <div className="screen-center">
            <p className="muted">{t('digitSpan.memorize')}</p>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8 }}>
              {current.sequence.join(' ')}
            </div>
          </div>
        ) : (
          <>
            <div className="screen-center" style={{ flex: '0 0 auto', padding: '16px 0' }}>
              <p className="muted">{t('digitSpan.enter')} ({current.span} {t('digitSpan.digits')}) :</p>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, minHeight: 40 }}>
                {input.join(' ') || '—'}
              </div>
            </div>

            {/* Fixed-height feedback line (reserved even when empty) */}
            <div className="camp-feedback-line">
              {feedback && (
                <span className={feedback.correct ? 'camp-feedback-correct' : 'camp-feedback-incorrect'}>
                  {feedback.correct ? '✓' : '✗'} {feedback.correct ? t('digitSpan.feedback.correct') : t('digitSpan.feedback.incorrect')}
                  {!feedback.correct && (
                    <span className="camp-feedback-detail">
                      {t('digitSpan.feedback.expected')} {feedback.expected.join(' ')}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="digit-span-input-pad-campaign">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button key={d} onClick={() => handleDigit(d)} disabled={!!feedback}>{d}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={handleDelete} disabled={!!feedback} style={{ flex: 1 }}>{t('digitSpan.delete')}</button>
              <button className="btn" onClick={handleSubmit} disabled={input.length === 0 || !!feedback} style={{ flex: 1 }}>{t('digitSpan.submit')}</button>
            </div>
          </>
        )}
      </ErrorBoundary>
    </div>
  );
}

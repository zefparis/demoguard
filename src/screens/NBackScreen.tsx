/**
 * DemoGuard — NBackScreen (1-back matching test) — campaign UX
 *
 * UX refactored: segmented progress (8 segments for test phase), intro
 * harmonized with campaign palette, test-phase feedback aligned on
 * Stroop pattern (✓/✗ + color) while preserving the existing 400ms delay.
 *
 * CALIBRATION INVARIANTS (DO NOT CHANGE):
 *   - nBackChallenge.ts untouched (NBACK_TRIALS=8, practice=2, target ratio 0.3)
 *   - trialStartRef.current = performance.now() (line 59) taken just before
 *     setTimeout(2000) — NO animation of letter entry (zone R4)
 *   - RT measure: performance.now() - trialStartRef.current (line 83) — before
 *     any feedback display
 *   - recordNBackDecision called before feedback in test phase
 *   - Practice feedback delay: 1200ms (unchanged)
 *   - Test feedback delay: 400ms (unchanged — not extended)
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
import { useI18n } from '../i18n/I18nContext';

type ScreenPhase = 'intro' | 'practice' | 'test';

type FeedbackState = 'none' | 'correct' | 'incorrect' | 'answered';

interface Props {
  session: BehaviorSession;
  onComplete: (signal: NBackSignal) => void;
  onError: (reason: string) => void;
}

export function NBackScreen({ session, onComplete }: Props) {
  const { t } = useI18n();
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
      // Aligned on Stroop pattern: ✓/✗ + color, preserving existing 400ms delay
      const isCorrect = (config.isTarget && saidMatch) || (!config.isTarget && !saidMatch);
      setFeedback(isCorrect ? 'correct' : 'incorrect');
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

  // ── Intro Phase (harmonized with campaign palette) ──
  if (phase === 'intro') {
    return (
      <div className="screen">
        <PhaseHeader title={t('nback.title')} progress="5/7" progressPct={71} />
        <div className="nback-intro-campaign">
          <p className="nback-intro-title-campaign">
            {t('nback.intro.youWillSee')}
          </p>
          <p className="nback-intro-subtitle-campaign">
            {t('nback.intro.subtitle')}
          </p>

          <div className="nback-example-campaign">
            <div className="nback-example-row-campaign">
              <span className="nback-example-letter-campaign">C</span>
              <span className="nback-example-arrow-campaign">→</span>
              <span className="nback-example-letter-campaign">C</span>
              <span className="nback-example-badge-campaign nback-example-same-campaign">{t('nback.intro.same')}</span>
            </div>
            <div className="nback-example-row-campaign">
              <span className="nback-example-letter-campaign">F</span>
              <span className="nback-example-arrow-campaign">→</span>
              <span className="nback-example-letter-campaign">B</span>
              <span className="nback-example-badge-campaign nback-example-diff-campaign">{t('nback.intro.different')}</span>
            </div>
          </div>

          <p className="muted" style={{ textAlign: 'center', marginBottom: 16 }}>
            {t('nback.intro.practiceInfo')}
          </p>

          <button className="btn" onClick={startPractice} style={{ width: '100%' }}>
            {t('nback.intro.start')}
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
        title={isPractice ? t('nback.training') : t('nback.title')}
        progress={`5/7`}
        segments={isPractice ? undefined : { current: trialIdx, total: totalTrials }}
        progressPct={isPractice ? 71 : undefined}
      />
      <ErrorBoundary onRetry={() => { setTrialIdx(0); setResults([]); showTrial(); }}>
        <div
          className="nback-letter"
          style={
            feedback === 'correct' ? { color: 'var(--camp-cyan)' }
            : feedback === 'incorrect' ? { color: 'var(--danger)' }
            : undefined
          }
        >
          {showing ? currentTrials[trialIdx].letter : '—'}
        </div>

        {!showing && feedback === 'none' && trialIdx === 0 && (
          <>
            <p className="nback-instruction-campaign">
              {t('nback.firstTrialHint')}
            </p>
            <div className="nback-buttons">
              <button
                className="btn"
                onClick={() => {
                  setTrialIdx(1);
                  showTrial();
                }}
              >
                {t('nback.firstTrialContinue')}
              </button>
            </div>
          </>
        )}

        {!showing && feedback === 'none' && trialIdx > 0 && (
          <>
            <p className="nback-instruction-campaign">
              {t('nback.instruction')}
            </p>
            <div className="nback-buttons">
              <button className="btn btn-secondary" onClick={() => handleResponse(false)}>{t('nback.no')}</button>
              <button className="btn" onClick={() => handleResponse(true)}>{t('nback.yes')}</button>
            </div>
          </>
        )}

        {showing && feedback === 'none' && (
          <p className="muted" style={{ textAlign: 'center', minHeight: 24 }}>&nbsp;</p>
        )}

        {feedback === 'correct' && (
          <p className="nback-feedback-campaign nback-feedback-correct-campaign">
            ✓ {isPractice ? t('nback.correct') : t('nback.feedback.correct')}
          </p>
        )}
        {feedback === 'incorrect' && (
          <p className="nback-feedback-campaign nback-feedback-incorrect-campaign">
            {isPractice
              ? (currentTrials[trialIdx].isTarget ? t('nback.wasSame') : t('nback.wasDifferent'))
              : `✗ ${t('nback.feedback.incorrect')}`
            }
          </p>
        )}
        {feedback === 'answered' && (
          <p className="nback-feedback-campaign nback-feedback-answered-campaign">✓</p>
        )}
      </ErrorBoundary>
    </div>
  );
}

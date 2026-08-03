/**
 * DemoGuard — ReflexScreen (5-round reaction time test) — campaign UX
 *
 * UX refactored: segmented progress (5 segments), instruction card,
 * enriched feedback (ms + contextual qualifier). Calibration untouched.
 *
 * CALIBRATION INVARIANTS (DO NOT CHANGE):
 *   - reflexChallenge.ts untouched (REFLEX_ROUNDS=5, delays 700-2200ms,
 *     REFLEX_TOO_FAST_MS=120, REFLEX_TOO_SLOW_MS=1800)
 *   - goTimeRef.current = performance.now() stays INSIDE the setTimeout
 *     callback (zone R1) — never moved or conditioned to an animation
 *   - RT measure: performance.now() - goTimeRef.current (line 70) — before
 *     any feedback display
 *   - recordReflexTap called before feedback
 *   - Qualifier thresholds below are PURELY PRESENTATIONAL and have NO
 *     relation to REFLEX_TOO_FAST_MS / REFLEX_TOO_SLOW_MS
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef } from 'react';
import {
  REFLEX_ROUNDS,
  getRandomReflexDelay,
  evaluateReflexRound,
  computeReflexResult,
} from '../demoguard/cognitive/reflexChallenge';
import type { ReflexSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { ReflexRoundResult } from '../demoguard/cognitive/reflexChallenge';
import { recordTaskStart, recordReflexTap } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nContext';

// ─── PRESENTATIONAL qualifier thresholds ─────────────────────────────
// These have NO relation to REFLEX_TOO_FAST_MS (120) or REFLEX_TOO_SLOW_MS
// (1800) in reflexChallenge.ts. They are purely for display feedback and
// do NOT influence any measurement, quality assessment, or scoring.
const PRESENTATIONAL_FAST_MS = 300;
const PRESENTATIONAL_GOOD_MS = 500;

interface Props {
  session: BehaviorSession;
  onComplete: (signal: ReflexSignal) => void;
  onError: (reason: string) => void;
}

type State = 'waiting' | 'ready' | 'go' | 'too-early' | 'done';

export function ReflexScreen({ session, onComplete }: Props) {
  const { t } = useI18n();
  const [round, setRound] = useState(0);
  const [state, setState] = useState<State>('waiting');
  const [results, setResults] = useState<ReflexRoundResult[]>([]);
  const goTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    recordTaskStart(session, 'reflex');
    startRound();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const startRound = () => {
    if (round >= REFLEX_ROUNDS) {
      const signal = computeReflexResult(results);
      onComplete(signal);
      return;
    }
    setState('waiting');
    const delay = getRandomReflexDelay();
    timeoutRef.current = setTimeout(() => {
      goTimeRef.current = performance.now();
      setState('go');
    }, delay);
  };

  const handleTap = () => {
    if (state === 'waiting') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setState('too-early');
      recordReflexTap(session, 0, true);
      setTimeout(() => startRound(), 1000);
      return;
    }
    if (state === 'go') {
      const ms = performance.now() - goTimeRef.current;
      const result = evaluateReflexRound(ms);
      recordReflexTap(session, ms, result.too_fast);
      const newResults = [...results, result];
      setResults(newResults);
      setRound(round + 1);
      setState('done');
      setTimeout(() => {
        if (round + 1 >= REFLEX_ROUNDS) {
          const signal = computeReflexResult(newResults);
          onComplete(signal);
        } else {
          startRound();
        }
      }, 500);
    }
  };

  const areaClass = state === 'go' ? 'reflex-area go' : state === 'too-early' ? 'reflex-area too-early' : 'reflex-area ready';

  // Presentational qualifier — purely display, no calibration link
  const lastMs = results[results.length - 1]?.ms ?? 0;
  const qualifierKey = lastMs < PRESENTATIONAL_FAST_MS
    ? 'reflex.feedback.fast'
    : lastMs < PRESENTATIONAL_GOOD_MS
    ? 'reflex.feedback.good'
    : 'reflex.feedback.ok';

  // Parse hint with |delimiters| for highlighted word
  const hintRaw = t('reflex.hint');
  const hintParts = hintRaw.split('|');

  return (
    <div className="screen">
      <PhaseHeader
        title={t('reflex.title')}
        progress={`2/7`}
        segments={{ current: round, total: REFLEX_ROUNDS }}
      />
      <ErrorBoundary onRetry={() => { setRound(0); setResults([]); startRound(); }}>
        {/* Persistent instruction card */}
        <div className="camp-instruction-card">
          {hintParts.length === 3 ? (
            <>{hintParts[0]}<strong>{hintParts[1]}</strong>{hintParts[2]}</>
          ) : (
            hintRaw
          )}
        </div>

        <div className={areaClass} onClick={handleTap}>
          {state === 'waiting' && <p>{t('reflex.waitGreen')}</p>}
          {state === 'go' && <p style={{ fontSize: 24, fontWeight: 700 }}>{t('reflex.tap')}</p>}
          {state === 'too-early' && <p>{t('reflex.tooEarly')}</p>}
          {state === 'done' && (
            <>
              <p>{Math.round(lastMs)} {t('reflex.ms')}</p>
              <p className="reflex-feedback-qualifier" style={{ color: 'var(--camp-cyan)' }}>
                {t(qualifierKey)}
              </p>
            </>
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}

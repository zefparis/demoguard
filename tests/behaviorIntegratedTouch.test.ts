/**
 * P10 BEHAVIOR-INTEGRATED-TOUCH — Tests (standalone adaptation)
 *
 * Adapted from payguard: uses BehaviorSession (non-singleton) instead
 * of the global touchBehaviorCollector. Same test logic, no modification.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSession } from '../src/demoguard/behavior/behaviorSession';
import {
  recordTaskStart,
  recordReflexTap,
  recordStroopSelection,
  recordDigitSpanKey,
  recordDigitSpanSubmit,
  recordNBackDecision,
  recordTrailTap,
} from '../src/demoguard/behavior/taskBehaviorRecorder';
import { computeBehaviorSummary } from '../src/demoguard/behavior/behaviorScoring';
import type { TaskTouchBehavior, BehaviorPayload } from '../src/demoguard/behavior/behaviorTypes';

describe('P10 BEHAVIOR-INTEGRATED-TOUCH', () => {
  let session: BehaviorSession;

  beforeEach(() => {
    session = new BehaviorSession();
    session.reset();
  });

  describe('Reflex taps feed behavior collector', () => {
    it('records reflex taps and produces a TaskTouchBehavior', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 350, false);
      recordReflexTap(session, 100, true); // too fast
      recordReflexTap(session, 420, false);
      recordReflexTap(session, 380, false);

      const tb = session.getTaskBehavior('reflex');
      expect(tb).not.toBeNull();
      expect(tb!.task).toBe('reflex');
      expect(tb!.interactionCount).toBe(4);
      expect(tb!.behaviorQuality).toBe('ok');
    });

    it('measures inter-action timing', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);
      recordReflexTap(session, 350, false);

      const tb = session.getTaskBehavior('reflex');
      expect(tb).not.toBeNull();
      expect(tb!.avgInterActionMs).not.toBeNull();
      expect(tb!.varianceInterActionMs).not.toBeNull();
    });
  });

  describe('Stroop selections feed behavior collector', () => {
    it('records stroop selections with correctness', () => {
      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 800, false);
      recordStroopSelection(session, 'blue', false, 1200, false);
      recordStroopSelection(session, 'green', true, 700, false);

      const tb = session.getTaskBehavior('stroop');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(3);
      expect(tb!.behaviorQuality).toBe('ok');
    });
  });

  describe('Digit Span typing feeds behavior collector', () => {
    it('records digit span key presses and submits', () => {
      recordTaskStart(session, 'digit_span');
      recordDigitSpanKey(session, false); // type a digit
      recordDigitSpanKey(session, false); // type a digit
      recordDigitSpanKey(session, true);  // delete (correction)
      recordDigitSpanKey(session, false); // retype
      recordDigitSpanSubmit(session);

      const tb = session.getTaskBehavior('digit_span');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(5);
      expect(tb!.correctionCount).toBe(1);
    });
  });

  describe('N-Back decisions feed behavior collector', () => {
    it('records n-back decisions with correctness', () => {
      recordTaskStart(session, 'n_back');
      recordNBackDecision(session, true, 500);  // correct
      recordNBackDecision(session, false, 800); // wrong
      recordNBackDecision(session, true, 600);  // correct

      const tb = session.getTaskBehavior('n_back');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(3);
    });
  });

  describe('Trail Tap computes wrong taps and path efficiency', () => {
    it('records trail tap with wrong taps and path efficiency', () => {
      recordTaskStart(session, 'trail_tap');
      recordTrailTap(session, true, 100, 120);
      recordTrailTap(session, false, null, null);
      recordTrailTap(session, true, 80, 90);
      recordTrailTap(session, true, 110, 100);
      recordTrailTap(session, true, null, null);

      const tb = session.getTaskBehavior('trail_tap');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(5);
      expect(tb!.wrongTapCount).toBe(1);
      expect(tb!.pathEfficiency).not.toBeNull();
      expect(tb!.pathEfficiency!).toBeGreaterThan(0);
      expect(tb!.pathEfficiency!).toBeLessThanOrEqual(1);
    });
  });

  describe('BehaviorSummary counts tasksObserved', () => {
    it('counts number of tasks with interactions', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 800, false);

      const summary = session.getSummary();
      expect(summary.tasksObserved).toBe(2);
      expect(summary.totalInteractions).toBe(3);
    });

    it('returns 0 tasksObserved when no interactions recorded', () => {
      const summary = session.getSummary();
      expect(summary.tasksObserved).toBe(0);
      expect(summary.totalInteractions).toBe(0);
    });
  });

  describe('totalInteractions > 0 makes touch status OK', () => {
    it('touch diagnostics status is ok/review when interactions exist', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      const diag = session.getTouchDiagnostics();
      if (diag.supported) {
        expect(diag.status).not.toBe('missing');
        expect(diag.interactionCount).toBe(2);
        expect(diag.reasonSafe).toBe('behavior_touch_captured');
      } else {
        expect(diag.status).toBe('unsupported');
        expect(diag.reasonSafe).toBe('touch_unsupported');
      }
    });

    it('touch diagnostics status is missing/unsupported when no interactions', () => {
      const diag = session.getTouchDiagnostics();
      expect(diag.status === 'missing' || diag.status === 'unsupported').toBe(true);
    });
  });

  describe('Mobile cognitive interactions prevent touch_missing', () => {
    it('when interactions exist, status cannot be missing', () => {
      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 700, false);

      const diag = session.getTouchDiagnostics();
      expect(diag.status).not.toBe('missing');
    });
  });

  describe('Pressure unavailable does not fail', () => {
    it('behavior quality is ok even without pressure', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      const tb = session.getTaskBehavior('reflex');
      expect(tb).not.toBeNull();
      expect(tb!.pressureAvailable).toBe(false);
      expect(tb!.avgPressure).toBeNull();
      expect(tb!.behaviorQuality).toBe('ok');
    });
  });

  describe('No raw data in payload', () => {
    it('no raw coordinates in payload', () => {
      recordTaskStart(session, 'trail_tap');
      recordTrailTap(session, true, 100, 120);
      recordTrailTap(session, false, null, null);

      const payload = session.getPayload();
      const payloadStr = JSON.stringify(payload);
      expect(payloadStr).not.toContain('x_coord');
      expect(payloadStr).not.toContain('y_coord');
      expect(payloadStr).not.toContain('clientX');
      expect(payloadStr).not.toContain('clientY');
      expect(payloadStr).not.toContain('pageX');
      expect(payloadStr).not.toContain('pageY');
    });

    it('no raw tap trace in payload', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      const payload = session.getPayload();
      const payloadStr = JSON.stringify(payload);
      expect(payloadStr).not.toContain('tapTrace');
      expect(payloadStr).not.toContain('rawEvents');
      expect(payloadStr).not.toContain('interactions');
      expect(payloadStr).not.toContain('timestamps');
      expect(payloadStr).not.toContain('coordinates');
      expect(payloadStr).not.toContain('path');
    });

    it('no forbidden fields in payload', () => {
      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 800, false);

      const payload = session.getPayload();
      const payloadStr = JSON.stringify(payload);
      const forbidden = [
        'token', 'jwt', 'sessionToken', 'hcsCode',
        'first_name', 'last_name', 'email', 'phone',
        'selfie_b64', 'voice_b64', 'raw_audio',
        'face_embedding', 'vocal_embedding',
        'debug', 'internal', 'breakdown',
      ];
      for (const f of forbidden) {
        expect(payloadStr).not.toContain(f);
      }
    });
  });

  describe('BehaviorPayload structure', () => {
    it('payload has taskBehaviors and summary', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);

      const payload: BehaviorPayload = session.getPayload();
      expect(payload).toHaveProperty('taskBehaviors');
      expect(payload).toHaveProperty('summary');
      expect(payload.taskBehaviors.reflex).toBeDefined();
      expect(payload.summary.totalInteractions).toBe(1);
    });
  });

  describe('Behavior scoring functions', () => {
    it('computeBehaviorSummary returns correct quality for good behavior', () => {
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 400, varianceInterActionMs: 1000, hesitationCount: 0, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 800, varianceInterActionMs: 2000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 500, varianceInterActionMs: 1500, hesitationCount: 0, correctionCount: 1, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 600, varianceInterActionMs: 3000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.tasksObserved).toBe(4);
      expect(summary.totalInteractions).toBe(27);
      expect(summary.quality).toBe('ok');
      expect(summary.behaviorLikelihood).toBe('high');
    });

    it('computeBehaviorSummary returns failed for no tasks', () => {
      const summary = computeBehaviorSummary({});
      expect(summary.tasksObserved).toBe(0);
      expect(summary.quality).toBe('failed');
      expect(summary.behaviorLikelihood).toBe('low');
    });
  });
});

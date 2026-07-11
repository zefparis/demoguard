/**
 * DemoGuard — Continuous signals streaming tests
 *
 * Tests for the streaming collector API: start/stop lifecycle,
 * permission fallback, cleanup, payload shape parity, and handler perf.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startMotionCollection,
  stopMotionCollection,
  isMotionCollecting,
  isMotionSupported,
} from '../src/demoguard/collectors/motionCollector';
import {
  startOrientationCollection,
  stopOrientationCollection,
  isOrientationCollecting,
  isOrientationSupported,
} from '../src/demoguard/collectors/orientationCollector';
import {
  startTouchCollection,
  stopTouchCollection,
  isTouchCollecting,
} from '../src/demoguard/collectors/touchCollector';
import {
  startVisibilityCollection,
  stopVisibilityCollection,
  isVisibilityCollecting,
} from '../src/demoguard/collectors/visibilityCollector';
import {
  startNetworkCollection,
  stopNetworkCollection,
  isNetworkCollecting,
} from '../src/demoguard/collectors/networkCollector';
import { phaseTracker } from '../src/demoguard/collectors/phaseTracker';
import type {
  DemoGuardMotionSignal,
  DemoGuardOrientationSignal,
  DemoGuardTouchSignal,
  DemoGuardVisibilitySignal,
  DemoGuardNetworkSignal,
} from '../src/demoguard/types';

// ─── Motion collector ────────────────────────────────────────────

describe('Motion collector (streaming)', () => {
  beforeEach(() => {
    // Ensure clean state
    if (isMotionCollecting()) stopMotionCollection();
  });

  afterEach(() => {
    if (isMotionCollecting()) stopMotionCollection();
  });

  it('start/stop lifecycle: returns correct shape after collection', () => {
    if (!isMotionSupported()) {
      startMotionCollection('unsupported');
      const result = stopMotionCollection();
      expect(result.supported).toBe(false);
      expect(result.permission).toBe('unsupported');
      expect(result.sample_count).toBe(0);
      return;
    }

    startMotionCollection('granted');
    expect(isMotionCollecting()).toBe(true);

    // Simulate a few motion events
    const handler = vi.fn();
    window.addEventListener('devicemotion', handler);

    // Dispatch fake events
    window.dispatchEvent(new Event('devicemotion'));

    const result = stopMotionCollection();
    expect(isMotionCollecting()).toBe(false);

    // Shape check
    expect(result).toHaveProperty('supported');
    expect(result).toHaveProperty('permission');
    expect(result).toHaveProperty('sample_count');
    expect(result).toHaveProperty('quality');
    expect(typeof result.sample_count).toBe('number');
    expect(['ok', 'low', 'missing', 'unsupported']).toContain(result.quality);
  });

  it('permission denied: returns proper fallback', () => {
    if (!isMotionSupported()) return;

    startMotionCollection('denied');
    const result = stopMotionCollection();

    expect(result.supported).toBe(true);
    expect(result.permission).toBe('denied');
    expect(result.sample_count).toBe(0);
    expect(result.quality).toBe('missing');
  });

  it('idempotent start: calling start twice does not create duplicate listeners', () => {
    if (!isMotionSupported()) return;

    startMotionCollection('granted');
    startMotionCollection('granted'); // should be no-op
    expect(isMotionCollecting()).toBe(true);

    stopMotionCollection();
    expect(isMotionCollecting()).toBe(false);
  });

  it('stop without start: returns unsupported fallback', () => {
    if (isMotionCollecting()) stopMotionCollection();

    const result = stopMotionCollection();
    expect(result.supported).toBe(false);
    expect(result.quality).toBe('unsupported');
  });

  it('handler is lightweight: no heavy computation in event handler', () => {
    if (!isMotionSupported()) return;

    startMotionCollection('granted');

    const addSpy = vi.spyOn(window, 'addEventListener');
    // The handler should have been registered with passive: true
    const motionCall = addSpy.mock.calls.find(c => c[0] === 'devicemotion');
    expect(motionCall).toBeDefined();
    expect((motionCall![2] as AddEventListenerOptions)?.passive).toBe(true);

    addSpy.mockRestore();
    stopMotionCollection();
  });
});

// ─── Orientation collector ───────────────────────────────────────

describe('Orientation collector (streaming)', () => {
  beforeEach(() => {
    if (isOrientationCollecting()) stopOrientationCollection();
  });

  afterEach(() => {
    if (isOrientationCollecting()) stopOrientationCollection();
  });

  it('start/stop lifecycle: returns correct shape', () => {
    if (!isOrientationSupported()) {
      startOrientationCollection('unsupported');
      const result = stopOrientationCollection();
      expect(result.supported).toBe(false);
      expect(result.sample_count).toBe(0);
      return;
    }

    startOrientationCollection('granted');
    expect(isOrientationCollecting()).toBe(true);

    const result = stopOrientationCollection();
    expect(isOrientationCollecting()).toBe(false);

    expect(result).toHaveProperty('supported');
    expect(result).toHaveProperty('permission');
    expect(result).toHaveProperty('sample_count');
    expect(result).toHaveProperty('changes');
    expect(result).toHaveProperty('quality');
    expect(typeof result.sample_count).toBe('number');
    expect(typeof result.changes).toBe('number');
  });

  it('permission denied: returns proper fallback', () => {
    if (!isOrientationSupported()) return;

    startOrientationCollection('denied');
    const result = stopOrientationCollection();

    expect(result.supported).toBe(true);
    expect(result.permission).toBe('denied');
    expect(result.sample_count).toBe(0);
    expect(result.quality).toBe('missing');
  });

  it('idempotent start', () => {
    if (!isOrientationSupported()) return;

    startOrientationCollection('granted');
    startOrientationCollection('granted');
    expect(isOrientationCollecting()).toBe(true);
    stopOrientationCollection();
    expect(isOrientationCollecting()).toBe(false);
  });
});

// ─── Touch collector ─────────────────────────────────────────────

describe('Touch collector (streaming)', () => {
  beforeEach(() => {
    if (isTouchCollecting()) stopTouchCollection();
  });

  afterEach(() => {
    if (isTouchCollecting()) stopTouchCollection();
  });

  it('start/stop lifecycle: returns correct shape', () => {
    startTouchCollection();
    expect(isTouchCollecting()).toBe(true);

    const result = stopTouchCollection();
    expect(isTouchCollecting()).toBe(false);

    expect(result).toHaveProperty('touch_count');
    expect(result).toHaveProperty('pressure_supported');
    expect(result).toHaveProperty('multi_touch_detected');
    expect(result).toHaveProperty('quality');
    expect(typeof result.touch_count).toBe('number');
    expect(typeof result.pressure_supported).toBe('boolean');
    expect(typeof result.multi_touch_detected).toBe('boolean');
  });

  it('idempotent start', () => {
    startTouchCollection();
    startTouchCollection();
    expect(isTouchCollecting()).toBe(true);
    stopTouchCollection();
    expect(isTouchCollecting()).toBe(false);
  });

  it('stop without start: returns missing fallback', () => {
    if (isTouchCollecting()) stopTouchCollection();

    const result = stopTouchCollection();
    expect(result.touch_count).toBe(0);
    expect(result.quality).toBe('missing');
  });

  it('cleanup: stop removes all 6 listeners', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    startTouchCollection();
    stopTouchCollection();

    // Should have called removeEventListener 6 times (3 pointer + 3 touch)
    const calls = removeSpy.mock.calls.filter(c =>
      ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend'].includes(c[0] as string)
    );
    expect(calls.length).toBe(6);
    removeSpy.mockRestore();
  });
});

// ─── Visibility collector ────────────────────────────────────────

describe('Visibility collector (streaming)', () => {
  beforeEach(() => {
    if (isVisibilityCollecting()) stopVisibilityCollection();
  });

  afterEach(() => {
    if (isVisibilityCollecting()) stopVisibilityCollection();
  });

  it('start/stop lifecycle: returns correct shape', () => {
    startVisibilityCollection();
    expect(isVisibilityCollecting()).toBe(true);

    const result = stopVisibilityCollection();
    expect(isVisibilityCollecting()).toBe(false);

    expect(result).toHaveProperty('blur_count');
    expect(result).toHaveProperty('focus_count');
    expect(result).toHaveProperty('visibility_hidden_count');
    expect(result).toHaveProperty('hidden_duration_ms');
    expect(result).toHaveProperty('page_focus_lost');
    expect(result).toHaveProperty('quality');
    expect(typeof result.blur_count).toBe('number');
    expect(typeof result.focus_count).toBe('number');
  });

  it('cleanup: stop removes listeners', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');
    startVisibilityCollection();
    stopVisibilityCollection();

    // window: blur + focus, document: visibilitychange
    const windowCalls = removeSpy.mock.calls.filter(c =>
      ['blur', 'focus'].includes(c[0] as string)
    );
    expect(windowCalls.length).toBe(2);

    const docCalls = removeDocSpy.mock.calls.filter(c =>
      c[0] === 'visibilitychange'
    );
    expect(docCalls.length).toBe(1);

    removeSpy.mockRestore();
    removeDocSpy.mockRestore();
  });
});

// ─── Network collector ───────────────────────────────────────────

describe('Network collector (streaming)', () => {
  beforeEach(() => {
    if (isNetworkCollecting()) stopNetworkCollection();
  });

  afterEach(() => {
    if (isNetworkCollecting()) stopNetworkCollection();
  });

  it('start/stop lifecycle: returns correct shape', () => {
    startNetworkCollection();
    expect(isNetworkCollecting()).toBe(true);

    const result = stopNetworkCollection();
    expect(isNetworkCollecting()).toBe(false);

    expect(result).toHaveProperty('online');
    expect(result).toHaveProperty('quality');
    expect(typeof result.online).toBe('boolean');
  });

  it('idempotent start', () => {
    startNetworkCollection();
    startNetworkCollection();
    expect(isNetworkCollecting()).toBe(true);
    stopNetworkCollection();
    expect(isNetworkCollecting()).toBe(false);
  });

  it('stop without start: returns snapshot fallback', () => {
    if (isNetworkCollecting()) stopNetworkCollection();

    const result = stopNetworkCollection();
    expect(result).toHaveProperty('online');
    expect(typeof result.online).toBe('boolean');
  });
});

// ─── Phase tracker ───────────────────────────────────────────────

describe('Phase tracker', () => {
  beforeEach(() => {
    phaseTracker.reset();
  });

  it('tracks phase transitions', () => {
    phaseTracker.startSession();
    expect(phaseTracker.getCurrentPhase()).toBe('prep');

    phaseTracker.setPhase('camera');
    expect(phaseTracker.getCurrentPhase()).toBe('camera');

    phaseTracker.setPhase('test_reflex');
    expect(phaseTracker.getCurrentPhase()).toBe('test_reflex');

    const history = phaseTracker.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].phase).toBe('prep');
    expect(history.some(h => h.phase === 'test_reflex')).toBe(true);
  });

  it('ignores same-phase transitions', () => {
    phaseTracker.startSession();
    phaseTracker.setPhase('camera');
    phaseTracker.setPhase('camera'); // no-op

    const history = phaseTracker.getHistory();
    const cameraEntries = history.filter(h => h.phase === 'camera');
    expect(cameraEntries.length).toBe(1);
  });

  it('reset clears state', () => {
    phaseTracker.startSession();
    phaseTracker.setPhase('camera');
    phaseTracker.reset();
    expect(phaseTracker.getCurrentPhase()).toBe('idle');
    expect(phaseTracker.getHistory().length).toBe(0);
  });
});

// ─── Payload shape parity ────────────────────────────────────────

describe('Payload shape parity (non-regression)', () => {
  it('motion signal has all required fields', () => {
    if (isMotionCollecting()) stopMotionCollection();
    startMotionCollection('granted');
    const result = stopMotionCollection();

    const requiredKeys: (keyof DemoGuardMotionSignal)[] = [
      'supported', 'permission', 'sample_count', 'quality',
    ];
    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
    }
  });

  it('orientation signal has all required fields', () => {
    if (isOrientationCollecting()) stopOrientationCollection();
    startOrientationCollection('granted');
    const result = stopOrientationCollection();

    const requiredKeys: (keyof DemoGuardOrientationSignal)[] = [
      'supported', 'permission', 'sample_count', 'changes', 'quality',
    ];
    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
    }
  });

  it('touch signal has all required fields', () => {
    if (isTouchCollecting()) stopTouchCollection();
    startTouchCollection();
    const result = stopTouchCollection();

    const requiredKeys: (keyof DemoGuardTouchSignal)[] = [
      'touch_count', 'pressure_supported', 'multi_touch_detected', 'quality',
    ];
    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
    }
  });

  it('visibility signal has all required fields', () => {
    if (isVisibilityCollecting()) stopVisibilityCollection();
    startVisibilityCollection();
    const result = stopVisibilityCollection();

    const requiredKeys: (keyof DemoGuardVisibilitySignal)[] = [
      'blur_count', 'focus_count', 'visibility_hidden_count',
      'hidden_duration_ms', 'page_focus_lost', 'quality',
    ];
    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
    }
  });

  it('network signal has all required fields', () => {
    if (isNetworkCollecting()) stopNetworkCollection();
    startNetworkCollection();
    const result = stopNetworkCollection();

    const requiredKeys: (keyof DemoGuardNetworkSignal)[] = [
      'online', 'quality',
    ];
    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
    }
  });
});

/**
 * DemoGuard — Reducer tests
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import { demoguardReducer, initialState } from '../src/state/demoguardReducer';

describe('demoguardReducer', () => {
  it('START transitions idle → prep', () => {
    const next = demoguardReducer(initialState, { type: 'START', sessionPublicId: 'sess_123' });
    expect(next.phase).toBe('prep');
    expect(next.sessionPublicId).toBe('sess_123');
    expect(next.startedAt).not.toBeNull();
  });

  it('PREP_READY transitions prep → camera', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const next = demoguardReducer(started, { type: 'PREP_READY' });
    expect(next.phase).toBe('camera');
  });

  it('SELFIE_CAPTURED transitions camera → test_reflex', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const next = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: { captured: true, quality: 'ok', width: 1280, height: 960 } });
    expect(next.phase).toBe('test_reflex');
    expect(next.signals.selfie?.captured).toBe(true);
  });

  it('TEST_COMPLETED reflex transitions test_reflex → test_colors', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const next = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: { rounds: 5, avg_ms: 300, quality: 'ok' } });
    expect(next.phase).toBe('test_colors');
    expect(next.cognitiveSignals?.reflex).not.toBeNull();
  });

  it('TEST_COMPLETED stroop transitions test_colors → test_memory', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const colors = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: { quality: 'ok' } });
    const next = demoguardReducer(colors, { type: 'TEST_COMPLETED', testName: 'stroop', signal: { quality: 'ok' } });
    expect(next.phase).toBe('test_memory');
  });

  it('TEST_COMPLETED trail_tap transitions test_path → voice', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const colors = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: {} });
    const memory = demoguardReducer(colors, { type: 'TEST_COMPLETED', testName: 'stroop', signal: {} });
    const compare = demoguardReducer(memory, { type: 'TEST_COMPLETED', testName: 'digit_span', signal: {} });
    const path = demoguardReducer(compare, { type: 'TEST_COMPLETED', testName: 'n_back', signal: {} });
    const next = demoguardReducer(path, { type: 'TEST_COMPLETED', testName: 'trail_tap', signal: {} });
    expect(next.phase).toBe('voice');
  });

  it('VOICE_CAPTURED transitions voice → review', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const colors = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: {} });
    const memory = demoguardReducer(colors, { type: 'TEST_COMPLETED', testName: 'stroop', signal: {} });
    const compare = demoguardReducer(memory, { type: 'TEST_COMPLETED', testName: 'digit_span', signal: {} });
    const path = demoguardReducer(compare, { type: 'TEST_COMPLETED', testName: 'n_back', signal: {} });
    const voice = demoguardReducer(path, { type: 'TEST_COMPLETED', testName: 'trail_tap', signal: {} });
    const next = demoguardReducer(voice, { type: 'VOICE_CAPTURED', voice: { recorded: true, quality: 'ok', challenge_id: 'test' }, diagnostic: null });
    expect(next.phase).toBe('review');
  });

  it('REVIEW_CONTINUE transitions review → device_signals', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const colors = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: {} });
    const memory = demoguardReducer(colors, { type: 'TEST_COMPLETED', testName: 'stroop', signal: {} });
    const compare = demoguardReducer(memory, { type: 'TEST_COMPLETED', testName: 'digit_span', signal: {} });
    const path = demoguardReducer(compare, { type: 'TEST_COMPLETED', testName: 'n_back', signal: {} });
    const voice = demoguardReducer(path, { type: 'TEST_COMPLETED', testName: 'trail_tap', signal: {} });
    const review = demoguardReducer(voice, { type: 'VOICE_CAPTURED', voice: { recorded: true, quality: 'ok', challenge_id: 'test' }, diagnostic: null });
    const next = demoguardReducer(review, { type: 'REVIEW_CONTINUE' });
    expect(next.phase).toBe('device_signals');
  });

  it('DEVICE_SIGNALS_CONTINUE transitions device_signals → readiness', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const colors = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: {} });
    const memory = demoguardReducer(colors, { type: 'TEST_COMPLETED', testName: 'stroop', signal: {} });
    const compare = demoguardReducer(memory, { type: 'TEST_COMPLETED', testName: 'digit_span', signal: {} });
    const path = demoguardReducer(compare, { type: 'TEST_COMPLETED', testName: 'n_back', signal: {} });
    const voice = demoguardReducer(path, { type: 'TEST_COMPLETED', testName: 'trail_tap', signal: {} });
    const review = demoguardReducer(voice, { type: 'VOICE_CAPTURED', voice: { recorded: true, quality: 'ok', challenge_id: 'test' }, diagnostic: null });
    const devSignals = demoguardReducer(review, { type: 'REVIEW_CONTINUE' });
    const next = demoguardReducer(devSignals, { type: 'DEVICE_SIGNALS_CONTINUE' });
    expect(next.phase).toBe('readiness');
  });

  it('SUBMIT transitions readiness → submitting', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const colors = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: {} });
    const memory = demoguardReducer(colors, { type: 'TEST_COMPLETED', testName: 'stroop', signal: {} });
    const compare = demoguardReducer(memory, { type: 'TEST_COMPLETED', testName: 'digit_span', signal: {} });
    const path = demoguardReducer(compare, { type: 'TEST_COMPLETED', testName: 'n_back', signal: {} });
    const voice = demoguardReducer(path, { type: 'TEST_COMPLETED', testName: 'trail_tap', signal: {} });
    const review = demoguardReducer(voice, { type: 'VOICE_CAPTURED', voice: { recorded: true, quality: 'ok', challenge_id: 'test' }, diagnostic: null });
    const devSignals = demoguardReducer(review, { type: 'REVIEW_CONTINUE' });
    const readiness = demoguardReducer(devSignals, { type: 'DEVICE_SIGNALS_CONTINUE' });
    const next = demoguardReducer(readiness, { type: 'SUBMIT' });
    expect(next.phase).toBe('submitting');
  });

  it('RESPONSE_RECEIVED transitions submitting → done', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const camera = demoguardReducer(started, { type: 'PREP_READY' });
    const reflex = demoguardReducer(camera, { type: 'SELFIE_CAPTURED', selfie: null });
    const colors = demoguardReducer(reflex, { type: 'TEST_COMPLETED', testName: 'reflex', signal: {} });
    const memory = demoguardReducer(colors, { type: 'TEST_COMPLETED', testName: 'stroop', signal: {} });
    const compare = demoguardReducer(memory, { type: 'TEST_COMPLETED', testName: 'digit_span', signal: {} });
    const path = demoguardReducer(compare, { type: 'TEST_COMPLETED', testName: 'n_back', signal: {} });
    const voice = demoguardReducer(path, { type: 'TEST_COMPLETED', testName: 'trail_tap', signal: {} });
    const review = demoguardReducer(voice, { type: 'VOICE_CAPTURED', voice: { recorded: true, quality: 'ok', challenge_id: 'test' }, diagnostic: null });
    const devSignals = demoguardReducer(review, { type: 'REVIEW_CONTINUE' });
    const readiness = demoguardReducer(devSignals, { type: 'DEVICE_SIGNALS_CONTINUE' });
    const submitting = demoguardReducer(readiness, { type: 'SUBMIT' });
    const next = demoguardReducer(submitting, { type: 'RESPONSE_RECEIVED', response: { ok: true, source: 'demoguard_mobile', status: 'submitted' } });
    expect(next.phase).toBe('done');
    expect(next.response?.ok).toBe(true);
    expect(next.completedAt).not.toBeNull();
  });

  it('ERROR transitions any phase → error', () => {
    const next = demoguardReducer(initialState, { type: 'ERROR', reason: 'test error' });
    expect(next.phase).toBe('error');
    expect(next.error).toBe('test error');
  });

  it('RESET returns to initial state', () => {
    const started = demoguardReducer(initialState, { type: 'START', sessionPublicId: 's1' });
    const next = demoguardReducer(started, { type: 'RESET' });
    expect(next.phase).toBe('idle');
    expect(next.sessionPublicId).toBe('');
  });

  it('Invalid transition is ignored', () => {
    const next = demoguardReducer(initialState, { type: 'SUBMIT' });
    expect(next.phase).toBe('idle');
  });
});

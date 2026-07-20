# Voice Warm-up Phase — Microphone Initialization

## Overview

The Demoguard voice capture pipeline uses a **two-phase recording system**:

1. **Phase 1 — Warm-up (Amorçage):** Microphone initialization + AudioContext.resume() + voice confirmation
2. **Phase 2 — RAN Challenge Capture:** Actual recording with identical VAD behavior to pre-warm-up pipeline

## Problem Addressed

The previous pipeline started recording immediately at button click, exposing the user to hidden startup costs:
- Microphone permission delay (first use)
- `AudioContext` initialization (potentially `suspended` on mobile)

The warm-up phase solves these by initializing the microphone and confirming voice capture BEFORE starting `MediaRecorder`.

## Regression Fix (July 2026)

### The Bug

The initial implementation carried the warm-up's `maxEnergy` into Phase 2 as `initialMaxEnergy`. Since `VAD_ENERGY_THRESHOLD` (0.015) is a **relative** threshold (`energy / maxEnergy > 0.015`), a warm-up `maxEnergy` higher than the Phase 2 energy made the VAD **artificially strict**:

- Warm-up phrase ("Bonjour, je suis prêt") spoken loudly → `maxEnergy = 0.3`
- RAN digits spoken more quietly → `energy = 0.004`
- With warm-up calibration: `0.004 / 0.3 = 0.013 < 0.015` → **unvoiced** (wrong!)
- Without warm-up (cold start): `maxEnergy` quickly becomes `0.005`, then `0.004 / 0.005 = 0.8 > 0.015` → **voiced** (correct!)

This caused `voicedDurationMs` to drop from ~4000-5650ms (pre-warm-up) to ~1780ms — a severe regression with `confidence=0.300` and `insufficient_voiced_duration`.

### The Fix

Both `voicedDuration` AND `maxEnergy` are reset at the Phase 1 → Phase 2 transition:

```typescript
vad.resetVoicedDuration();
vad.resetMaxEnergy(); // Reset to cold-start 1e-10
```

Phase 2's VAD now starts with cold-start `maxEnergy` (1e-10), **identical** to the original pipeline without warm-up. The warm-up still provides:
- Microphone initialization (`getUserMedia`)
- `AudioContext.resume()` (critical on mobile)
- Voice confirmation (mic is alive)

But VAD calibration is deferred to Phase 2's own frame processing, where `maxEnergy` naturally adapts to the actual RAN digit energy.

The retry path also no longer passes `referenceMaxEnergy` to avoid the same regression.

## Solution Architecture

### Phase 1: Warm-up

1. User clicks "Record" → UI shows warm-up phrase ("Bonjour, je suis prêt" / "Hello, I'm ready")
2. `getUserMedia({ audio: true })` opens the microphone
3. `AudioContext.resume()` is called (same rigor as existing fix)
4. VAD accumulator runs via `AnalyserNode` or `AudioWorklet` — **without MediaRecorder**
5. The system waits until `WARMUP_MIN_VOICE_MS` (500ms) of voiced audio is detected
6. `vad.resetVoicedDuration()` AND `vad.resetMaxEnergy()` are called — Phase 2 starts fresh
7. `onWarmupComplete(warmupMaxEnergy)` callback fires → UI transitions to Phase 2

**Safety cap:** If the user doesn't speak within `WARMUP_MAX_MS` (6000ms), the system proceeds to Phase 2 anyway.

**Strict separation:** MediaRecorder has NOT started during Phase 1. The warm-up audio is never recorded, never encoded, never sent to HCS backend, and never affects the trust score.

### Phase 2: RAN Challenge Capture

1. MediaRecorder starts (250ms chunk interval)
2. VAD accumulator runs with cold-start `maxEnergy` (1e-10) — **identical to pre-warm-up pipeline**
3. Recording stops when `MIN_VOICED_DURATION_MS` (3000ms) of voiced audio is reached
4. Post-encode VAD validation runs (same as before)
5. If post-encode validation fails, retry also uses cold-start VAD (no warm-up calibration)

**Zero regression:** Phase 2 VAD behavior is identical to the original pipeline without warm-up.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/vadRecorder.ts` | `createVadAccumulator` accepts `initialMaxEnergy`; `resetMaxEnergy()` method; warm-up phase resets both duration AND maxEnergy; retry no longer passes `referenceMaxEnergy` |
| `src/demoguard/collectors/audioCollector.ts` | `recordVoiceChallenge` accepts optional `onWarmupComplete` callback |
| `src/screens/VoiceScreen.tsx` | New `warming_up` state; 2-phase UI |
| `src/i18n/fr.json` / `src/i18n/en.json` | 5 new warm-up i18n keys |
| `src/index.css` | `.voice-pulse.warming-up` (amber color) |
| `tests/vadRecorder.test.ts` | Regression test for warm-up maxEnergy carry-over bug + equivalence test (warm-up → reset = cold-start) |

## Debugging

Enable `?debug=vad` in the URL to see `[VAD-DEBUG]` logs. Key warm-up log stages:

- `warmup_start` — Phase 1 begins
- `warmup_complete` — Phase 1 done, `warmupMaxEnergy` logged (for reference only, NOT used in Phase 2)
- `recorder_started` — Phase 2 begins with cold-start VAD
- `post_encode_comparison` — Post-encode VAD result vs live VAD

## Invariants

- ✅ Warm-up audio is NEVER recorded (MediaRecorder starts only in Phase 2)
- ✅ Warm-up audio is NEVER sent to HCS backend
- ✅ Warm-up audio does NOT count toward trust score
- ✅ Phase 2 VAD is identical to pre-warm-up pipeline (cold-start maxEnergy)
- ✅ `recordAudioWithVad()` (no warm-up) is unchanged — existing callers have zero regression
- ✅ Warm-up never produces a result worse than the old behavior without warm-up

@copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
Patents Pending FR2514274 | FR2514546

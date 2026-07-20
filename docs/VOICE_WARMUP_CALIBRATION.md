# Voice Warm-up Phase — Session-Calibrated VAD

## Overview

The Demoguard voice capture pipeline now uses a **two-phase recording system**:

1. **Phase 1 — Warm-up (Amorçage):** Microphone initialization + VAD calibration
2. **Phase 2 — RAN Challenge Capture:** Actual recording with session-calibrated VAD threshold

## Problem Addressed

The previous pipeline started recording immediately at button click, exposing the user to hidden startup costs:
- Microphone permission delay (first use)
- `AudioContext` initialization (potentially `suspended` on mobile)
- **Cold-start VAD**: `maxEnergy` starts at `1e-10`, so every early frame is classified as voiced (since `any_energy / 1e-10 >> threshold`). This makes VAD classification unreliable for the first ~500ms of recording.

Additionally, the `VAD_ENERGY_THRESHOLD` (0.015) is a **relative** threshold (fraction of `maxEnergy`), not an absolute energy level. Without calibration, `maxEnergy` is only learned during the actual challenge recording, meaning the first few seconds of VAD decisions are based on incomplete energy information.

## Solution Architecture

### Phase 1: Warm-up

1. User clicks "Record" → UI shows warm-up phrase ("Bonjour, je suis prêt" / "Hello, I'm ready")
2. `getUserMedia({ audio: true })` opens the microphone
3. `AudioContext.resume()` is called (same rigor as existing fix)
4. VAD accumulator runs via `AnalyserNode` or `AudioWorklet` — **without MediaRecorder**
5. The system waits until `WARMUP_MIN_VOICE_MS` (500ms) of voiced audio is detected
6. The warm-up's `maxEnergy` is captured as the **reference maxEnergy** for this session
7. `vad.resetVoicedDuration()` is called — maxEnergy carries over, voiced duration resets to 0
8. `onWarmupComplete(referenceMaxEnergy)` callback fires → UI transitions to Phase 2

**Safety cap:** If the user doesn't speak within `WARMUP_MAX_MS` (6000ms), the system proceeds to Phase 2 anyway. The relative threshold self-corrects when the user speaks louder in Phase 2.

**Strict separation:** MediaRecorder has NOT started during Phase 1. The warm-up audio is never recorded, never encoded, never sent to HCS backend, and never affects the trust score.

### Phase 2: RAN Challenge Capture

1. MediaRecorder starts (250ms chunk interval)
2. VAD accumulator runs with `initialMaxEnergy` = warm-up's reference maxEnergy
3. Recording stops when `MIN_VOICED_DURATION_MS` (3000ms) of voiced audio is reached
4. Post-encode VAD validation runs (same as before)
5. If post-encode validation fails, retry uses the same `referenceMaxEnergy` for calibrated VAD

**Zero regression:** The VAD logic, post-encode validation, segment merging, and all 5 liveness dimensions (breathingPresence, HNR, jitter, harmonicBalance, voicingRatio) are computed by HCS backend from Phase 2 audio only. The only change is a better starting point for `maxEnergy`.

## Calibration Integration with VAD_ENERGY_THRESHOLD

The warm-up **complements**, not **replaces**, the existing relative threshold:

| Aspect | Before (cold start) | After (warm-up calibrated) |
|--------|---------------------|---------------------------|
| `maxEnergy` at Phase 2 start | `1e-10` | User's actual voice energy |
| First frame classification | Any energy → voiced (false positive) | Accurate from first frame |
| `VAD_ENERGY_THRESHOLD` | 0.015 (unchanged) | 0.015 (unchanged) |
| `maxEnergy` updates during Phase 2 | Yes | Yes (still updates if louder frames arrive) |

The relative threshold (`energy / maxEnergy > 0.015`) remains the same. The warm-up simply eliminates the cold-start period where `maxEnergy = 1e-10` makes VAD classification unreliable.

## Remote-Config Integration

`VAD_ENERGY_THRESHOLD`, `MIN_VOICED_DURATION_MS`, and `MAX_RECORDING_MS` remain configurable via the hybrid-vector-api proxy (see `vad-thresholds.ts`). The warm-up constants (`WARMUP_MIN_VOICE_MS`, `WARMUP_MAX_MS`) are hardcoded for now — they are technical calibration parameters, not tuning knobs that need remote adjustment.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/vadRecorder.ts` | `createVadAccumulator` accepts `initialMaxEnergy`; `resetVoicedDuration()` method; `warmupAndRecordAudioWithVad()` export; warm-up phase in `recordAudioWithVadSingleAttempt` |
| `src/demoguard/collectors/audioCollector.ts` | `recordVoiceChallenge` accepts optional `onWarmupComplete` callback; uses `warmupAndRecordAudioWithVad` when provided |
| `src/screens/VoiceScreen.tsx` | New `warming_up` state; 2-phase UI with warm-up phrase display and automatic transition |
| `src/i18n/fr.json` | `voice.warmupPrompt`, `voice.warmupPhrase`, `voice.warmupThen`, `voice.warmupInProgress`, `voice.warmupHint` |
| `src/i18n/en.json` | Same keys, English translations |
| `src/index.css` | `.voice-pulse.warming-up` (amber color, distinct from recording red) |
| `tests/vadRecorder.test.ts` | Warm-up constants tests + calibration logic tests (initialMaxEnergy, resetVoicedDuration, cold-start vs calibrated comparison) |

## Debugging

Enable `?debug=vad` in the URL to see `[VAD-DEBUG]` logs in the `VadDebugOverlay`. Key warm-up log stages:

- `warmup_start` — Phase 1 begins, VAD mode and AudioContext state logged
- `warmup_timeout` — User didn't speak within 6s, proceeding anyway
- `warmup_complete` — Phase 1 done, `warmupDurationMs` and `warmupMaxEnergy` logged
- `recorder_started` — Phase 2 begins, `warmupMaxEnergy` carried over
- `post_encode_comparison` — Post-encode VAD result vs live VAD, `warmupMaxEnergy` logged

## Invariants

- ✅ Warm-up audio is NEVER recorded (MediaRecorder starts only in Phase 2)
- ✅ Warm-up audio is NEVER sent to HCS backend
- ✅ Warm-up audio does NOT count toward trust score
- ✅ Phase 2 VAD, segment merging, and liveness scoring are unchanged
- ✅ `recordAudioWithVad()` (no warm-up) is unchanged — existing callers have zero regression
- ✅ No clear audio data from Phase 1 is logged (only energy values, which are safe)
- ✅ Fail-closed: if warm-up fails, Phase 2 proceeds with whatever calibration is available

## Validation Checklist

- [ ] `vadRecorder.test.ts` — 26 tests pass (including 8 new warm-up tests)
- [ ] `i18n.test.ts` — 14 tests pass (key parity maintained with new strings)
- [ ] Real device test: Phase 1 captures warm-up, `maxEnergy` visible in `[VAD-DEBUG]` logs
- [ ] Real device test: Smooth transition to Phase 2, RAN challenge completes normally
- [ ] Real device test: `[VAD-DEBUG]` shows `warmupMaxEnergy` distinct from Phase 2 `maxEnergy`
- [ ] Compare before/after on lab-simulator for empirical gain measurement

@copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
Patents Pending FR2514274 | FR2514546

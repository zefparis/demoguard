# DEMOGUARD STANDALONE — SCAFFOLDING REPORT

**Date:** 2026-03-30 (updated 2026-03-31 — DEMOGUARD-STANDALONE-01b)  
**Project:** `demoguard-app` — Standalone Vite+React+TS DemoGuard application  
**Source:** Extracted from `payguard` project (`src/demoguard/` module)

---

## 1. Objective

Extract the DemoGuard cognitive + behavioral collection module from the PayGuard monolith into a standalone Vite+React+TS application. The app collects device signals, runs a 6-module cognitive battery (Reflex, Stroop, Digit Span, N-Back, Trail Tap, Vocal RAN), captures behavioral touch data, and submits everything through a Vercel proxy to the Hybrid Vector backend.

## 2. Architecture

```
demoguard-app/
├── api/
│   └── demoguard/
│       └── verify.ts              # Vercel proxy (origin allowlist, rate limit, API key injection)
├── api/_lib/
│   └── demoguardSanitize.ts       # Response sanitizer (strips PII/biometrics)
├── src/
│   ├── App.tsx                    # Main orchestrator (reducer + context + screen routing)
│   ├── main.tsx                   # React root
│   ├── index.css                  # Global styles
│   ├── components/
│   │   ├── ErrorBoundary.tsx      # Per-screen crash catcher
│   │   ├── PhaseHeader.tsx        # Title + progress bar
│   │   └── TestCard.tsx           # Shared card wrapper
│   ├── hooks/
│   │   ├── useBehaviorSession.ts  # Per-session BehaviorSession ref
│   │   └── useLockedShell.ts      # Viewport lock + rotate overlay
│   ├── payload/
│   │   └── buildDemoGuardPayload.ts  # Pure payload assembler
│   ├── state/
│   │   ├── demoguardReducer.ts    # State machine (15 phases, 18 actions)
│   │   └── demoguardContext.tsx   # React context provider
│   ├── screens/
│   │   ├── IdleScreen.tsx         # Session ID input
│   │   ├── PrepScreen.tsx         # Device context + permissions
│   │   ├── CameraScreen.tsx       # Selfie capture
│   │   ├── ReflexScreen.tsx       # 5-round reaction time
│   │   ├── StroopScreen.tsx       # Color-word conflict (6 trials)
│   │   ├── DigitSpanScreen.tsx    # Memory sequence (3 trials)
│   │   ├── NBackScreen.tsx        # 1-back matching (8 trials)
│   │   ├── TrailTapScreen.tsx     # Sequential path tapping
│   │   ├── VoiceScreen.tsx        # Vocal RAN recording
│   │   ├── ReviewScreen.tsx       # Signal review
│   │   ├── DeviceSignalsScreen.tsx # Motion/orientation/touch/visibility/network
│   │   ├── ReadinessScreen.tsx    # Quality check + submit
│   │   ├── SubmittingScreen.tsx   # Loading
│   │   ├── DoneScreen.tsx         # Result display (hybridFusion decision)
│   │   └── ErrorScreen.tsx        # Error + retry
│   └── demoguard/
│       ├── types.ts               # All type definitions (DemoGuardSafeResponse aligned with backend)
│       ├── constants.ts           # DEMOGUARD_VERSION, timeouts, thresholds
│       ├── api.ts                 # API client (fetch proxy)
│       ├── cognitive/             # 6 challenge modules + scoring
│       ├── behavior/              # BehaviorSession (non-singleton) + scoring
│       ├── collectors/            # Camera, audio, motion, orientation, touch, visibility, network
│       ├── quality/               # Signal completeness + per-signal quality
│       └── lib/                   # Audio DSP (MFCC, WAV) + camera utils
├── tests/
│   ├── demoguardReducer.test.ts       # 14 tests — all phase transitions
│   ├── buildDemoGuardPayload.test.ts  # 9 tests — payload assembly + edge cases
│   ├── cognitiveBattery.test.ts       # 30 tests — 6 cognitive modules + scoring
│   ├── behaviorIntegratedTouch.test.ts # 18 tests — behavior recording + scoring + no-raw-data
│   └── qualityAssessors.test.ts       # 24 tests — selfie/audio/device quality + signal completeness
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── vercel.json
└── index.html
```

## 3. Key Design Decisions

### Non-singleton BehaviorSession
The original `payguard` used a module-level singleton for behavior collection. The standalone app uses a per-session `BehaviorSession` class instantiated via `useRef` in `useBehaviorSession`, ensuring clean state per control session.

### Reducer-driven state machine
All 15 phases (`idle → prep → camera → test_reflex → test_colors → test_memory → test_compare → test_path → voice → review → device_signals → readiness → submitting → done/error`) are enforced by `VALID_TRANSITIONS` in the reducer. No screen can skip phases.

### Sensitive data isolation
Selfie base64 and voice base64 + MFCC are stored in a `SensitiveRef` (useRef), never in React state. They're only read at submit time by `buildDemoGuardPayload` and sent to the proxy. The UI only sees safe metadata.

### Proxy-only API
The app never calls the upstream Hybrid Vector API directly. All requests go through `/api/demoguard/verify` (Vercel serverless function) which injects API keys and sanitizes responses.

## 4. DEMOGUARD-STANDALONE-01b Verdicts

### 4.1 Response Contract — DemoGuardSafeResponse

**Verdict:** ✅ Type corrected + DoneScreen updated

The backend (`hybrid-vector-api/src/routes/demoguard.ts:185-207`) sends a `DemoGuardSafeResponse` with `hybridFusion` containing fields that were missing from the app's type:

| Field | Before | After |
|-------|--------|-------|
| `behaviorStatus` | ❌ missing | ✅ `'ok' \| 'review' \| 'failed' \| 'missing'` |
| `behaviorSummary` | ❌ missing | ✅ `BehaviorSummary` |
| `touchDiagnosticsBehavior` | ❌ missing | ✅ `TouchDiagnosticsBehaviorSafe` |

**DoneScreen** now displays:
- `globalDecision` (APPROVED → "Accepté", REVIEW → "À réviser", REJECTED → "Rejeté")
- `trustLevel` — Niveau de confiance
- `cognitiveStatus` — Cognition
- `vocalStatus` — Voix
- `behaviorStatus` — Comportement

### 4.2 total_modules Verdict

**Verdict:** ✅ **6** (not 5)

Justification:
- `cognitiveScoring.ts:134` — `computeCognitiveSummary()` returns `total_modules: 6`
- `hybrid-vector-api/src/types/demoguard.ts:35-44` — `DemoGuardCognitiveSummary` interface defines `total_modules` as required field
- `hybrid-vector-api/src/routes/demoguard.ts:107-108` — Zod schema validates `total_modules` as required number
- `hybrid-vector-api/tests/demoguard-cognitive-fusion.test.ts:30-40` — `makeCognitiveSummary()` sets `total_modules: 6`
- The 6 cognitive modules are: **reflex, stroop, digit_span, n_back, trail_tap, vocal_ran**
- `demoguardCognitiveGate.ts` uses `completed_modules` (max 6) and `depth_score` to derive `cognitiveStatus` (passed/review/failed)

## 5. Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ 72 modules, 198KB JS (62KB gzip) |
| `npx vitest run` | ✅ 95/95 passed (5 test files) |

### Test breakdown

| Test file | Tests | Coverage |
|-----------|-------|----------|
| `demoguardReducer.test.ts` | 14 | Phase transitions, action handling |
| `buildDemoGuardPayload.test.ts` | 9 | Payload assembly + edge cases (0 interactions, touch unsupported, voice skipped, combined) |
| `cognitiveBattery.test.ts` | 30 | Reflex, Stroop, Digit Span, N-Back, Trail Tap, Vocal RAN, cognitive summary scoring |
| `behaviorIntegratedTouch.test.ts` | 18 | Behavior recording per task, summary, touch diagnostics, no-raw-data safety, scoring |
| `qualityAssessors.test.ts` | 24 | Selfie/audio quality, device signal quality, signal completeness, motion/orientation/network collectors |

## 6. Files Migrated from PayGuard

- `src/demoguard/types.ts` (updated with `behaviorStatus`, `behaviorSummary`, `touchDiagnosticsBehavior` in `DemoGuardHybridFusion`)
- `src/demoguard/constants.ts`
- `src/demoguard/api.ts`
- `src/demoguard/cognitive/` (6 challenges + scoring + types)
- `src/demoguard/behavior/` (behaviorTypes, behaviorScoring, behaviorSession [rewritten], taskBehaviorRecorder [rewritten])
- `src/demoguard/collectors/` (camera, audio, motion, orientation, touch, visibility, network)
- `src/demoguard/quality/` (signalCompleteness [rewritten], audioQuality, deviceSignalQuality, selfieQuality)
- `src/demoguard/lib/` (audio.ts, camera.ts)
- `api/demoguard/verify.ts`
- `api/_lib/demoguardSanitize.ts`

### Tests adapted from PayGuard
- `tests/cognitiveBattery.test.ts` — from `payguard/tests/demoguard-cognitive-battery.test.ts` (removed file-path UI safety tests referencing non-existent `DemoGuard.tsx`)
- `tests/behaviorIntegratedTouch.test.ts` — from `payguard/tests/p10-behavior-integrated-touch.test.ts` (adapted from singleton `touchBehaviorCollector` to non-singleton `BehaviorSession`)
- `tests/qualityAssessors.test.ts` — from `payguard/tests/demoguard-real-signals.test.ts` + `demoguard-device-signals.test.ts` (quality assessors + signal completeness + runtime collector tests)

## 7. Next Steps

- Add Capacitor config for iOS/Android packaging
- PWA manifest + service worker for installable web app
- Integration tests with Playwright
- Connect to Hybrid Vector backend staging for end-to-end validation
- Phone validation on real device

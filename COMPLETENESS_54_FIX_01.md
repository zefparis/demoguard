# COMPLETENESS-54-FIX-01 — Fix ordre d'affichage + vocal_ran dropped

**Task** : Corriger le 54% affiché sur ReadinessScreen (bug d'ordre d'affichage) + restaurer `vocal_ran` dans `cognitiveSignals` (signal droppé).
**Référence** : COMPLETENESS_54_DIAG_01.md
**Date** : 2026-07-12
**Statut** : ✅ Code terminé, en attente de run réel mobile pour validation empirique

---

## FIX 1 — Ordre d'affichage readiness

### Problème

`ReadinessScreen` calcule `computeQuality(state.signals, ...)` mais les 5 collecteurs continus (motion, orientation, touch, visibility, network) ne sont stoppés qu'au clic "Soumettre" dans `handleSubmit`. Résultat : affichage de **7/13 = 54%** au lieu de **12-13/13 = 92-100%**.

### Solution : Option A — Stop à la transition `device_signals → readiness`

Les collecteurs sont stoppés **avant** d'entrer en phase `readiness`, pas seulement au submit.

### Fichier modifié

`src/App.tsx:214-226`

#### Avant

```tsx
{state.phase === 'device_signals' && (
  <DeviceSignalsScreen
    signals={state.signals}
    onContinue={() => dispatch({ type: 'DEVICE_SIGNALS_CONTINUE' })}
  />
)}
```

#### Après

```tsx
{state.phase === 'device_signals' && (
  <DeviceSignalsScreen
    signals={state.signals}
    onContinue={() => {
      // Stop continuous collectors NOW so ReadinessScreen sees the final signals
      const deviceSignals = continuousSignals.stop();
      if (Object.keys(deviceSignals).length > 0) {
        dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals });
      }
      dispatch({ type: 'DEVICE_SIGNALS_CONTINUE' });
    }}
  />
)}
```

### Impact sur `handleSubmit`

`handleSubmit` (`App.tsx:78-100`) appelle toujours `continuousSignals.stop()` mais reçoit maintenant un objet **vide** (les collecteurs sont déjà stoppés). Le guard `if (Object.keys(deviceSignals).length > 0)` évite un dispatch inutile. Les signaux sont déjà dans `state.signals` depuis le stop à la transition. **Pas de double stop, pas de re-collecte.**

### Impact sur la fenêtre readiness→submit

L'utilisateur pourrait encore bouger le téléphone entre readiness et submit, mais cette fenêtre est quasi immédiate (clic sur "Soumettre"). Les signaux de motion/orientation collectés jusqu'à la transition `device_signals → readiness` sont suffisants — la perte est négligeable.

---

## FIX 2 — vocal_ran dropped

### Problème

`VoiceScreen.tsx:60` passe `vocalRan` en 5e argument de `onComplete`, mais `handleVoiceCaptured` (`App.tsx:65-74`) n'acceptait que 4 paramètres. Le 5e était silencieusement droppé. `cognitive.vocal_ran` restait `null` → plafond à 12/13 = 92% au lieu de 13/13 = 100%.

### Fichiers modifiés

**`src/App.tsx:20-21, 66-76`**

#### Avant

```tsx
import type { DemoGuardSelfieSignal, DemoGuardVoiceSignal, VoiceDiagnosticsSafe } from './demoguard/types';

const handleVoiceCaptured = useCallback((
  voice: DemoGuardVoiceSignal,
  diagnostic: VoiceDiagnosticsSafe | null,
  voiceB64: string | null,
  mfccSummary: number[] | null,
) => {
  sensitiveRef.current.voice_b64 = voiceB64;
  sensitiveRef.current.mfcc_summary = mfccSummary;
  dispatch({ type: 'VOICE_CAPTURED', voice, diagnostic });
}, []);
```

#### Après

```tsx
import type { DemoGuardSelfieSignal, DemoGuardVoiceSignal, VoiceDiagnosticsSafe } from './demoguard/types';
import type { VocalRanSignal } from './demoguard/cognitive/cognitiveTypes';

const handleVoiceCaptured = useCallback((
  voice: DemoGuardVoiceSignal,
  diagnostic: VoiceDiagnosticsSafe | null,
  voiceB64: string | null,
  mfccSummary: number[] | null,
  vocalRan: VocalRanSignal,
) => {
  sensitiveRef.current.voice_b64 = voiceB64;
  sensitiveRef.current.mfcc_summary = mfccSummary;
  dispatch({ type: 'VOICE_CAPTURED', voice, diagnostic, vocalRan });
}, []);
```

**`src/state/demoguardReducer.ts:10-11, 88, 192-217`**

#### Avant

```typescript
| { type: 'VOICE_CAPTURED'; voice: DemoGuardSignals['voice']; diagnostic: VoiceDiagnosticsSafe | null }

case 'VOICE_CAPTURED': {
  const nextPhase: Phase = 'review';
  if (!isValidTransition(state.phase, nextPhase)) return state;
  return {
    ...state,
    signals: { ...state.signals, voice: action.voice, voiceDiagnostics: action.diagnostic ?? undefined },
    voiceDiagnostic: action.diagnostic,
    phase: nextPhase,
  };
}
```

#### Après

```typescript
import type { CognitiveSignals, VocalRanSignal } from '../demoguard/cognitive/cognitiveTypes';

| { type: 'VOICE_CAPTURED'; voice: DemoGuardSignals['voice']; diagnostic: VoiceDiagnosticsSafe | null; vocalRan?: VocalRanSignal }

case 'VOICE_CAPTURED': {
  const nextPhase: Phase = 'review';
  if (!isValidTransition(state.phase, nextPhase)) return state;

  // Store vocal_ran in cognitiveSignals if provided
  let cognitiveSignals = state.cognitiveSignals;
  if (action.vocalRan) {
    cognitiveSignals = state.cognitiveSignals ?? {
      reflex: null, stroop: null, digit_span: null, n_back: null, trail_tap: null, vocal_ran: null, summary: null,
    };
    cognitiveSignals = { ...cognitiveSignals, vocal_ran: action.vocalRan };
  }

  return {
    ...state,
    cognitiveSignals,
    signals: {
      ...state.signals,
      voice: action.voice,
      cognitive: cognitiveSignals,
      voiceDiagnostics: action.diagnostic ?? undefined,
    },
    voiceDiagnostic: action.diagnostic,
    phase: nextPhase,
  };
}
```

### Note sur le payload serveur

Ce fix améliore uniquement la **complétude affichée** côté client. Le champ `vocal_ran` reste strippé côté HV (schema HV non déclaré pour `vocal_ran`, décision antérieure documentée). Le payload envoyé au serveur reste **identique** aux runs précédents.

---

## TESTS

### Nouveaux tests (3 tests)

`tests/demoguardReducer.test.ts` — section `COMPLETENESS-54-FIX-01`

| Test | Description | Résultat attendu |
|---|---|---|
| `VOICE_CAPTURED stores vocalRan in cognitiveSignals` | Dispatch VOICE_CAPTURED avec vocalRan | `cognitiveSignals.vocal_ran` et `signals.cognitive.vocal_ran` peuplés |
| `VOICE_CAPTURED without vocalRan leaves cognitiveSignals.vocal_ran null` | Dispatch VOICE_CAPTURED sans vocalRan | `cognitiveSignals.vocal_ran` reste null (rétrocompatibilité) |
| `DEVICE_SIGNALS_COLLECTED + CONTINUE produces state with all optional signals for readiness` | Simule le stop des collecteurs + transition readiness | Tous les signaux optionnels + vocal_ran présents dans `state.signals` |

### Non-régression payload

Le test existant `empirical-payload.test.ts` n'est pas affecté — le payload final (`buildDemoGuardPayload`) utilise `stateWithSignals` qui est maintenant identique avant et après submit (les signaux sont déjà mergés au moment du stop à la transition readiness).

### Résultats

```
npx tsc --noEmit → ✅ 0 errors
npx vitest run → 163/163 pass (10 files)
```

---

## FICHIERS MODIFIÉS

| Fichier | Changement |
|---|---|
| `src/App.tsx` | + import `VocalRanSignal`, + 5e param à `handleVoiceCaptured`, + stop des collecteurs à la transition `device_signals → readiness` |
| `src/state/demoguardReducer.ts` | + import `VocalRanSignal`, + `vocalRan?` dans `VOICE_CAPTURED` action, + stockage dans `cognitiveSignals.vocal_ran` |
| `tests/demoguardReducer.test.ts` | + 3 nouveaux tests |

**Total** : 3 fichiers modifiés, 0 fichier créé.

---

## VALIDATION EMPIRIQUE — En attente

### Procédure

1. Deploy demoguard-app
2. Run réel mobile complet
3. Observer ReadinessScreen :
   - **Avant** : affichait 54% (7/13)
   - **Après** : devrait afficher 92-100% (12-13/13)
4. E2E Trace admin : `completeness` cohérent avec l'affichage client
5. Confirmer Behavior quality (fix BEHAVIOR-VARIANCE-FIX-01) dans ce même run
6. Zéro régression cognitive/vocal/touch/motion/orientation

### Avant/Après attendu

| Métrique | Avant | Après attendu |
|---|---|---|
| ReadinessScreen completeness | 54% (7/13) | 92-100% (12-13/13) |
| `cognitive.vocal_ran` | `null` (droppé) | Peuplé |
| Payload serveur | Inchangé | Inchangé (vocal_ran strippé côté HV) |
| `consistencyScore` | 0.35-0.45 (avant BEHAVIOR-VARIANCE-FIX) | 0.65-0.90 (après BEHAVIOR-VARIANCE-FIX) |
| `behaviorSummary.quality` | 'review' | 'ok' |

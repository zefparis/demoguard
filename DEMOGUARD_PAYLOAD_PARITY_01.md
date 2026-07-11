# DEMOGUARD_PAYLOAD_PARITY_01 — Comparaison stricte payguard vs demoguard-app

**Date :** 11 juillet 2026
**Référence :** payguard (fonctionnel, validé par le backend)
**Objectif :** Identifier tous les gaps de payload entre payguard et demoguard-app
**Méthode :** Analyse statique du code (pas de runtime capture — les payloads sont reconstruits en traçant chaque champ depuis sa source)

---

## 1. PAYLOAD RÉEL PAYGUARD (référence)

**Source :** `payguard/src/pages/DemoGuard.tsx:846-918` (`handleSubmit`)

### Flow de construction

1. `finishToReview()` (ligne 400) est appelée après le test vocal
   - Assemble `cogSignals` avec tous les signaux cognitifs
   - Appelle `computeCognitiveSummary(cogSignals)` → `cogSignals.summary = summary`
   - `setCogSummary(summary)` → stocke le résumé
   - `setBehaviorSummary(getTouchBehaviorCollector().getSummary())`
   - Transitions vers `review`

2. Phase `device-signals` (useEffect ligne 785-809) :
   - Collecte motion (3s), orientation (3s), touch (2s), visibility (2s), network
   - Stocke dans les state variables dédiées

3. Phase `readiness` (useEffect ligne 812-838) :
   - Reconstruit `signals` avec tous les signaux
   - Calcule `quality = computeQuality(signals, device, permissions)`

4. `handleSubmit()` (ligne 846) :
   - Reconstruit `signals` à nouveau (ligne 875-889)
   - Appelle `submitDemoGuard()` avec le payload complet

### Payload JSON reconstitué (run complet réussi)

```json
{
  "hcs_session_public_id": "hcs_sess_<16chars>",
  "source": "demoguard_mobile",
  "demo_guard": {
    "version": "1.0.0",
    "started_at": "2026-07-11T...",
    "completed_at": "2026-07-11T...",
    "device": { "platform": "...", "userAgent": "...", "language": "...", "screenWidth": ..., "screenHeight": ..., "online": true },
    "permissions": { "camera": "granted", "microphone": "granted", "notifications": "default" },
    "signals": {
      "selfie": { "captured": true, "quality": "ok", "width": ..., "height": ... },
      "reaction": null,
      "voice": { "recorded": true, "duration_ms": 4000, "quality": "ok", "challenge_id": "..." },
      "motion": { "supported": true, "quality": "ok", "accelerometer_samples": ..., "gyro_samples": ... },
      "orientation": { "supported": true, "quality": "ok", "alpha": ..., "beta": ..., "gamma": ... },
      "touch": { "touch_count": ..., "quality": "ok" },
      "visibility": { "visible": true, "quality": "ok", "hidden_count": 0 },
      "network": { "online": true, "effectiveType": "4g", "downlink": ..., "rtt": ... },
      "cognitive": {
        "reflex": { "rounds": 5, "avg_ms": ..., "quality": "ok", "too_fast_count": 0 },
        "stroop": { "trials": ..., "correct": ..., "avg_ms": ..., "quality": "ok" },
        "digit_span": { "trials": ..., "correct": ..., "quality": "ok" },
        "n_back": { "trials": ..., "correct": ..., "quality": "ok" },
        "trail_tap": { "completion_ms": ..., "errors": ..., "quality": "ok" },
        "vocal_ran": null,
        "summary": {
          "completed_modules": 5,
          "total_modules": 6,
          "depth_score": 0.85,
          "consistency_score": 0.63,
          "anomaly_score": 0.12,
          "human_likelihood": "high",
          "quality": "ok"
        }
      },
      "behavior": {
        "taskBehaviors": { "reflex": {...}, "stroop": {...}, ... },
        "summary": {
          "tasksObserved": 5,
          "totalInteractions": 42,
          "avgRhythmMs": ...,
          "rhythmVariance": ...,
          "hesitationTotal": ...,
          "correctionTotal": ...,
          "consistencyScore": ...,
          "motorConfidence": ...,
          "behaviorLikelihood": "high",
          "quality": "ok"
        }
      },
      "voiceDiagnostics": {
        "status": "not_checked",
        "reasonSafe": "not_attempted",
        "analysisMode": "skipped",
        "audioCaptured": true,
        "payloadPrepared": true,
        "relayAttempted": false,
        "relayAccepted": false,
        "hcsAnalyzed": false,
        "featuresExtracted": false,
        "livenessStatus": "unknown",
        "confidence": null,
        "latencyMs": null
      },
      "touchDiagnostics": {
        "status": "ok",
        "supported": true,
        "interactionCount": 42,
        "quality": "ok",
        "reasonSafe": "..."
      },
      "touchDiagnosticsBehavior": {
        "status": "ok",
        "supported": true,
        "interactionCount": 42,
        "tasksObserved": 5,
        "quality": "ok",
        "reasonSafe": "...",
        "behaviorConsistency": ...,
        "motorConfidence": ...
      }
    },
    "quality": {
      "signal_completeness": 0.85,
      "device_ready": true,
      "permissions_ready": true,
      "overall_ready": true,
      "critical_missing": [],
      "missing_optional": []
    }
  },
  "sensitive": {
    "selfie_b64": "data:image/jpeg;base64,...",
    "voice_b64": "data:audio/wav;base64,..."
  }
}
```

**Points clés du payload payguard :**
- `reaction`: **toujours `null`** (le state `reactionSignal` n'est jamais set à non-null)
- `cognitive.summary`: **toujours un objet réel** (calculé par `computeCognitiveSummary()` ligne 410)
- `voiceDiagnostics`: **toujours un objet** (la fonction `buildVoiceDiagnosticsSafe` ne retourne jamais null/undefined)
- `touchDiagnostics`: **toujours un objet** (la fonction `buildTouchDiagnosticsSafe` ne retourne jamais null/undefined)
- `touchDiagnosticsBehavior`: **objet ou undefined** (depuis `getTouchBehaviorCollector().getTouchDiagnostics()`)
- `behavior`: **objet** (depuis `getTouchBehaviorCollector().getPayload()`)
- `vocal_ran`: **toujours `null`** (hardcoded ligne 407 et 870)
- `sensitive`: objet si données capturées, `undefined` sinon

---

## 2. PAYLOAD RÉEL DEMOGUARD-APP (à comparer)

**Source :** `demoguard-app/src/App.tsx:70-84` (`handleSubmit`) + `demoguard-app/src/payload/buildDemoGuardPayload.ts`

### Flow de construction

1. Tests cognitifs (reflex → stroop → digit_span → n_back → trail_tap) :
   - Chaque screen appelle `onComplete(signal)` → dispatch `TEST_COMPLETED`
   - Le reducer stocke le signal dans `state.cognitiveSignals[testName]`
   - **`summary` reste `null`** (jamais calculé)

2. Voice screen :
   - `VoiceScreen` appelle `onComplete(voice, diagnostic, voiceB64, mfccSummary, vocalRan)`
   - **`handleVoiceCaptured` dans App.tsx ne reçoit que 4 paramètres** → `vocalRan` est DROPPÉ
   - Dispatch `VOICE_CAPTURED` → stocke `voice` et `diagnostic` dans le state

3. Review screen → dispatch `BEHAVIOR_COLLECTED` + `REVIEW_CONTINUE`

4. Device signals screen :
   - Collecte motion (3s), orientation (3s), touch (2s), visibility (2s), network
   - Dispatch `DEVICE_SIGNALS_COLLECTED` → stocke dans `state.signals`

5. Readiness screen :
   - Calcule `quality` localement via `useMemo` (non stocké dans le reducer)

6. `handleSubmit()` :
   - Récupère `behaviorPayload` et `behaviorDiag` depuis `useBehaviorSession`
   - Dispatch `BEHAVIOR_COLLECTED` (mais `state` n'est pas encore mis à jour)
   - Appelle `buildDemoGuardPayload(state, behaviorPayload, behaviorDiag, sensitiveRef.current)`

### Payload JSON reconstitué (run complet réussi)

```json
{
  "hcs_session_public_id": "hcs_sess_<16chars>",
  "source": "demoguard_mobile",
  "demo_guard": {
    "version": "1.0.0",
    "started_at": "2026-07-11T...",
    "completed_at": "2026-07-11T...",
    "device": { "platform": "...", "userAgent": "...", "language": "...", "screenWidth": ..., "screenHeight": ..., "online": true },
    "permissions": { "camera": "granted", "microphone": "granted", "notifications": "default" },
    "signals": {
      "selfie": { "captured": true, "quality": "ok", "width": ..., "height": ... },
      "reaction": null,
      "voice": { "recorded": true, "duration_ms": ..., "quality": "ok", "challenge_id": "..." },
      "motion": { "supported": true, "quality": "ok", ... },
      "orientation": { "supported": true, "quality": "ok", ... },
      "touch": { "touch_count": ..., "quality": "ok" },
      "visibility": { "visible": true, "quality": "ok", "hidden_count": 0 },
      "network": { "online": true, "effectiveType": "4g", ... },
      "cognitive": {
        "reflex": { "rounds": 5, "avg_ms": ..., "quality": "ok", "too_fast_count": 0 },
        "stroop": { "trials": ..., "correct": ..., "avg_ms": ..., "quality": "ok" },
        "digit_span": { "trials": ..., "correct": ..., "quality": "ok" },
        "n_back": { "trials": ..., "correct": ..., "quality": "ok" },
        "trail_tap": { "completion_ms": ..., "errors": ..., "quality": "ok" },
        "vocal_ran": null,
        "summary": null
      },
      "behavior": {
        "taskBehaviors": { "reflex": {...}, "stroop": {...}, ... },
        "summary": {
          "tasksObserved": 5,
          "totalInteractions": 42,
          "avgRhythmMs": ...,
          "rhythmVariance": ...,
          "hesitationTotal": ...,
          "correctionTotal": ...,
          "consistencyScore": ...,
          "motorConfidence": ...,
          "behaviorLikelihood": "high",
          "quality": "ok"
        }
      },
      "voiceDiagnostics": {
        "status": "not_checked",
        "reasonSafe": "voice_checked",
        "analysisMode": "...",
        "audioCaptured": true,
        "payloadPrepared": true,
        "relayAttempted": false,
        "relayAccepted": false,
        "hcsAnalyzed": false,
        "featuresExtracted": false,
        "livenessStatus": "unknown",
        "confidence": null,
        "latencyMs": null
      },
      "touchDiagnostics": undefined,
      "touchDiagnosticsBehavior": {
        "status": "ok",
        "supported": true,
        "interactionCount": 42,
        "tasksObserved": 5,
        "quality": "ok",
        "reasonSafe": "...",
        "behaviorConsistency": ...,
        "motorConfidence": ...
      }
    },
    "quality": {
      "signal_completeness": 0.85,
      "device_ready": true,
      "permissions_ready": true,
      "overall_ready": true,
      "critical_missing": [],
      "missing_optional": []
    }
  },
  "sensitive": {
    "selfie_b64": "data:image/jpeg;base64,...",
    "voice_b64": "data:audio/wav;base64,...",
    "mfcc_summary": [...]
  }
}
```

---

## 3. DIFF CHAMP PAR CHAMP

| Champ | payguard (réf) | demoguard-app | Zod schema | Cause du gap |
|-------|---------------|---------------|------------|--------------|
| `signals.reaction` | `null` | `null` (hardcoded `buildDemoGuardPayload.ts:31`) | `z.object({}).passthrough().optional()` → **null rejeté** | **Identique** — les deux envoient null. Voir §5 pour analyse. |
| `signals.cognitive.summary` | **objet réel** (`computeCognitiveSummary()` ligne 410) | **`null`** (jamais calculé) | `z.object({...}).optional()` → **null rejeté** | **GAP CRITIQUE** — `computeCognitiveSummary()` n'est jamais appelé dans demoguard-app. Le reducer initialise `summary: null` (ligne 170) et aucune action ne le met à jour. |
| `signals.cognitive.vocal_ran` | `null` (hardcoded) | `null` (calculé par VoiceScreen mais **droppé** dans le callback) | Strippé par Zod (pas dans le schema cognitive) | **GAP silencieux** — `VoiceScreen.onComplete` passe 5 args, `handleVoiceCaptured` n'en reçoit que 4. Le signal `vocalRan` est calculé puis perdu. |
| `signals.voiceDiagnostics` | **toujours un objet** (`buildVoiceDiagnosticsSafe` ne retourne jamais null) | **objet ou `undefined`** (`state.voiceDiagnostic ?? undefined`) | `.passthrough().optional()` → undefined OK | **GAP partiel** — Si voix enregistrée: objet (OK). Si voix absente: `undefined` au lieu d'un objet `status: 'not_checked'`. Pas d'erreur Zod mais champ manquant pour le backend. |
| `signals.touchDiagnostics` | **toujours un objet** (`buildTouchDiagnosticsSafe` ne retourne jamais null/undefined) | **toujours `undefined`** (`state.touchDiagnostic` jamais set dans le reducer) | `.passthrough().optional()` → undefined OK | **GAP complet** — La fonction `buildTouchDiagnosticsSafe` n'existe pas dans demoguard-app. Le reducer a `touchDiagnostic: null` mais aucune action ne le set. |
| `signals.touchDiagnosticsBehavior` | objet (from `getTouchDiagnostics()`) | objet (from `getTouchDiagnostics()`) | `.optional()` → objet OK | **Identique** ✅ |
| `signals.behavior` | objet (from `getPayload()`) | objet (from `getPayload()`) | `.optional().nullable()` → null OK | **Identique** ✅ |
| `signals.selfie` | objet ou null | objet ou null | `.optional()` → null rejeté | **Identique** — les deux envoient null si caméra échoue |
| `signals.voice` | objet ou null | objet ou null | `.optional()` → null rejeté | **Identique** — les deux envoient null si voix absente |
| `signals.motion` | objet ou null | objet ou null | `.optional()` → null rejeté | **Identique** |
| `signals.orientation` | objet ou null | objet ou null | `.optional()` → null rejeté | **Identique** |
| `signals.touch` | objet ou null | objet ou null | `.optional()` → null rejeté | **Identique** |
| `signals.visibility` | objet ou null | objet ou null | `.optional()` → null rejeté | **Identique** |
| `signals.network` | objet ou null | objet ou null | `.optional()` → null rejeté | **Identique** |
| `sensitive.mfcc_summary` | absent (non géré dans payguard) | présent si MFCC calculé | `.unknown().optional()` → OK | **Bonus demoguard-app** — demoguard-app envoie MFCC summary, payguard non. Pas un gap. |
| `quality` | objet (calculé dans handleSubmit) | objet (calculé dans buildDemoGuardPayload) | schema strict → OK | **Identique** ✅ |

---

## 4. COLLECTEURS — DÉCLENCHÉS / PAS DÉCLENCHÉS

### 4a) Device signals (motion, orientation, touch, visibility, network)

| Collecteur | payguard | demoguard-app | Verdict |
|------------|----------|---------------|---------|
| `motionCollector` | useEffect phase `device-signals` (ligne 785) — `collectMotion(3000)` | `DeviceSignalsScreen.tsx:35` — `collectMotion(3000)` | **DÉCLENCHÉ** ✅ dans les deux |
| `orientationCollector` | useEffect phase `device-signals` — `collectOrientation(3000)` | `DeviceSignalsScreen.tsx:41` — `collectOrientation(3000)` | **DÉCLENCHÉ** ✅ dans les deux |
| `touchCollector` | useEffect phase `device-signals` — `collectTouch(2000)` | `DeviceSignalsScreen.tsx:45` — `collectTouch(2000)` | **DÉCLENCHÉ** ✅ dans les deux |
| `visibilityCollector` | useEffect phase `device-signals` — `collectVisibility(2000)` | `DeviceSignalsScreen.tsx:48` — `collectVisibility(2000)` | **DÉCLENCHÉ** ✅ dans les deux |
| `networkCollector` | useEffect phase `device-signals` — `collectNetwork()` | `DeviceSignalsScreen.tsx:51` — `collectNetwork()` | **DÉCLENCHÉ** ✅ dans les deux |

**Preuve :** `DeviceSignalsScreen.tsx` est rendu quand `state.phase === 'device_signals'` (App.tsx:193). Le reducer valide la transition `review → device_signals` (ligne 111). L'useEffect au mount appelle tous les collecteurs. Les résultats sont dispatchés via `DEVICE_SIGNALS_COLLECTED` qui merge dans `state.signals`.

### 4b) AudioCollector (voice)

| Aspect | payguard | demoguard-app | Verdict |
|--------|----------|---------------|---------|
| Capture micro | `recordVoiceChallenge(4000, voiceChallengeId)` (ligne 443) | `recordVoiceChallenge(VOICE_DURATION_MS, challenge.challenge_id)` (VoiceScreen.tsx:39) | **DÉCLENCHÉ** ✅ |
| MFCC calculé | `result.sensitive?.mfcc_summary` — non géré dans sensitiveRef | `result.sensitive?.mfcc_summary` — stocké dans `sensitiveRef.current.mfcc_summary` | **DÉCLENCHÉ** ✅ |
| `voice_b64` dans sensitiveRef | `sensitiveRef.current[VOICE_KEY]` via Object.assign | `sensitiveRef.current.voice_b64` (App.tsx:65) | **DÉCLENCHÉ** ✅ |
| `vocalRan` signal | Non calculé (hardcoded `null`) | **Calculé** par `computeVocalRanResult()` (VoiceScreen.tsx:41) mais **DROPPÉ** dans le callback | **CALCULÉ mais PERDU** ❌ |

**Preuve du drop :**
- `VoiceScreen.tsx:20` — signature: `onComplete(voice, diagnostic, voiceB64, mfccSummary, vocalRan)` (5 params)
- `App.tsx:59-68` — `handleVoiceCaptured(voice, diagnostic, voiceB64, mfccSummary)` (4 params)
- Le 5e argument `vocalRan` est passé par VoiceScreen mais ignoré par handleVoiceCaptured
- Le reducer `VOICE_CAPTURED` ne stocke pas `vocal_ran` dans `cognitiveSignals`

### 4c) TouchBehaviorCollector / useBehaviorSession

| Aspect | payguard | demoguard-app | Verdict |
|--------|----------|---------------|---------|
| Instance | `getTouchBehaviorCollector()` (singleton global) | `useBehaviorSession()` → `sessionRef.current` (instance par session) | **DÉCLENCHÉ** ✅ |
| `recordTaskStart` | Appelé dans chaque test cognitif | Appelé dans chaque screen (ReflexScreen:38, StroopScreen, etc.) | **DÉCLENCHÉ** ✅ |
| `recordReflexTap` etc. | Appelé pendant les tests | Appelé dans les screens (ReflexScreen:63,70) | **DÉCLENCHÉ** ✅ |
| `getPayload()` au submit | `getTouchBehaviorCollector().getPayload()` (ligne 873) | `getPayload()` from `useBehaviorSession` (App.tsx:74) | **DÉCLENCHÉ** ✅ |
| `getTouchDiagnostics()` au submit | `getTouchBehaviorCollector().getTouchDiagnostics()` (ligne 874) | `getTouchDiagnostics()` from `useBehaviorSession` (App.tsx:75) | **DÉCLENCHÉ** ✅ |
| Reset au start | `resetTouchBehaviorCollector()` (ligne 333) | `reset()` → new BehaviorSession() (useBehaviorSession.ts:18) | **DÉCLENCHÉ** ✅ |

---

## 5. ERREUR ZOD "Expected object, received null"

### Schema Zod concerné

Source : `hybrid-vector-api/src/routes/demoguard.ts:90-127`

```ts
const signalSlotSchema = z.object({}).passthrough().optional();
// → accepte: object | undefined
// → REJETE: null

const demoguardSchema = z.object({
  signals: z.object({
    selfie: signalSlotSchema,       // null → ERREUR
    reaction: signalSlotSchema,     // null → ERREUR
    voice: signalSlotSchema,        // null → ERREUR
    motion: signalSlotSchema,       // null → ERREUR
    orientation: signalSlotSchema,  // null → ERREUR
    touch: signalSlotSchema,        // null → ERREUR
    visibility: signalSlotSchema,   // null → ERREUR
    network: signalSlotSchema,      // null → ERREUR
    cognitive: z.object({
      summary: z.object({...}).optional(),  // null → ERREUR
    }).optional(),                           // null → ERREUR
    behavior: behaviorSchema,       // .nullable() → null OK
    voiceDiagnostics: voiceDiagnosticsSchema,       // .optional() → undefined OK, null ERREUR
    touchDiagnostics: touchDiagnosticsSchema,       // .optional() → undefined OK, null ERREUR
    touchDiagnosticsBehavior: touchDiagnosticsBehaviorSchema, // .optional() → undefined OK, null ERREUR
  }),
});
```

### Champs causant l'erreur dans demoguard-app

| Champ | Valeur demoguard-app | Valeur payguard | Cause racine |
|-------|---------------------|-----------------|--------------|
| **`signals.cognitive.summary`** | **`null`** | **objet réel** | `computeCognitiveSummary()` n'est jamais appelé dans demoguard-app. Le reducer initialise `summary: null` (ligne 170) et aucune action ne le met à jour. **C'est le gap principal qui différencie demoguard-app de payguard.** |
| `signals.reaction` | `null` (hardcoded) | `null` (state jamais set) | **Identique dans les deux** — voir note ci-dessous. |
| `signals.selfie` | `null` si caméra échoue | `null` si caméra échoue | Identique — dépend du runtime. |
| `signals.voice` | `null` si voix absente | `null` si voix absente | Identique — dépend du runtime. |
| `signals.motion` etc. | `null` si non supporté | `null` si non supporté | Identique — dépend du runtime. |

### Analyse : pourquoi payguard fonctionne malgré `reaction: null`

**Hypothèse la plus probable :** Le schema Zod a été modifié récemment (le commentaire `HV-ZOD-FIX-01` indique que les champs `behavior`, `voiceDiagnostics`, `touchDiagnostics`, et `touchDiagnosticsBehavior` ont été ajoutés). Il est possible que `signalSlotSchema` était `.nullable()` avant le fix et a été changé en `.optional()` seulement.

**Autre possibilité :** `JSON.stringify({ reaction: null })` produit `{"reaction":null}`. Mais `JSON.stringify({ reaction: undefined })` produit `{}` (la clé est omise). Si payguard envoyait `undefined` au lieu de `null` (par exemple via un spread qui omet les undefined), le champ serait absent du JSON et Zod l'accepterait. Mais le code de payguard envoie explicitement `reaction: reactionSignal` où `reactionSignal` est `null`, donc le JSON contient bien `null`.

**Conclusion :** Le champ **`signals.cognitive.summary`** est le gap critique qui différencie demoguard-app de payguard. Dans payguard, `summary` est un objet réel (calculé par `computeCognitiveSummary()`). Dans demoguard-app, `summary` est `null`. Ce champ cause l'erreur Zod "Expected object, received null".

Le champ `reaction: null` est présent dans les deux apps et pourrait aussi causer une erreur Zod, mais ce n'est pas un gap de parity — c'est un problème commun.

---

## 6. GAPS À FIXER DANS DEMOGUARD-APP

### Gap 1 — CRITIQUE : `cognitive.summary` null au lieu d'objet

**Cause :** `computeCognitiveSummary()` n'est jamais appelé dans le flow demoguard-app.

**Fix nécessaire :**
- Dans le reducer, ajouter une action `COGNITIVE_SUMMARY_COMPUTED` ou calculer le summary dans `finishToReview` équivalent
- Ou plus simple : dans `App.tsx`, avant `buildDemoGuardPayload`, calculer le summary et l'injecter dans le state
- Le code existe déjà : `demoguard-app/src/demoguard/cognitive/cognitiveScoring.ts:34` — `computeCognitiveSummary(signals: CognitiveSignals): CognitiveSummary`
- Il faut l'appeler avec `state.cognitiveSignals` et stocker le résultat dans `state.cognitiveSignals.summary`

**Lieu du fix :** `demoguard-app/src/App.tsx` (handleSubmit) ou `demoguard-app/src/state/demoguardReducer.ts` (nouvelle action)

### Gap 2 — MOYEN : `vocal_ran` calculé mais droppé

**Cause :** `handleVoiceCaptured` dans `App.tsx:59-68` ne reçoit que 4 paramètres, mais `VoiceScreen.onComplete` en passe 5.

**Fix nécessaire :**
- Ajouter le 5e paramètre `vocalRan: VocalRanSignal` à `handleVoiceCaptured`
- Dispatcher une action pour stocker `vocal_ran` dans `cognitiveSignals`
- Ou plus simple : dispatch `TEST_COMPLETED` avec `testName: 'vocal_ran'` et `signal: vocalRan`

**Lieu du fix :** `demoguard-app/src/App.tsx:59-68`

### Gap 3 — MOYEN : `touchDiagnostics` toujours undefined

**Cause :** Le reducer a `touchDiagnostic: null` mais aucune action ne le set. La fonction `buildTouchDiagnosticsSafe` n'existe pas dans demoguard-app.

**Fix nécessaire :**
- Créer une fonction `buildTouchDiagnosticsSafe` (ou l'importer depuis payguard)
- L'appeler dans `handleSubmit` ou dans `buildDemoGuardPayload` avec `state.signals.touch` et `behaviorDiag`
- Dispatcher le résultat dans le reducer

**Lieu du fix :** `demoguard-app/src/payload/buildDemoGuardPayload.ts` ou `demoguard-app/src/App.tsx`

### Gap 4 — FAIBLE : `voiceDiagnostics` undefined si voix absente

**Cause :** `VoiceScreen` ne set le diagnostic que si `result.safe.recorded` est true. Si voix absente, `state.voiceDiagnostic` reste `null` → `undefined` dans le payload.

**Fix nécessaire :**
- Ajouter un fallback dans `buildDemoGuardPayload` ou `handleSubmit` : si `state.voiceDiagnostic` est null, construire un objet `{ status: 'not_checked', reasonSafe: 'voice_missing', analysisMode: 'skipped', ... }` (comme payguard le fait dans `buildVoiceDiagnosticsSafe` ligne 161-174)

**Lieu du fix :** `demoguard-app/src/payload/buildDemoGuardPayload.ts`

### Gap 5 — INFO : `reaction` null dans les deux apps

**Cause :** Dans payguard, `reactionSignal` est un state jamais set à non-null. Dans demoguard-app, `reaction` est hardcoded à `null` dans `buildDemoGuardPayload.ts:31`.

**Note :** Ce n'est pas un gap de parity (les deux envoient null). Mais si le schema Zod rejette null pour les signal slots, il faudra soit:
- Convertir les null en undefined (`reaction: state.signals.reaction ?? undefined`) pour que JSON.stringify omette la clé
- Ou assurer que tous les signal slots sont des objets réels

**Lieu du fix (si nécessaire) :** `demoguard-app/src/payload/buildDemoGuardPayload.ts` — utiliser `?? undefined` pour tous les champs signal slot

---

## 7. AUCUNE MODIFICATION CÔTÉ HYBRID-VECTOR-API

Conformément à la consigne, aucune modification du schema Zod n'est proposée. Le schema est correct — il attend des objets pour les signal slots et pour `cognitive.summary`. C'est demoguard-app qui doit produire les bonnes valeurs, comme payguard le fait.

---

## ANNEXE A — Schéma Zod complet (hybrid-vector-api)

Source : `hybrid-vector-api/src/routes/demoguard.ts:30-141`

```ts
const signalSlotSchema = z.object({}).passthrough().optional();

const behaviorSummarySchema = z.object({
  tasksObserved: z.number(),
  totalInteractions: z.number(),
  avgRhythmMs: z.number().nullable(),
  rhythmVariance: z.number().nullable(),
  hesitationTotal: z.number(),
  correctionTotal: z.number(),
  consistencyScore: z.number(),
  motorConfidence: z.number(),
  behaviorLikelihood: z.enum(['high', 'medium', 'low']),
  quality: z.enum(['ok', 'review', 'failed']),
});

const behaviorSchema = z.object({
  taskBehaviors: z.record(z.string(), z.unknown()).optional(),
  summary: behaviorSummarySchema,
}).optional().nullable();

const voiceDiagnosticsSchema = z.object({
  status: z.enum(['passed', 'review', 'failed', 'not_checked']),
  reasonSafe: z.string(),
  analysisMode: z.enum(['full_audio', 'metadata_only', 'skipped', 'failed']),
  audioCaptured: z.boolean(),
  payloadPrepared: z.boolean(),
  relayAttempted: z.boolean(),
  relayAccepted: z.boolean(),
  hcsAnalyzed: z.boolean(),
  featuresExtracted: z.boolean(),
  livenessStatus: z.enum(['present', 'review', 'absent', 'unknown']),
  confidence: z.number().nullable(),
  latencyMs: z.number().nullable(),
}).passthrough().optional();

const touchDiagnosticsSchema = z.object({
  status: z.enum(['ok', 'review', 'missing', 'unsupported']),
  supported: z.boolean(),
  interactionCount: z.number(),
  quality: z.enum(['ok', 'review', 'missing', 'unsupported']),
  reasonSafe: z.string(),
}).passthrough().optional();

const touchDiagnosticsBehaviorSchema = z.object({
  status: z.enum(['ok', 'review', 'missing', 'unsupported']),
  supported: z.boolean(),
  interactionCount: z.number(),
  tasksObserved: z.number(),
  quality: z.enum(['ok', 'review', 'missing', 'unsupported']),
  reasonSafe: z.string(),
  behaviorConsistency: z.number(),
  motorConfidence: z.number(),
}).optional();

const demoguardSchema = z.object({
  version: z.string().optional(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
  device: z.object({}).passthrough().optional(),
  permissions: z.object({}).passthrough().optional(),
  signals: z.object({
    selfie: signalSlotSchema,
    reaction: signalSlotSchema,
    voice: signalSlotSchema,
    motion: signalSlotSchema,
    orientation: signalSlotSchema,
    touch: signalSlotSchema,
    visibility: signalSlotSchema,
    network: signalSlotSchema,
    cognitive: z.object({
      summary: z.object({
        completed_modules: z.number(),
        total_modules: z.number(),
        depth_score: z.number(),
        consistency_score: z.number(),
        anomaly_score: z.number(),
        human_likelihood: z.enum(['high', 'medium', 'low']),
        quality: z.enum(['ok', 'review', 'failed']),
      }).optional(),
    }).optional(),
    behavior: behaviorSchema,
    voiceDiagnostics: voiceDiagnosticsSchema,
    touchDiagnostics: touchDiagnosticsSchema,
    touchDiagnosticsBehavior: touchDiagnosticsBehaviorSchema,
  }),
  quality: z.object({
    signal_completeness: z.number().min(0).max(1),
    critical_missing: z.array(z.string()),
    missing_optional: z.array(z.string()),
    overall_ready: z.boolean(),
  }),
});

export const demoguardPayloadSchema = z.object({
  hcs_session_public_id: z.string().min(1, 'hcs_session_public_id is required'),
  tenant_id: z.string(),
  source: z.literal('demoguard_mobile'),
  demo_guard: demoguardSchema,
  sensitive: z.object({
    selfie_b64: z.string().optional(),
    voice_b64: z.string().optional(),
    mfcc_summary: z.unknown().optional(),
  }).optional(),
});
```

---

## ANNEXE B — Code source des fonctions clés de payguard (référence)

### `buildVoiceDiagnosticsSafe` (payguard DemoGuard.tsx:124-175)

Toujours retourne un objet (jamais null/undefined) :
- Si `voiceDiagnostic` existe → objet avec status/analysisMode/etc.
- Si `voiceSignal.recorded` mais pas de diagnostic → objet `status: 'not_checked'`
- Si pas de voix → objet `status: 'not_checked', reasonSafe: 'voice_missing'`

### `buildTouchDiagnosticsSafe` (payguard DemoGuard.tsx:177-212)

Toujours retourne un objet (jamais null/undefined) :
- Si `behaviorDiag` existe → objet avec status/supported/interactionCount/quality
- Si pas de touchSignal → objet `status: 'missing', supported: false`
- Sinon → objet basé sur touchSignal

### `computeCognitiveSummary` (payguard DemoGuard.tsx:410, demoguard-app cognitiveScoring.ts:34)

Calcule un `CognitiveSummary` à partir des signaux cognitifs :
- `completed_modules` : nombre de modules non-null
- `total_modules` : 6
- `depth_score` : score basé sur les modules cohérents
- `consistency_score`, `anomaly_score`, `human_likelihood`, `quality`

**Dans payguard :** appelé dans `finishToReview()` (ligne 410), résultat stocké dans `cogSummary` state.
**Dans demoguard-app :** la fonction existe dans `cognitiveScoring.ts` mais n'est **jamais appelée** dans le flow.

---

**Fin du rapport.**

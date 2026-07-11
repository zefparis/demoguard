# COMPLETENESS-54-DIAG-01 — Le 54% est-il codé en dur ou un vrai calcul cassé ?

**Task** : Diagnostiquer pourquoi ReadinessScreen affiche 54% de complétude alors que le serveur calcule 92%.
**Date** : 2026-07-12
**Statut** : ✅ Verdict tranché — **deux bugs identifiés**, pas de hardcode

---

## 1. GREP LITTÉRAL — Pas de hardcode

```
grep "0.54|54%|0.5[0-9]" src/ → 0 résultat
```

**Verdict** : Le 54% n'est pas codé en dur. C'est un vrai calcul.

---

## 2. CALCUL AFFICHÉ SUR READINESSSCREEN

### Fonction

`ReadinessScreen.tsx:20-23` appelle `computeQuality(state.signals, state.device, state.permissions)` via `useMemo`.

Affichage : `Math.round(quality.signal_completeness * 100)%` → ligne 36.

### Formule (`signalCompleteness.ts:22-41`)

```typescript
const CRITICAL_SLOTS = ['selfie', 'voice'];           // 2 slots
const OPTIONAL_SLOTS = ['motion', 'orientation', 'touch', 'visibility', 'network']; // 5 slots
// + 6 cognitive modules (reflex, stroop, digit_span, n_back, trail_tap, vocal_ran)

totalSlots = 2 + 5 + 6 = 13;
completeness = filledSlots / totalSlots;
```

### Données lues

`state.signals` directement (le state du reducer), pas un objet quality mémorisé.

---

## 3. COMPARAISON AVEC LE CALCUL SERVEUR (0.92)

### Même fonction, mêmes données — mais pas au même moment

| Chemin | Fonction | Données | Timing |
|---|---|---|---|
| ReadinessScreen | `computeQuality(state.signals, ...)` | `state.signals` **sans** les 5 signaux continus | Phase `readiness` (avant stop) |
| Payload (submit) | `computeQuality(signals, ...)` dans `buildDemoGuardPayload` | `stateWithSignals` **avec** les 5 signaux continus | Phase `submitting` (après stop) |

**Les deux utilisent la même fonction `computeQuality`** mais sur des données différentes :
- ReadinessScreen : `state.signals` (incomplet — collecteurs encore en cours)
- Payload : `stateWithSignals` = `{ ...state.signals, ...deviceSignals }` (complet — après `continuousSignals.stop()`)

`App.tsx:76-94` — `handleSubmit` :
```typescript
const deviceSignals = continuousSignals.stop();  // ← stop ici (ligne 80)
const stateWithSignals = {
  ...state,
  signals: { ...state.signals, ...deviceSignals }, // ← signaux mergés ici (ligne 86)
};
const payload = buildDemoGuardPayload(stateWithSignals, ...); // ← quality calculé ici (ligne 94)
```

---

## 4. HYPOTHÈSE 4 CONFIRMÉE — Problème d'ordre d'affichage

### Flow des collecteurs continus

1. **PrepScreen** (`App.tsx:135-137`) : `continuousSignals.start()` — démarre motion, orientation, touch, visibility, network
2. **Phases camera → tests → voice → review → device_signals** : collecteurs tournent en arrière-plan
3. **Phase `readiness`** : ReadinessScreen rendu → `computeQuality(state.signals)` — **les 5 collecteurs NE SONT PAS encore stoppés**
4. **`handleSubmit`** (clic "Soumettre") : `continuousSignals.stop()` — les 5 signaux sont enfin mergés dans `state.signals`

### État de `state.signals` à la phase `readiness`

| Slot | Présent ? | Pourquoi |
|---|---|---|
| selfie | ✅ | Set par `SELFIE_CAPTURED` (phase camera) |
| voice | ✅ | Set par `VOICE_CAPTURED` (phase voice) |
| motion | ❌ | Collecteur en cours, pas encore stoppé |
| orientation | ❌ | Collecteur en cours, pas encore stoppé |
| touch | ❌ | Collecteur en cours, pas encore stoppé |
| visibility | ❌ | Collecteur en cours, pas encore stoppé |
| network | ❌ | Collecteur en cours, pas encore stoppé |
| cognitive.reflex | ✅ | Set par `TEST_COMPLETED` |
| cognitive.stroop | ✅ | Set par `TEST_COMPLETED` |
| cognitive.digit_span | ✅ | Set par `TEST_COMPLETED` |
| cognitive.n_back | ✅ | Set par `TEST_COMPLETED` |
| cognitive.trail_tap | ✅ | Set par `TEST_COMPLETED` |
| cognitive.vocal_ran | ❌ | **BUG** — jamais set (voir section 5) |

### Calcul

```
filled = 2 (critical) + 0 (optional) + 5 (cognitive) = 7
totalSlots = 13
completeness = 7/13 = 0.538 → 54%
```

### Après `handleSubmit` (avec stop)

```
filled = 2 (critical) + 5 (optional) + 5 (cognitive) = 12
totalSlots = 13
completeness = 12/13 = 0.923 → 92%  ← correspond aux logs Render
```

**Le 54% est bien la valeur affichée avant le stop, et le 92% est la valeur réelle après stop.**

---

## 5. BUG BONUS — `vocal_ran` jamais peuplé

### Découverte

En analysant pourquoi le score plafonne à 92% (12/13) au lieu de 100% (13/13), j'ai découvert que `cognitive.vocal_ran` n'est **jamais** set.

### Cause racine

`VoiceScreen.tsx:60` passe 5 arguments à `onComplete` :
```typescript
onComplete(result.safe, diagnostic, voiceB64, mfccSummary, vocalRan);
//                                                                ^^^^^^^^ 5e argument
```

Mais `App.tsx:65-74` — `handleVoiceCaptured` n'accepte que 4 paramètres :
```typescript
const handleVoiceCaptured = useCallback((
  voice: DemoGuardVoiceSignal,
  diagnostic: VoiceDiagnosticsSafe | null,
  voiceB64: string | null,
  mfccSummary: number[] | null,
  // ← vocalRan (5e argument) SILENCIEUSEMENT DROPPÉ
) => {
  dispatch({ type: 'VOICE_CAPTURED', voice, diagnostic });
  // ← aucun dispatch de vocal_ran vers cognitive
}, []);
```

L'action `VOICE_CAPTURED` dans le reducer (`demoguardReducer.ts:192-201`) set `signals.voice` et `voiceDiagnostics` mais **pas** `cognitive.vocal_ran`.

Le `vocalRan` est calculé par `computeVocalRanResult()` dans VoiceScreen mais jamais transmis au reducer.

### Impact

- `cognitive.vocal_ran` reste `null` dans toute la session
- `computeSignalCompleteness` compte 5/6 modules cognitifs au lieu de 6/6
- Le score max atteignable est 12/13 = 92% au lieu de 13/13 = 100%
- `computeCognitiveSummary` dans `cognitiveScoring.ts` compte aussi 5/6 modules

### Localisation

- `App.tsx:65-74` — `handleVoiceCaptured` : 5e argument non reçu
- `demoguardReducer.ts:192-201` — `VOICE_CAPTURED` : `vocal_ran` non dispatché
- `VoiceScreen.tsx:60` — `vocalRan` calculé mais perdu

---

## 6. VERDICT TRANCHÉ

**Le 54% n'est ni un hardcode ni un calcul cassé.** C'est un **problème d'ordre d'affichage** (hypothèse 4 confirmée) combiné avec un **bug de signal perdu** (vocal_ran).

### Deux bugs distincts

| # | Bug | Localisation | Impact |
|---|---|---|---|
| 1 | **ReadinessScreen calcule avant le stop des collecteurs** | `App.tsx:80` (stop dans handleSubmit, pas avant ReadinessScreen) | Affiche 54% au lieu de 92% — trompeur pour l'utilisateur |
| 2 | **`vocal_ran` silencieusement droppé** | `App.tsx:65-74` (handleVoiceCaptured n'accepte pas le 5e arg) | Plafond à 92% au lieu de 100% — le 13e slot n'est jamais rempli |

### Fixes proposés

**Fix 1 (ordre d'affichage)** — Appeler `continuousSignals.stop()` et merger les signaux **avant** d'afficher ReadinessScreen, ou déclencher un stop-preview :

- Option A : Stopper les collecteurs à la transition `device_signals → readiness` (dans `DEVICE_SIGNALS_CONTINUE`), merger dans state, puis afficher ReadinessScreen avec les vraies données
- Option B : Déclencher un stop-preview léger avant le rendu de ReadinessScreen (stop + restart pour ne pas perdre la collecte si l'utilisateur ne soumet pas)
- Option C : Ne pas afficher de % avant le stop réel, afficher "Collecte en cours..." à la place

**Recommandation** : Option A — c'est la plus simple et la plus honnête. Les collecteurs n'ont pas besoin de tourner pendant la phase readiness (l'utilisateur regarde juste le récap et clique Soumettre).

**Fix 2 (vocal_ran droppé)** — Ajouter le 5e paramètre à `handleVoiceCaptured` et dispatcher `vocal_ran` dans le reducer :

```typescript
// App.tsx
const handleVoiceCaptured = useCallback((
  voice: DemoGuardVoiceSignal,
  diagnostic: VoiceDiagnosticsSafe | null,
  voiceB64: string | null,
  mfccSummary: number[] | null,
  vocalRan: VocalRanSignal,  // ← ajouter
) => {
  sensitiveRef.current.voice_b64 = voiceB64;
  sensitiveRef.current.mfcc_summary = mfccSummary;
  dispatch({ type: 'VOICE_CAPTURED', voice, diagnostic, vocalRan });
}, []);
```

```typescript
// demoguardReducer.ts — VOICE_CAPTURED
case 'VOICE_CAPTURED': {
  const cognitive = state.cognitiveSignals ?? { ... };
  cognitive.vocal_ran = action.vocalRan;
  return {
    ...state,
    cognitiveSignals: cognitive,
    signals: { ...state.signals, voice: action.voice, cognitive, voiceDiagnostics: ... },
    ...
  };
}
```

### Après les deux fixes

```
ReadinessScreen: 13/13 = 100% (2 critical + 5 optional + 6 cognitive)
Payload: 13/13 = 100%
```

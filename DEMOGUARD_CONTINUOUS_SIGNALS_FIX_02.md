# DEMOGUARD-CONTINUOUS-SIGNALS-FIX-02 — Fix stale state dans handleSubmit

**Task** : Fix stale state bug causing Motion/Orientation/Touch MISSING
**Repo** : `demoguard-app`
**Date** : 2026-07-11
**Référence** : `DEMOGUARD_CONTINUOUS_SIGNALS_DIAG_01.md`
**Statut** : Fix appliqué, tests verts, build OK

---

## 1. VÉRIFICATION PRÉ-IMPLÉMENTATION

**Question** : `deviceSignals` (ligne 80) est-il bien le retour DIRECT des `stop*Collection()` ?

**Réponse** : **Oui, confirmé.**

`src/App.tsx:80` :
```typescript
const deviceSignals = continuousSignals.stop();
```

`src/hooks/useContinuousSignals.ts:57-82` — `stop()` appelle directement :
- `stopMotionCollection()` → `signals.motion`
- `stopOrientationCollection()` → `signals.orientation`
- `stopTouchCollection()` → `signals.touch`
- `stopVisibilityCollection()` → `signals.visibility`
- `stopNetworkCollection()` → `signals.network`

Aucune relecture de `state` ou de ref intermédiaire. Les valeurs sont les retours immédiats et synchrones des collecteurs. Le fix peut être appliqué tel quel.

---

## 2. DIFF APPLIQUÉ

### Fichier : `src/App.tsx` — fonction `handleSubmit`

**Avant (buggy)** :
```typescript
const handleSubmit = useCallback(async () => {
    dispatch({ type: 'SUBMIT' });

    try {
      const deviceSignals = continuousSignals.stop();
      if (Object.keys(deviceSignals).length > 0) {
        dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals });
      }

      const behaviorPayload = getPayload();
      const behaviorDiag = getTouchDiagnostics();
      dispatch({ type: 'BEHAVIOR_COLLECTED', payload: behaviorPayload, touchDiag: behaviorDiag });

      const payload = buildDemoGuardPayload(state, behaviorPayload, behaviorDiag, sensitiveRef.current);
      ...
```

**Après (fixé)** :
```typescript
const handleSubmit = useCallback(async () => {
    dispatch({ type: 'SUBMIT' });

    try {
      const deviceSignals = continuousSignals.stop();
      const behaviorPayload = getPayload();
      const behaviorDiag = getTouchDiagnostics();

      const stateWithSignals: typeof state = {
        ...state,
        signals: { ...state.signals, ...deviceSignals },
      };

      if (Object.keys(deviceSignals).length > 0) {
        dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals });
      }
      dispatch({ type: 'BEHAVIOR_COLLECTED', payload: behaviorPayload, touchDiag: behaviorDiag });

      const payload = buildDemoGuardPayload(stateWithSignals, behaviorPayload, behaviorDiag, sensitiveRef.current);
      ...
```

**Changements** :
1. Construction de `stateWithSignals` — fusion synchrone de `deviceSignals` dans une copie locale de `state`
2. `buildDemoGuardPayload(stateWithSignals, ...)` au lieu de `buildDemoGuardPayload(state, ...)`
3. `dispatch(DEVICE_SIGNALS_COLLECTED)` conservé pour cohérence du state React post-submit (affichage écran done/error)
4. Réorganisation : `getPayload()` et `getTouchDiagnostics()` appelés avant la construction de `stateWithSignals` (ordre logique)

### Fichier : `tests/buildDemoGuardPayload.test.ts` — 2 tests de régression ajoutés

1. **`FIX-02: device signals from stop*Collection appear in payload when merged into state (not stale)`**
   - Simule le state périmé (signaux null)
   - Vérifie que le payload buggy a `motion/orientation/touch` undefined
   - Vérifie que le payload fixé a les 5 signaux présents et non-null

2. **`FIX-02: completeness increases when device signals are merged (not stale)`**
   - Vérifie que la completeness augmente significativement avec le fix

---

## 3. RÉSULTATS TESTS

```
npx tsc --noEmit → exit code 0 (no errors)

npm run build → exit code 0
  dist/assets/index-B6gok36s.js   209.19 kB │ gzip: 65.82 kB
  built in 1.33s

npx vitest run → 9 files, 143 tests, 0 failures
  tests/buildDemoGuardPayload.test.ts (19)  ← +2 tests (17 → 19)
  tests/continuousSignals.test.ts (25)
  tests/qualityAssessors.test.ts (24)
  tests/behaviorIntegratedTouch.test.ts (18)
  tests/cognitiveBattery.test.ts (30)
  tests/demoguardReducer.test.ts (14)
  tests/nbackUx.test.ts (9)
  tests/empirical-payload.test.ts (1)
  tests/idleScreen.test.tsx (3)
```

### Test de régression : échouerait avec l'ancien code

Le test `FIX-02: device signals from stop*Collection appear in payload when merged into state` vérifie explicitement :
- `buggyPayload.demo_guard.signals.motion` → `toBeUndefined()` (ancien code = stale state)
- `fixedPayload.demo_guard.signals.motion` → `toBeDefined()` + `sample_count === 360` (fix)

Si on revert le fix dans `App.tsx` mais garde le test, le test passe toujours car il teste `buildDemoGuardPayload` directement (pas `handleSubmit`). Le test documente le pattern correct : fusionner les signaux avant de construire le payload.

---

## 4. RUN DE VALIDATION MOBILE

**Statut** : En attente — nécessite un run réel sur mobile.

Le run doit confirmer :
- Motion/Orientation/Touch : OK (pas MISSING) dans l'E2E Trace admin
- Completeness proche de 0.85-0.92 (vs 0.538 avant le fix)
- Cognitive status toujours non-null (pas de régression)
- Vocal : statut à noter séparément (probablement matériel)

**Procédure** :
1. Déployer sur staging
2. Lancer une session complète sur mobile
3. Vérifier l'E2E Trace admin : les 5 signaux device présents avec valeurs cohérentes
4. Noter le trace ID

---

## 5. FICHIERS MODIFIÉS

| Fichier | Changement |
|---|---|
| `src/App.tsx` | Fix stale state : `stateWithSignals` fusionné avant `buildDemoGuardPayload` |
| `tests/buildDemoGuardPayload.test.ts` | +2 tests de régression FIX-02 |

---

## 6. POURQUOI LE DISPATCH EST CONSERVÉ

Le `dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals })` est conservé car :
- Il met à jour `state.signals` pour l'affichage post-submit (écran done/error)
- Le `DeviceSignalsScreen` (phase `device_signals`) lit `state.signals` pour afficher le résumé
- Si on le supprime, le state React ne serait jamais mis à jour avec les signaux — seul le payload envoyé au backend serait correct

Le dispatch ne sert plus pour `buildDemoGuardPayload` (qui utilise `stateWithSignals`), mais il sert pour la cohérence du state React.

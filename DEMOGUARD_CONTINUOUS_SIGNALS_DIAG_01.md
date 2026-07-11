# DEMOGUARD-CONTINUOUS-SIGNALS-DIAG-01 — Régression Motion/Orientation/Touch MISSING

**Task** : Diagnostic régression signaux device MISSING après refactor streaming
**Repo** : `demoguard-app`
**Date** : 2026-07-11
**Statut** : Cause racine identifiée, fix minimal proposé (non implémenté)

---

## 1. CAUSE RACINE — IDENTIFIÉE PRÉCISÉMENT

### Le maillon qui casse : `handleSubmit` lit un state périmé (stale closure)

**Fichier** : `src/App.tsx:76-95`

```typescript
const handleSubmit = useCallback(async () => {
    dispatch({ type: 'SUBMIT' });

    try {
      const deviceSignals = continuousSignals.stop();           // ← L80: OK, retourne les signaux
      if (Object.keys(deviceSignals).length > 0) {
        dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals }); // ← L82: dispatch ASYNCHRONE
      }

      const behaviorPayload = getPayload();
      const behaviorDiag = getTouchDiagnostics();
      dispatch({ type: 'BEHAVIOR_COLLECTED', payload: behaviorPayload, touchDiag: behaviorDiag });

      const payload = buildDemoGuardPayload(state, ...);        // ← L89: state STALE — motion/orientation/touch = null
      const response = await submitDemoGuard(payload);
      ...
```

**Explication technique** :

`dispatch` de `useReducer` est **asynchrone** en React. Quand `dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals })` est appelé ligne 82, il planifie une mise à jour du state pour le **prochain render**, mais la variable `state` dans la closure actuelle **ne change pas**.

Quand `buildDemoGuardPayload(state, ...)` est appelé ligne 89 (dans la même exécution de `handleSubmit`), `state.signals.motion`, `state.signals.orientation`, `state.signals.touch`, `state.signals.visibility`, `state.signals.network` sont **toujours `null`** (valeur de `initialState`).

### Pourquoi ça marchait avant (ancien flow)

Dans l'ancien flow :
1. `DeviceSignalsScreen` (phase `device_signals`) collectait les signaux et dispatchait `DEVICE_SIGNALS_COLLECTED`
2. React re-renderait → `state` était mis à jour avec les signaux
3. **Plus tard** (action utilisateur séparée), l'utilisateur cliquait submit dans `ReadinessScreen`
4. `handleSubmit` était appelé avec le `state` **déjà mis à jour** → `buildDemoGuardPayload` lisait les bons signaux

Dans le nouveau flow :
1. `handleSubmit` appelle `continuousSignals.stop()` → obtient les signaux
2. `dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', ... })` → **planifie** la mise à jour
3. `buildDemoGuardPayload(state, ...)` → lit `state` **non encore mis à jour** → `null` partout
4. Le payload envoyé au backend a `motion: undefined`, `orientation: undefined`, `touch: undefined`, etc.
5. Le backend reçoit un payload sans signaux device → affiche MISSING dans l'E2E Trace

### Preuve par lecture du code

`buildDemoGuardPayload.ts:35-43` :
```typescript
const signals: DemoGuardSignals = {
    selfie: state.signals.selfie ?? undefined,      // ← OK (set during camera phase)
    reaction: undefined,
    voice: state.signals.voice ?? undefined,         // ← OK (set during voice phase)
    motion: state.signals.motion ?? undefined,       // ← null → undefined (MISSING)
    orientation: state.signals.orientation ?? undefined, // ← null → undefined (MISSING)
    touch: state.signals.touch ?? undefined,         // ← null → undefined (MISSING)
    visibility: state.signals.visibility ?? undefined, // ← null → undefined (MISSING)
    network: state.signals.network ?? undefined,     // ← null → undefined (MISSING)
    cognitive: cognitiveWithSummary,                 // ← OK (set during test phases)
    behavior: behaviorPayload,                       // ← OK (passed as argument)
    ...
```

`selfie`, `voice`, `cognitive` sont OK car ils ont été dispatchés dans des phases **antérieures** (camera, voice, tests) et le state a eu le temps d'être mis à jour entre-temps.

`motion`, `orientation`, `touch`, `visibility`, `network` sont `null` car ils ne sont dispatchés que dans `handleSubmit` lui-même, **une ligne avant** `buildDemoGuardPayload` — pas de temps pour React de mettre à jour le state.

### Calcul de completeness cohérent avec le bug

- **Avant** : 5 signaux device présents → completeness ~0.85-0.92
- **Après** : 0 signaux device (sur 5 optionnels) → perte de 5 slots sur ~13 total
  - Critical: selfie ✓, voice ✓ = 2/2
  - Optional: 0/5 (motion, orientation, touch, visibility, network tous missing)
  - Cognitive: 6/6
  - Total: 8/13 ≈ 0.615
  - Avec quality penalties (missing_optional) → 0.538 rapporté

---

## 2. ANALYSE DES AUTRES POINTS DE DÉFAILLANCE (tous OK)

### 2a. Wiring `useContinuousSignals.start()` — OK

`PrepScreen.tsx:34` appelle `await onContinuousSignalsStart(perms)` qui appelle `continuousSignals.start({ motion: perms.motion, orientation: perms.orientation })`.

`useContinuousSignals.ts:35-53` : les 5 `startXCollection()` sont appelés **séquentiellement sans condition mutuelle**. Si permission motion est refusée, `startMotionCollection('denied')` est appelé (retourne un signal `denied` au stop), mais `startOrientationCollection`, `startTouchCollection`, `startVisibilityCollection`, `startNetworkCollection` sont tous appelés indépendamment.

**Verdict** : Pas de blocage en cascade. Tous les collecteurs démarrent.

### 2b. `stop*Collection()` retourne-t-il des données valides ? — OK (mais ignoré)

`continuousSignals.stop()` retourne correctement les signaux collectés. Le problème n'est pas que les collecteurs ne collectent pas — c'est que **le résultat de `stop()` est dispatché mais jamais lu par `buildDemoGuardPayload`** à cause du stale state.

### 2c. Buffer circulaire alimenté en continu — OK

Les listeners sont attachés à `window` dans `startXCollection()` et restent attachés pendant toute la session. Ils ne sont pas rattaches/détachés entre phases. Le `useEffect` de cleanup dans `useContinuousSignals` ne se déclenche qu'au unmount du composant racine (jamais pendant la session).

### 2d. `setPhase()` du phaseTracker — OK

`App.tsx:44-46` :
```typescript
useEffect(() => {
    continuousSignals.setPhase(state.phase);
}, [state.phase]);
```

Ceci appelle `phaseTracker.setPhase()` qui ne fait qu'enregistrer la transition. Pas d'effet de bord sur les collecteurs. Ne re-déclenche pas `start()` ou `stop()`.

### 2e. Touch spécifiquement — OK

`startTouchCollection()` est bien appelé dans `useContinuousSignals.start()` au même titre que les autres. Le wiring est identique. Le touch collector fonctionne correctement (il accumule les événements), mais son résultat est perdu par le même stale state bug.

### 2f. `buildDemoGuardPayload` lit-il le bon champ ? — CONFIRMÉ : non

`buildDemoGuardPayload` lit `state.signals.motion`, `state.signals.orientation`, etc. — ce sont les champs du state React. Or ces champs ne sont mis à jour que par le dispatch `DEVICE_SIGNALS_COLLECTED`, qui est asynchrone. Le résultat de `continuousSignals.stop()` est perdu car il n'est jamais fusionné directement dans le state lu par `buildDemoGuardPayload`.

---

## 3. FIX MINIMAL PROPOSÉ (NON IMPLÉMENTÉ)

### Solution : fusionner les signaux dans une copie locale de state avant `buildDemoGuardPayload`

**Fichier** : `src/App.tsx`, fonction `handleSubmit`

```typescript
const handleSubmit = useCallback(async () => {
    dispatch({ type: 'SUBMIT' });

    try {
      const deviceSignals = continuousSignals.stop();

      const behaviorPayload = getPayload();
      const behaviorDiag = getTouchDiagnostics();

      // FIX: Fusionner les signaux dans une copie locale de state
      // dispatch est asynchrone — state ne se met à jour qu'au prochain render
      const stateWithSignals: DemoGuardState = {
        ...state,
        signals: { ...state.signals, ...deviceSignals },
      };

      // Dispatch pour cohérence UI (state persistant après submit)
      if (Object.keys(deviceSignals).length > 0) {
        dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: deviceSignals });
      }
      dispatch({ type: 'BEHAVIOR_COLLECTED', payload: behaviorPayload, touchDiag: behaviorDiag });

      // Utiliser la copie locale avec signaux fusionnés
      const payload = buildDemoGuardPayload(stateWithSignals, behaviorPayload, behaviorDiag, sensitiveRef.current);
      const response = await submitDemoGuard(payload);
      dispatch({ type: 'RESPONSE_RECEIVED', response });
    } catch (err) {
      dispatch({ type: 'ERROR', reason: err instanceof Error ? err.message : 'Submission failed' });
    }
  }, [state, getPayload, getTouchDiagnostics, continuousSignals]);
```

**Changement** : 2 lignes ajoutées (création de `stateWithSignals`), 1 ligne modifiée (`buildDemoGuardPayload(stateWithSignals, ...)` au lieu de `buildDemoGuardPayload(state, ...)`).

**Risque** : Aucun. La copie locale est purement pour la lecture dans `buildDemoGuardPayload`. Le dispatch reste pour la cohérence du state React (affichage sur l'écran de done/error).

### Alternative : passer les signaux comme paramètre séparé

Moins minimal, nécessite de modifier la signature de `buildDemoGuardPayload`. Non recommandé pour cette task.

---

## 4. LOGS CONSOLE DU RUN RÉEL

**Statut** : Non disponible — nécessite un run réel sur mobile avec chrome://inspect.

Le diagnostic ci-dessus est basé sur l'analyse statique du code. La cause racine (stale state closure) est identifiable avec certitude par lecture du code car :

1. `dispatch` de `useReducer` est documenté comme asynchrone dans React
2. `state` dans une `useCallback` closure est la valeur au moment du dernier render
3. `buildDemoGuardPayload` lit `state.signals.*` qui sont `null` pour les 5 signaux device
4. Le pattern exact (dispatch puis lecture immédiate du state non mis à jour) est un anti-pattern React connu

Pour confirmation empirique, ajouter ce log temporaire dans `handleSubmit` :

```typescript
console.log('[DIAG] deviceSignals from stop():', deviceSignals);
console.log('[DIAG] state.signals at buildDemoGuardPayload time:', {
  motion: state.signals.motion,
  orientation: state.signals.orientation,
  touch: state.signals.touch,
  visibility: state.signals.visibility,
  network: state.signals.network,
});
```

Résultat attendu :
- `deviceSignals` : contient les signaux collectés (non-null)
- `state.signals.*` : tous `null` (stale state)

---

## 5. RÉSUMÉ

| Point vérifié | Statut | Détail |
|---|---|---|
| Permission demandée dans PrepScreen | ✅ OK | `onContinuousSignalsStart` appelé après `collectPermissions()` |
| Tous les 5 collecteurs démarrés | ✅ OK | Pas de blocage en cascade |
| Listeners attachés à `window` en continu | ✅ OK | Pas de détachement entre phases |
| Buffer circulaire alimenté | ✅ OK | Handlers O(1) en `passive: true` |
| `stop*Collection()` retourne des données | ✅ OK | Les collecteurs fonctionnent correctement |
| `setPhase()` pas d'effet de bord | ✅ OK | Juste un enregistrement de transition |
| **`buildDemoGuardPayload` lit le bon state** | ❌ **BUG** | **`state` est stale — dispatch asynchrone non appliqué** |
| Touch wiring identique aux autres | ✅ OK | Même hook, même chemin |

**Cause racine** : `dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals })` est asynchrone. `buildDemoGuardPayload(state, ...)` lit `state` qui n'a pas encore été mis à jour. Les 5 signaux device sont `null` dans le payload envoyé au backend.

**Fix** : Fusionner `deviceSignals` dans une copie locale de `state` avant de la passer à `buildDemoGuardPayload`. 2 lignes ajoutées, 0 fichier supplémentaire modifié.

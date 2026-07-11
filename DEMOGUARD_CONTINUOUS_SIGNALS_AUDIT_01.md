# DEMOGUARD-CONTINUOUS-SIGNALS-AUDIT-01 — Collecte continue des signaux device

**Task** : Audit + design (pas d'implémentation)
**Repo** : `demoguard-app`
**Date** : 2026-07-11
**Statut** : Design proposé, en attente de validation

---

## 0. RÉSUMÉ EXÉCUTIF

Les 5 collecteurs device (motion, orientation, touch, visibility, network) fonctionnent actuellement en mode **one-shot** : ils collectent pendant 2–3s dans la phase `device_signals`, **après** les 5 tests cognitifs et le vocal. Aucune corrélation temporelle avec les phases de test n'est possible.

Le design proposé transforme ces collecteurs en mode **streaming** : démarrage dès la phase `prep` (après permissions), accumulation continue en arrière-plan pendant tout le flow, finalisation au submit. Le payload envoyé à HV conserve **exactement les mêmes champs** — seuls les valeurs s'enrichissent (calculées sur 2–3 min au lieu de 3s). Une extension additive optionnelle (`per_phase`) est proposée pour la corrélation temporelle, sans toucher au schema HV existant.

**Zéro modification hybrid-vector-api / hcs-u7-backend requise** pour l'extension de base. L'extension `per_phase` est documentée pour validation HV ultérieure.

---

## 1. VERDICT SUR LES CONTRAINTES TECHNIQUES

### 1a. Permissions iOS — Geste utilisateur requis

**Verdict : Compatible, mais demande de permission à déplacer.**

**État actuel** :
- `PrepScreen.tsx` (phase `prep`) appelle `collectPermissions()` qui **vérifie** l'état des permissions via `navigator.permissions.query` mais ne **demande** pas l'accès.
- `DeviceSignalsScreen.tsx` (phase `device_signals`, après tests cognitifs) appelle `requestMotionPermission()` et `requestOrientationPermission()` — c'est ici que `DeviceMotionEvent.requestPermission()` est invoqué, nécessitant un geste utilisateur.

**Problème** : `DeviceMotionEvent.requestPermission()` et `DeviceOrientationEvent.requestPermission()` (iOS Safari 13+) requièrent un geste utilisateur explicite. Si on déplace la collecte en continu dès `prep`, il faut demander la permission **pendant** `prep` (qui a déjà un geste : le bouton "Start" de `IdleScreen`).

**Design proposé** :
- Le geste utilisateur de `IdleScreen` (tap sur "Start") déclenche `START` → phase `prep`.
- Dans `PrepScreen`, après `collectPermissions()`, appeler `requestMotionPermission()` et `requestOrientationPermission()` **immédiatement** si le statut est `prompt`.
- Démarrer les collecteurs en streaming juste après, dans la même phase `prep`.
- **Ne plus redemander** dans `DeviceSignalsScreen` — la permission est déjà accordée (ou refusée) pour le reste de la session.

**Risque iOS** : Si l'utilisateur refuse la permission dans `prep`, les collecteurs motion/orientation retournent `permission: 'denied'` — cohérent avec le comportement actuel. Le flow continue sans bloquer.

### 1b. Coût batterie/CPU — Fréquence d'échantillonnage

**Verdict : Gérable avec downsampling, impact négligeable.**

**Analyse** :
- Durée totale estimée du flow : 2–3 minutes (5 tests cognitifs ~20s chacun + vocal ~15s + review/device ~10s).
- `DeviceMotionEvent` et `DeviceOrientationEvent` firent à ~60Hz sur la plupart des devices. Sur 3 minutes : ~10 800 événements par capteur.
- Les collecteurs actuels calculent déjà des **aggregates safe** (sample_count, variance, changes) — pas de raw dump. Le design streaming maintient ce principe.

**Stratégie de downsampling proposée** :
- **Motion** : Au lieu de pousser chaque magnitude dans un array, accumuler par **fenêtre de 500ms** : calculer min/max/mean/variance par fenêtre. Sur 3 min : ~360 fenêtres. L'array `magnitudes` devient un array de `WindowAggregate` (max 360 éléments au lieu de 10 800).
- **Orientation** : Idem, fenêtres de 500ms, compter changes par fenêtre.
- **Touch** : Les événements tactiles sont déjà sporadiques (uniquement pendant les interactions utilisateur). Pas de downsampling nécessaire — le `touchCount` et `moveDistance` s'accumulent naturellement.
- **Visibility** : Événements rares (blur/focus/visibilitychange). Pas de downsampling nécessaire.
- **Network** : Snapshot instantané (`navigator.connection`), pas de stream. Peut être échantillonné toutes les 5s pour détecter changements de connectivité.

**Impact batterie** : Les event listeners `passive: true` (déjà utilisés par `touchCollector`) n'empêchent pas le scroll et ont un coût minimal. Les calculs par fenêtre de 500ms sont triviaux (addition, soustraction, division). Aucun risque de décharge significative sur 3 minutes.

### 1c. Impact sur les performances de rendu pendant les tests cognitifs

**Verdict : Aucun jank attendu avec le design proposé.**

**Analyse** :
- Stroop et N-Back sont sensibles au timing (réponses chronométrées). La collecte ne doit jamais bloquer le main thread.
- Les handlers actuels (`motionCollector`, `orientationCollector`) font des calculs triviaux (push dans un array, incrémentation d'un compteur). Ces opérations sont **O(1)** et prennent <0.01ms par événement.
- Le design streaming maintient des handlers tout aussi simples — la seule différence est qu'ils tournent plus longtemps.
- **Mitigation** : Utiliser `requestAnimationFrame` pour le batching des calculs de fenêtre au lieu de calculer dans le handler. Le handler ne fait que pousser la magnitude dans un buffer circulaire ; le calcul de variance/mean se fait au rAF suivant (max 1 fois par frame, pas 60 fois par seconde).
- Les listeners `passive: true` garantissent que le scroll/touch n'est pas bloqué.

---

## 2. COMPATIBILITÉ SCHEMA — CONTRAINTE DURE

### Payload actuel (inchangé)

Les 5 signaux device sont définis dans `@/demoguard-app/src/demoguard/types.ts:114-157` :

```typescript
DemoGuardMotionSignal:      { supported, permission, sample_count, variance?, quality }
DemoGuardOrientationSignal: { supported, permission, sample_count, changes, quality }
DemoGuardTouchSignal:       { touch_count, pointer_type?, pressure_supported, pressure_avg?,
                              touch_duration_ms?, move_distance?, multi_touch_detected, quality }
DemoGuardVisibilitySignal:  { blur_count, focus_count, visibility_hidden_count,
                              hidden_duration_ms, page_focus_lost, quality }
DemoGuardNetworkSignal:     { online, effective_type?, rtt?, downlink?, api_latency_ms?, quality }
```

Ces types sont consommés par `buildDemoGuardPayload.ts` → `signals.motion`, `signals.orientation`, etc. et validés côté HV par un schema Zod.

### Design : mêmes champs, valeurs enrichies

**Tous les champs existants restent identiques en shape et en type.** La seule différence est la **durée de collecte** sous-jacente :

| Champ | Actuel (3s) | Streaming (2-3 min) |
|---|---|---|
| `motion.sample_count` | ~180 (60Hz × 3s) | ~360 (fenêtres 500ms × 3min) |
| `motion.variance` | variance sur 3s | variance sur toute la session |
| `orientation.sample_count` | ~180 | ~360 |
| `orientation.changes` | changements sur 3s | changements sur toute la session |
| `touch.touch_count` | 0-5 (2s, après tests) | 20-100+ (toute la session, incluant tests) |
| `touch.move_distance` | distance sur 2s | distance cumulée sur toute la session |
| `visibility.blur_count` | 0 (2s, après tests) | 0-N (toute la session) |
| `visibility.hidden_duration_ms` | 0 (2s) | réel (toute la session) |
| `network.*` | snapshot instantané | snapshot au moment du submit |

**Le schema HV (Zod) ne voit aucune différence de structure.** Les champs sont les mêmes, juste avec des valeurs plus représentatives.

### Extension additive optionnelle : `per_phase`

Pour la corrélation temporelle (objectif Brain), une extension **additive** est proposée. Elle s'ajoute aux signaux existants **sans les modifier** :

```typescript
// NOUVEAU champ optionnel — pas dans le schema HV actuel
interface DeviceSignalPerPhase {
  phase: string;           // 'prep' | 'camera' | 'test_reflex' | 'test_colors' | ...
  startMs: number;         // timestamp relatif au début de session
  endMs: number;
  motion_variance?: number;
  orientation_changes?: number;
  touch_count?: number;
}
```

Ajouté comme champ **optionnel** sur chaque signal :

```typescript
DemoGuardMotionSignal & { per_phase?: DeviceSignalPerPhase[] }
```

**Contrainte HV** : Le schema Zod côté HV doit accepter ce champ optionnel (via `.optional()` ou `.passthrough()`). Si le schema utilise `.strict()`, une mise à jour HV est nécessaire pour ajouter `per_phase` comme champ optionnel. **Cette mise à jour est documentée ici pour validation — pas d'implémentation dans cette task.**

---

## 3. CORRÉLATION AVEC LES PHASES COGNITIVES

### Mécanisme proposé

Chaque échantillon device (motion, orientation, touch) conserve :
1. **Timestamp relatif** au début de session (`performance.now() - sessionStartMs`)
2. **Phase active** au moment de l'échantillon (via le reducer `state.phase`)

### Implémentation du tracking de phase

Le reducer `demoguardReducer.ts` gère déjà les transitions de phase. Le design proposé :

- Un `phaseTracker` (singleton léger, non-React) enregistre la phase courante et son timestamp de début.
- Mis à jour via un `useEffect` dans `App.tsx` qui observe `state.phase` :
  ```typescript
  useEffect(() => {
    phaseTracker.setPhase(state.phase, performance.now());
  }, [state.phase]);
  ```
- Les collecteurs streaming consultent `phaseTracker.getCurrentPhase()` au moment de chaque échantillon.

### Stockage : `per_phase` séparé (pas dans `behavior.taskBehaviors`)

**Décision** : Stocker les agrégats par phase dans un champ séparé `per_phase` sur chaque signal, **pas** dans `behavior.taskBehaviors`.

**Justification** :
- `behavior.taskBehaviors` est structuré par tâche cognitive (`reflex`, `stroop`, etc.) avec des métriques comportementales (hesitation, corrections, path efficiency). Les signaux device (motion variance, orientation changes) sont d'une nature différente.
- Mélanger les deux créerait une confusion sémantique et un couplage inutile entre `behaviorSession` et les collecteurs device.
- Un champ `per_phase` séparé sur chaque signal est **additif** et **indépendant** — il peut être ignoré par HV sans casser le contrat existant.

---

## 4. TOUCH — DISTINGUER DEVICE TOUCH ET BEHAVIOR TOUCH

### Architecture actuelle confirmée

Deux systèmes distincts :

1. **`touchCollector.ts`** (device signal) : écoute `pointerdown/pointermove/pointerup` au niveau `window`, compte les événements tactiles bruts (touch_count, move_distance, pressure). Actuellement one-shot 2s dans `DeviceSignalsScreen`.

2. **`useBehaviorSession` / `BehaviorSession`** (behavior touch) : enregistre les interactions **par tâche cognitive** via `taskBehaviorRecorder.ts`. Les screens cognitifs appellent `recordReflexTap()`, `recordStroopSelection()`, etc. avec des métadonnées (isCorrection, isWrongTap, pathSegmentDistance).

### Confirmation : `useBehaviorSession` tourne déjà en continu

**Oui.** `BehaviorSession` est instancié dans `App.tsx` via `useBehaviorSession()` et vit pendant toute la durée de l'app. Il est `reset()` au `START` et `getPayload()` est appelé au `submit`. Les screens cognitifs reçoivent `session` en prop et appellent `recordInteraction()` pendant leurs tests. **Il tourne déjà en continu sur toute la session.**

### Action requise

**Étendre uniquement les 5 collecteurs device** (motion, orientation, touch, visibility, network) en mode streaming. `useBehaviorSession` n'a **aucune modification** nécessaire — il fonctionne déjà correctement.

**Note** : `touchCollector.ts` en mode streaming écoutera `pointerdown/pointermove/pointerup` pendant toute la session. Cela inclut les interactions pendant les tests cognitifs. C'est **complémentaire** (pas redondant) avec `BehaviorSession` :
- `touchCollector` : agrégats bruts (combien de touches, distance totale, pression moyenne)
- `BehaviorSession` : métadonnées par tâche (corrections, hesitations, path efficiency)

---

## 5. DESIGN CIBLE — PROPOSITION DÉTAILLÉE

### 5.1 API des collecteurs streaming

Chaque collecteur passe d'une API `collectX(durationMs): Promise<Signal>` à :

```typescript
function startXCollection(): void;   // démarre les listeners
function stopXCollection(): Signal;  // arrête et retourne l'agrégat final
```

#### Motion

```typescript
// motionCollector.ts (streaming)
export function startMotionCollection(): void {
  // Ajoute le listener 'devicemotion' si supported + permission granted
  // Handler: pousse magnitude dans un buffer circulaire (cap 720 fenêtres)
  // Calcul de fenêtre (500ms) différé au rAF suivant
}

export function stopMotionCollection(): DemoGuardMotionSignal {
  // Retire le listener
  // Calcule variance finale sur toutes les fenêtres
  // Retourne { supported, permission, sample_count, variance, quality }
  // + per_phase?: DeviceSignalPerPhase[] (optionnel)
}
```

#### Orientation

```typescript
// orientationCollector.ts (streaming)
export function startOrientationCollection(): void {
  // Ajoute le listener 'deviceorientation'
  // Handler: incrémente sampleCount, compare avec dernier échantillon pour changes
}

export function stopOrientationCollection(): DemoGuardOrientationSignal {
  // Retire le listener
  // Retourne { supported, permission, sample_count, changes, quality }
  // + per_phase?: DeviceSignalPerPhase[] (optionnel)
}
```

#### Touch

```typescript
// touchCollector.ts (streaming)
export function startTouchCollection(): void {
  // Ajoute les listeners pointerdown/pointermove/pointerup + touchstart/touchmove/touchend
  // Handler: accumulate touchCount, moveDistance, pressureSum, multiTouch
}

export function stopTouchCollection(): DemoGuardTouchSignal {
  // Retire les listeners
  // Retourne { touch_count, pointer_type, pressure_supported, pressure_avg,
  //   touch_duration_ms, move_distance, multi_touch_detected, quality }
  // + per_phase?: DeviceSignalPerPhase[] (optionnel)
}
```

#### Visibility

```typescript
// visibilityCollector.ts (streaming)
export function startVisibilityCollection(): void {
  // Ajoute visibilitychange, blur, focus listeners
  // Handler: compte blur/focus/hidden, accumule hidden_duration_ms
}

export function stopVisibilityCollection(): DemoGuardVisibilitySignal {
  // Retire les listeners
  // Finalise hidden_duration_ms si actuellement hidden
  // Retourne { blur_count, focus_count, visibility_hidden_count,
  //   hidden_duration_ms, page_focus_lost, quality }
}
```

#### Network

```typescript
// networkCollector.ts (streaming)
export function startNetworkCollection(): void {
  // Snapshot initial + setInterval(5000) pour détecter changements
  // Stocke: online, effective_type, rtt, downlink à chaque intervalle
}

export function stopNetworkCollection(): DemoGuardNetworkSignal {
  // clearInterval
  // Retourne le dernier snapshot (ou une moyenne des snapshots)
  // + changes_count?: number (optionnel — nombre de changements de connectivité)
}
```

### 5.2 Points de démarrage et d'arrêt

**Démarrage** : Phase `prep`, après `collectPermissions()` + `requestMotionPermission()` + `requestOrientationPermission()`.

Dans `PrepScreen.tsx` :
```typescript
// Après collectPermissions() et requestXxxPermission():
startMotionCollection();
startOrientationCollection();
startTouchCollection();
startVisibilityCollection();
startNetworkCollection();
// puis dispatch('PREP_READY') → phase 'camera'
```

**Arrêt** : Juste avant `buildDemoGuardPayload()`, dans `handleSubmit` (App.tsx).

```typescript
const handleSubmit = useCallback(async () => {
  dispatch({ type: 'SUBMIT' });

  // Finaliser les collecteurs streaming
  const motion = stopMotionCollection();
  const orientation = stopOrientationCollection();
  const touch = stopTouchCollection();
  const visibility = stopVisibilityCollection();
  const network = stopNetworkCollection();

  dispatch({ type: 'DEVICE_SIGNALS_COLLECTED', signals: { motion, orientation, touch, visibility, network } });

  const behaviorPayload = getPayload();
  const behaviorDiag = getTouchDiagnostics();
  dispatch({ type: 'BEHAVIOR_COLLECTED', payload: behaviorPayload, touchDiag: behaviorDiag });

  const payload = buildDemoGuardPayload(state, behaviorPayload, behaviorDiag, sensitiveRef.current);
  // ...
}, [state, getPayload, getTouchDiagnostics]);
```

### 5.3 Phase `device_signals` — Raccourcie

La phase `device_signals` devient un simple **checkpoint de confirmation** :
- Plus de collecte de 2-3s (déjà faite en continu)
- Affiche "Signaux appareil collectés en continu ✓" avec un résumé (sample_count, durée)
- Le bouton "Continuer" passe à `readiness`

**Alternative** : Supprimer entièrement la phase `device_signals` et passer directement de `review` à `readiness`. Les signaux sont déjà en cours de collecte. Le `DEVICE_SIGNALS_COLLECTED` est dispatché au `submit` (finalisation). Cette alternative raccourcit le flow de ~5s mais modifie la state machine (transitions et UI). **Recommandation : garder la phase mais la vider de collecte** — c'est moins perturbant pour l'utilisateur et permet un checkpoint visuel.

### 5.4 Gestion du cycle de vie

- **Unmount/remount de screens** : Les screens cognitifs sont montés/démontés à chaque phase. Les collecteurs streaming doivent vivre **en dehors** du cycle de vie des screens — au niveau de `App.tsx` ou via un hook dédié `useContinuousSignals()`.
- **Cleanup** : Si l'utilisateur quitte l'app (reset/error), les listeners doivent être retirés. Un `useEffect` cleanup dans `App.tsx` ou le hook dédié gère cela.
- **Re-run** : Au `START` (nouvelle session), les collecteurs sont `reset()` puis redémarrés.

### 5.5 Hook proposé : `useContinuousSignals()`

```typescript
// hooks/useContinuousSignals.ts
export function useContinuousSignals(active: boolean) {
  const signalsRef = useRef<ContinuousSignalsState>({ ... });

  const start = useCallback(() => {
    // Request permissions + start all collectors + init phaseTracker
  }, []);

  const stop = useCallback(): Partial<DemoGuardSignals> => {
    // Stop all collectors, return final aggregates
  }, []);

  const setPhase = useCallback((phase: Phase) => {
    phaseTracker.setPhase(phase, performance.now());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Force-stop all collectors if still running
    };
  }, []);

  return { start, stop, setPhase };
}
```

---

## 6. IMPACT PRÉCIS SUR LE PAYLOAD

### Diff avant / après

#### Signaux inchangés en structure (valeurs enrichies)

```json
// AVANT (3s window, après tests)
{
  "motion": { "supported": true, "permission": "granted", "sample_count": 180, "variance": 0.02, "quality": "ok" },
  "orientation": { "supported": true, "permission": "granted", "sample_count": 180, "changes": 3, "quality": "ok" },
  "touch": { "touch_count": 2, "pressure_supported": false, "move_distance": 150, "multi_touch_detected": false, "quality": "missing" },
  "visibility": { "blur_count": 0, "focus_count": 0, "visibility_hidden_count": 0, "hidden_duration_ms": 0, "page_focus_lost": false, "quality": "ok" },
  "network": { "online": true, "effective_type": "4g", "rtt": 50, "downlink": 10, "quality": "ok" }
}

// APRÈS (streaming sur 2-3 min, pendant tests)
{
  "motion": { "supported": true, "permission": "granted", "sample_count": 360, "variance": 0.15, "quality": "ok" },
  "orientation": { "supported": true, "permission": "granted", "sample_count": 360, "changes": 27, "quality": "ok" },
  "touch": { "touch_count": 47, "pressure_supported": true, "pressure_avg": 0.3, "touch_duration_ms": 125, "move_distance": 3200, "multi_touch_detected": false, "quality": "ok" },
  "visibility": { "blur_count": 1, "focus_count": 1, "visibility_hidden_count": 1, "hidden_duration_ms": 800, "page_focus_lost": true, "quality": "low" },
  "network": { "online": true, "effective_type": "4g", "rtt": 45, "downlink": 12, "quality": "ok" }
}
```

**Ce qui reste identique** : tous les noms de champs, tous les types, la structure JSON. Le schema Zod côté HV valide sans modification.

**Ce qui s'enrichit** : les valeurs sont calculées sur une fenêtre 40-60x plus longue, donc plus représentatives du comportement réel.

#### Extension additive optionnelle (nécessite validation HV)

```json
{
  "motion": {
    "supported": true, "permission": "granted", "sample_count": 360, "variance": 0.15, "quality": "ok",
    "per_phase": [
      { "phase": "test_reflex", "startMs": 5000, "endMs": 25000, "motion_variance": 0.08 },
      { "phase": "test_colors", "startMs": 25000, "endMs": 45000, "motion_variance": 0.03 },
      { "phase": "test_path", "startMs": 85000, "endMs": 110000, "motion_variance": 0.42 }
    ]
  }
}
```

**Action HV requise** : Ajouter `per_phase` comme champ `.optional()` dans le schema Zod pour `motion`, `orientation`, et `touch`. **À valider avant implémentation.**

---

## 7. PLAN D'IMPLÉMENTATION PAR ÉTAPES

### Étape 1 : Refactor des collecteurs en mode streaming (sans `per_phase`)
**Scope** : `demoguard-app` uniquement, zéro changement HV.
- Ajouter `startXCollection()` / `stopXCollection()` à chaque collecteur
- Garder les anciennes fonctions `collectX(durationMs)` pour compatibilité (tests unitaires existants)
- Créer `phaseTracker` (singleton léger)
- Créer `useContinuousSignals()` hook
- Câbler dans `App.tsx` : start au `prep`, stop au `submit`
- Modifier `PrepScreen.tsx` : demander permissions motion/orientation ici
- Modifier `DeviceSignalsScreen.tsx` : afficher résumé au lieu de collecter
- **Tests** : vérifier que les signaux retournés ont la même shape que before

### Étape 2 : Downsampling par fenêtre (optimisation perf)
**Scope** : `demoguard-app` uniquement.
- Implémenter le buffer circulaire + calcul par fenêtre de 500ms pour motion/orientation
- Utiliser `requestAnimationFrame` pour le batching
- **Tests** : vérifier que la variance calculée par fenêtre est cohérente avec la variance brute

### Étape 3 : Extension `per_phase` (nécessite validation HV)
**Scope** : `demoguard-app` + `hybrid-vector-api` (schema Zod).
- Ajouter `per_phase` aux signaux motion, orientation, touch
- Mettre à jour le schema Zod côté HV pour accepter `per_phase` en `.optional()`
- **Tests** : vérifier que le payload avec `per_phase` passe la validation HV

### Étape 4 : Suppression de la phase `device_signals` (optionnel)
**Scope** : `demoguard-app` uniquement.
- Si l'UX le permet, passer directement de `review` à `readiness`
- Mettre à jour le reducer (transitions) et `App.tsx`
- **Tests** : vérifier le flow complet sans la phase intermédiaire

---

## 8. RISQUES ET MITIGATIONS

| Risque | Probabilité | Mitigation |
|---|---|---|
| Permission iOS refusée en `prep` (au lieu de `device_signals`) | Moyenne | Le flow continue — les collecteurs retournent `permission: 'denied'`, `quality: 'missing'`. Comportement identique à un refus actuel. |
| Jank pendant Stroop/N-Back | Faible | Handlers O(1), listeners `passive: true`, calculs différés au rAF. |
| Fuite de listeners si l'utilisateur quitte l'app | Moyenne | Cleanup dans `useEffect` + `reset()` au `START`. |
| Schema HV rejette `per_phase` | Élevée (si `.strict()`) | Étape 3 séparée et validée avant implémentation. Étapes 1-2 ne nécessitent aucun changement HV. |
| `touchCollector` en streaming capte les touches des tests cognitifs | Aucun (comportement souhaité) | C'est l'objectif — corréler les dynamiques tactiles avec les phases. |
| Durée de collecte variable (2-3 min) vs fixe (3s) | Aucun | Les agrégats (variance, count) sont normalisés par `sample_count`. |

---

## 9. CONCLUSION

Le design proposé est **rétro-compatible** à 100% pour les étapes 1-2 (aucun changement HV/backend). L'extension `per_phase` (étape 3) est **additive et optionnelle** — elle nécessite une mise à jour mineure du schema Zod HV (ajout de `.optional()`) mais ne casse aucun contrat existant.

L'impact sur le payload est **uniquement quantitatif** (valeurs plus riches) — pas qualitatif (même structure). Le Brain pourra, avec l'étape 3, corréler l'état device avec chaque phase cognitive, ouvrant la voie à l'analyse d'état/mood sur la durée.

**Recommandation** : Valider et implémenter les étapes 1-2 en priorité. L'étape 3 (`per_phase`) peut être différée sans bloquer la valeur principale (collecte continue au lieu d'instantané).

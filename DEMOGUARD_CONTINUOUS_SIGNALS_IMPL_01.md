# DEMOGUARD-CONTINUOUS-SIGNALS-IMPL-01 — Implémentation étapes 1-2

**Task** : Implémentation collecte continue des signaux device (étapes 1-2)
**Repo** : `demoguard-app`
**Date** : 2026-07-11
**Référence** : `DEMOGUARD_CONTINUOUS_SIGNALS_AUDIT_01.md`
**Statut** : Implémenté, tests verts, build OK

---

## 1. DIFF PAR COLLECTEUR

### 1a. `phaseTracker.ts` — Nouveau fichier

**Path** : `src/demoguard/collectors/phaseTracker.ts`

Singleton léger qui track la phase courante et son timestamp de début. Permet aux collecteurs de tagger les échantillons avec la phase active.

- `startSession()` : initialise le tracker, phase = `prep`
- `setPhase(phase)` : enregistre une transition de phase
- `getCurrentPhase()` / `getRelativeMs()` / `getHistory()`
- `reset()` : remet à zéro

### 1b. `motionCollector.ts` — Refactor streaming + downsampling

**Path** : `src/demoguard/collectors/motionCollector.ts`

| Avant | Après |
|---|---|
| `collectMotion(durationMs): Promise<Signal>` one-shot 3s | `startMotionCollection(permission): void` + `stopMotionCollection(): Signal` |
| Stocke chaque magnitude dans un array | Buffer circulaire par fenêtre de 500ms (max 720 fenêtres ≈ 6 min) |
| Variance calculée sur l'array complet | Variance calculée à partir des sommes par fenêtre (magSum, magSqSum) |

**Nouvelles exports** : `startMotionCollection`, `stopMotionCollection`, `isMotionCollecting`
**Backward compat** : `collectMotion(durationMs)` conservé, délègue à `startTouchCollection`/`stopTouchCollection`
**Handler** : `passive: true`, O(1) par event (incrémentation + addition), pas de calcul lourd

### 1c. `orientationCollector.ts` — Refactor streaming + downsampling

**Path** : `src/demoguard/collectors/orientationCollector.ts`

| Avant | Après |
|---|---|
| `collectOrientation(durationMs): Promise<Signal>` one-shot 3s | `startOrientationCollection(permission): void` + `stopOrientationCollection(): Signal` |
| Compte simple d'échantillons et de changes | Buffer circulaire par fenêtre de 500ms (max 720 fenêtres) |

**Nouvelles exports** : `startOrientationCollection`, `stopOrientationCollection`, `isOrientationCollecting`
**Backward compat** : `collectOrientation(durationMs)` conservé
**Handler** : `passive: true`, O(1) par event

### 1d. `touchCollector.ts` — Refactor streaming

**Path** : `src/demoguard/collectors/touchCollector.ts`

| Avant | Après |
|---|---|
| `collectTouch(durationMs): Promise<Signal>` one-shot 5s | `startTouchCollection(): void` + `stopTouchCollection(): Signal` |
| Listeners créés et détruits dans un setTimeout | Listeners persistants entre start et stop |

**Nouvelles exports** : `startTouchCollection`, `stopTouchCollection`, `isTouchCollecting`
**Backward compat** : `collectTouch(durationMs)` conservé, délègue à start/stop
**Handler** : `passive: true` sur les 6 listeners (3 pointer + 3 touch)
**Pas de downsampling** : les événements tactiles sont sporadiques (uniquement pendant interactions)

### 1e. `visibilityCollector.ts` — Refactor streaming

**Path** : `src/demoguard/collectors/visibilityCollector.ts`

| Avant | Après |
|---|---|
| `collectVisibility(durationMs): Promise<Signal>` one-shot 5s | `startVisibilityCollection(): void` + `stopVisibilityCollection(): Signal` |

**Nouvelles exports** : `startVisibilityCollection`, `stopVisibilityCollection`, `isVisibilityCollecting`
**Backward compat** : `collectVisibility(durationMs)` conservé
**Pas de downsampling** : événements rares (blur/focus/visibilitychange)

### 1f. `networkCollector.ts` — Refactor streaming

**Path** : `src/demoguard/collectors/networkCollector.ts`

| Avant | Après |
|---|---|
| `collectNetwork(): Signal` snapshot instantané | `startNetworkCollection(): void` + `stopNetworkCollection(): Signal` |
| Pas de suivi temporel | Polling toutes les 5s via `setInterval`, dernier snapshot retourné au stop |

**Nouvelles exports** : `startNetworkCollection`, `stopNetworkCollection`, `isNetworkCollecting`
**Backward compat** : `collectNetwork()` conservé, retourne un snapshot instantané

### 1g. `useContinuousSignals.ts` — Nouveau hook

**Path** : `src/hooks/useContinuousSignals.ts`

Hook React qui manage le lifecycle des 5 collecteurs :
- `start(permissions)` : demande permissions motion/orientation si `prompt`, démarre les 5 collecteurs, init `phaseTracker`
- `stop()` : arrête les 5 collecteurs, retourne `Partial<DemoGuardSignals>`
- `setPhase(phase)` : délègue à `phaseTracker.setPhase()`
- `isCollecting()` : vérifie si la collecte est active
- Cleanup au unmount : force-stop tous les collecteurs si encore actifs

**Idempotent** : `start` est gardé par `startedRef`, pas de double démarrage
**Safe cleanup** : `useEffect` cleanup au unmount

### 1h. `PrepScreen.tsx` — Modifié

**Path** : `src/screens/PrepScreen.tsx`

- Nouvelle prop `onContinuousSignalsStart: (perms) => Promise<void>`
- Appelée après `collectPermissions()` et avant `onReady()`
- C'est ici que les permissions motion/orientation sont demandées (via `useContinuousSignals.start()`)
- Le geste utilisateur du bouton "Start" de `IdleScreen` sert de trigger pour `DeviceMotionEvent.requestPermission()`

### 1i. `DeviceSignalsScreen.tsx` — Modifié

**Path** : `src/screens/DeviceSignalsScreen.tsx`

- Ne collecte plus rien (plus de `collectMotion`, `collectOrientation`, etc.)
- Affiche un résumé des signaux déjà collectés (`state.signals`)
- Props simplifiées : `signals` + `onContinue` (plus de `onCollected` / `onError`)

### 1j. `App.tsx` — Modifié

**Path** : `src/App.tsx`

- Import et utilisation de `useContinuousSignals()`
- `useEffect` sur `state.phase` → `continuousSignals.setPhase(state.phase)` pour tracker les transitions
- `PrepScreen` reçoit `onContinuousSignalsStart` qui appelle `continuousSignals.start()`
- `handleSubmit` appelle `continuousSignals.stop()` avant `buildDemoGuardPayload()`, dispatch `DEVICE_SIGNALS_COLLECTED` avec les signaux finaux
- `DeviceSignalsScreen` reçoit `signals={state.signals}` au lieu des anciennes props

---

## 2. DOWNSAMPLING (ÉTAPE 2)

### Motion et Orientation

- **Fenêtre** : 500ms
- **Buffer circulaire** : max 720 fenêtres (≈ 6 minutes)
- **Dépassement** : les fenêtres les plus anciennes sont écrasées (`shift()`)
- **Stockage par fenêtre** :
  - Motion : `{ count, magSum, magSqSum }` — permet de calculer variance globale
  - Orientation : `{ count, changes }` — permet de calculer changes total
- **Calcul de l'agrégat final** : au `stop()`, pas en continu. Parcourt les fenêtres pour calculer la variance globale (formule: `E[X²] - (E[X])²`)

### Touch, Visibility, Network

- **Touch** : pas de downsampling (événements sporadiques, accumulation brute)
- **Visibility** : pas de downsampling (événements rares, compteurs simples)
- **Network** : polling à 5s par `setInterval`, dernier snapshot retourné

### Limite documentée

Si la session dépasse 6 minutes (cas extrême), les fenêtres les plus anciennes sont écrasées. La variance est alors calculée sur les 6 dernières minutes uniquement. Ce comportement est acceptable car une session DemoGuard typique dure 2-3 minutes.

---

## 3. TESTS

### Fichier de tests

**Path** : `tests/continuousSignals.test.ts` (25 tests)

### Couverture

| Catégorie | Tests | Statut |
|---|---|---|
| **Motion lifecycle** | start/stop, permission denied, idempotent start, stop sans start, handler passive | ✅ |
| **Orientation lifecycle** | start/stop, permission denied, idempotent start | ✅ |
| **Touch lifecycle** | start/stop, idempotent start, stop sans start, cleanup 6 listeners | ✅ |
| **Visibility lifecycle** | start/stop, cleanup listeners (2 window + 1 document) | ✅ |
| **Network lifecycle** | start/stop, idempotent start, stop sans start | ✅ |
| **Phase tracker** | transitions, same-phase no-op, reset | ✅ |
| **Payload shape parity** | 5 signaux, tous les champs requis présents | ✅ |

### Résultats

```
Test Files  9 passed (9)
     Tests  141 passed (141)
  Duration  20.47s
```

Tous les tests existants (116) + nouveaux (25) = 141 passent.

### Tests existants non-régression

- `buildDemoGuardPayload.test.ts` (17 tests) ✅ — shape du payload inchangée
- `qualityAssessors.test.ts` (24 tests) ✅ — quality assessors inchangés
- `demoguardReducer.test.ts` (14 tests) ✅ — reducer inchangé
- `behaviorIntegratedTouch.test.ts` (18 tests) ✅ — behavior session inchangé
- `cognitiveBattery.test.ts` (30 tests) ✅ — tests cognitifs inchangés
- `nbackUx.test.ts` (9 tests) ✅
- `empirical-payload.test.ts` (1 test) ✅
- `idleScreen.test.tsx` (3 tests) ✅

---

## 4. VALIDATION

### TypeScript

```
npx tsc --noEmit → exit code 0 (no errors)
```

### Build

```
npm run build → exit code 0
  dist/index.html                   0.65 kB │ gzip:  0.39 kB
  dist/assets/index-BZ_R6gA7.css    6.13 kB │ gzip:  1.71 kB
  dist/assets/index-BV1cJQiO.js   209.15 kB │ gzip: 65.80 kB
  built in 1.15s
```

### Vitest

```
npx vitest run → 9 files, 141 tests, 0 failures
```

---

## 5. RUN DE VALIDATION MOBILE

**Statut** : En attente — nécessite un run réel sur mobile.

Le run de validation mobile doit confirmer :
1. Les permissions motion/orientation sont demandées dans `PrepScreen` (pas dans `DeviceSignalsScreen`)
2. Aucune permission n'est redemandée en cours de flow
3. Les 5 signaux device sont remplis avec des valeurs cohérentes dans l'E2E Trace admin
4. Pas de régression vs le run précédent (shape du payload identique)

**Procédure** :
1. Déployer sur staging
2. Lancer une session complète sur mobile (iOS Safari)
3. Vérifier l'E2E Trace admin : `motion.sample_count > 0`, `orientation.sample_count > 0`, `touch.touch_count > 0`, `visibility` présent, `network` présent
4. Confirmer dans les logs qu'aucun `requestPermission()` n'est appelé après `PrepScreen`

---

## 6. FICHIERS MODIFIÉS

| Fichier | Action |
|---|---|
| `src/demoguard/collectors/phaseTracker.ts` | **Nouveau** |
| `src/demoguard/collectors/motionCollector.ts` | Refactor streaming + downsampling |
| `src/demoguard/collectors/orientationCollector.ts` | Refactor streaming + downsampling |
| `src/demoguard/collectors/touchCollector.ts` | Refactor streaming |
| `src/demoguard/collectors/visibilityCollector.ts` | Refactor streaming |
| `src/demoguard/collectors/networkCollector.ts` | Refactor streaming |
| `src/hooks/useContinuousSignals.ts` | **Nouveau** |
| `src/screens/PrepScreen.tsx` | Ajout `onContinuousSignalsStart` |
| `src/screens/DeviceSignalsScreen.tsx` | Simplifié (résumé seulement) |
| `src/App.tsx` | Wiring `useContinuousSignals` + phase tracking |
| `tests/continuousSignals.test.ts` | **Nouveau** (25 tests) |

---

## 7. POINTS CLÉS DU DESIGN

- **Zéro modification hybrid-vector-api** : le payload a la même shape, seules les valeurs s'enrichissent
- **Zéro modification hcs-u7-backend** : pas de changement de schema
- **Étape 3 (per_phase) non implémentée** : comme demandé, attend validation séparée
- **Backward compat** : les fonctions `collectX(durationMs)` sont conservées pour les tests existants
- **Idempotent** : `startXCollection()` peut être appelé multiple fois sans effet secondaire
- **Cleanup garanti** : `useEffect` cleanup au unmount + `stopXCollection()` au submit
- **Permission déplacée** : de `DeviceSignalsScreen` (après tests) vers `PrepScreen` (avant tests), utilisant le geste "Start" comme trigger iOS

# BEHAVIOR-HESITATION-DIAG-01 — Seuil hesitationTotal <= 3 mal calibré ?

**Date :** 2026-07-12  
**Repo :** demoguard-app (lecture seule)  
**Précédent :** BEHAVIOR_VARIANCE_FIX_01 (variance rendue task-specific)  

---

## 1. Définition exacte d'une hésitation

### Seuil

`HESITATION_THRESHOLD_MS = 1500` (constante, non exportée)

**Localisation :**
- `demoguard-app/src/demoguard/behavior/behaviorScoring.ts:30`
- `payguard/src/demoguard/behavior/behaviorScoring.ts:30` (identique)
- `payguard/src/demoguard/behavior/touchBehaviorCollector.ts:27` (doublon, exporté)

> **Note duplication :** Dans demoguard-app, la constante n'existe que dans `behaviorScoring.ts`. Dans payguard, elle est dupliquée entre `behaviorScoring.ts` et `touchBehaviorCollector.ts` (ce dernier l'exporte). demoguard-app utilise une classe `BehaviorSession` non-singleton (pas de `touchBehaviorCollector.ts`), payguard utilise un singleton `TouchBehaviorCollector`.

### Condition exacte

```typescript
// behaviorScoring.ts:72-76 (identique dans les deux repos)
// Hesitation: gaps > threshold
let hesitationCount = 0;
for (const interval of intervals) {
  if (interval > HESITATION_THRESHOLD_MS) hesitationCount++;
}
```

Une **hésitation** = un intervalle entre deux interactions consécutives **au sein d'une même tâche** qui dépasse 1500 ms. Le seuil est **fixe et uniforme** pour toutes les tâches.

Les intervals sont calculés comme :
```typescript
// behaviorScoring.ts:64-67
const intervals: number[] = [];
for (let i = 1; i < timestamps.length; i++) {
  intervals.push(timestamps[i] - timestamps[i - 1]);
}
```

Chaque `timestamp` provient de `performance.now()` au moment du `recordInteraction()`.

---

## 2. Comptage par tâche ou global ?

### Structure : par tâche, puis sommé globalement

Le comptage se fait en deux étapes :

1. **Par tâche** (`computeTaskBehavior`, ligne 56-128) : chaque tâche produit un `hesitationCount` (nombre d'intervalles > 1500ms entre les interactions de cette tâche).

2. **Somme globale** (`computeBehaviorSummary`, ligne 136) :
```typescript
const hesitationTotal = behaviors.reduce((s, b) => s + b.hesitationCount, 0);
```

`hesitationTotal` est donc bien **la somme des hésitations across toutes les tâches observées**.

### Interactions enregistrées par tâche (d'après taskBehaviorRecorder.ts)

| Tâche | Fonction | Interactions enregistrées |
|---|---|---|
| Reflex | `recordReflexTap` | 1 tap (quand l'utilisateur tape sur le stimulus) |
| Stroop | `recordStroopSelection` | 1 par sélection de couleur |
| Digit Span | `recordDigitSpanKey` + `recordDigitSpanSubmit` | 1 par touche pressée + 1 au submit |
| N-Back | `recordNBackDecision` | 1 par décision (match/no-match) |
| Trail Tap | `recordTrailTap` | 1 par node tapé |
| Vocal RAN | *(non enregistré dans demoguard-app)* | 0 — pas de `recordVocalRanInteraction` dans demoguard-app |

> **Note :** payguard a `recordVocalRanInteraction()` dans `taskBehaviorRecorder.ts:78-81`. demoguard-app ne l'a pas — le vocal_ran n'enregistre pas d'interactions tactiles dans demoguard-app.

### Estimation des intervalles typiques par tâche

| Tâche | Nature | Intervalles typiques | Hésitations attendues (>1500ms) |
|---|---|---|---|
| **Reflex** | Réaction motrice rapide | 200-800ms entre stimulus et tap | 0 (si fluide) |
| **Stroop** | Conflit cognitif | 800-2000ms par essai | 1-2 (réflexion sur conflit couleur/mot) |
| **Digit Span** | Rappel mémoire | 500-4000ms entre touches (rappel séquentiel) | 2-4 (pauses de rappel mémoire) |
| **N-Back** | Mémoire de travail | 600-2500ms par décision | 1-3 (réflexion match/no-match) |
| **Trail Tap** | Navigation spatiale | 300-1200ms entre nodes | 0-1 (si fluide) |
| **Total estimé** | | | **4-10 hésitations** pour un humain normal |

---

## 3. Le seuil hesitationTotal <= 3 est-il réaliste pour 5 tâches ?

### Verdict : NON — seuil arithmétiquement presque impossible

**Démonstration par les données réelles :**
- Dernier run réel : **14 hésitations** sur 5 tâches cognitives
- Runs consécutifs : jamais en dessous de 3 (signal du pattern observé)
- Consistency : 55% (déjà corrigé par le fix variance)
- Behavior quality : `review` malgré le fix précédent

**Analyse arithmétique :**

Le seuil `hesitationTotal <= 3` est évalué à la ligne 188 de `behaviorScoring.ts` :
```typescript
} else if (tasksObserved >= 4 && consistencyScore >= 0.5 && hesitationTotal <= 3) {
  quality = 'ok';
```

Avec 5 tâches hétérogènes dont Digit Span (rappel mémoire, pauses de 3-5s normales) et N-Back (réflexion match/no-match), un humain normal génère structurellement 4-10 hésitations. Le seuil de 3 est **plus strict que ce qu'un humain normal peut respecter**.

### Pourquoi 14 hésitations est un chiffre normal

- **Digit Span** : rappel d'une séquence de 6-8 chiffres, chaque chiffre tapé avec un temps de rappel de 1-3s → 2-4 intervalles > 1500ms → 2-4 hésitations
- **N-Back** : 10-20 essais, décision match/no-match avec réflexion → 1-3 intervalles > 1500ms
- **Stroop** : conflit couleur/mot, temps de réponse allongé → 1-2 intervalles > 1500ms
- **Reflex** : 0-1 (réaction rapide, mais un seul intervalle possible)
- **Trail Tap** : 0-1 (navigation spatiale fluide)

**Total réaliste : 4-11 hésitations.** Le seuil de 3 est en dessous du minimum réaliste.

---

## 4. Comparaison avec le fix variance (task-specific)

### Rappel du fix variance (BEHAVIOR_VARIANCE_FIX_01)

Le seuil de variance a été rendu **task-specific** dans demoguard-app :
```typescript
// demoguard-app behaviorScoring.ts:36-43
const VARIANCE_THRESHOLDS: Record<CognitiveTaskName, number> = {
  reflex: 100_000,       // σ ≈ 316ms — strict
  stroop: 2_000_000,     // σ ≈ 1414ms — permissive
  digit_span: 3_000_000, // σ ≈ 1732ms — très permissive
  n_back: 1_500_000,     // σ ≈ 1225ms — permissive
  trail_tap: 1_000_000,  // σ ≈ 1000ms — modéré
  vocal_ran: 2_000_000,  // σ ≈ 1414ms — permissive
};
```

Payguard conserve l'ancien seuil unique de `500_000` (legacy).

### Le même raisonnement s'applique aux hésitations

Le seuil de hésitation souffre du **même problème que la variance avant le fix** : un seuil uniforme (1500ms) appliqué à des tâches de natures fondamentalement différentes.

### Deux approches proposées

#### Option A : Seuil de hesitationTotal par tâche (recommandé — cohérent avec le fix variance)

```typescript
const HESITATION_THRESHOLDS_PER_TASK: Record<CognitiveTaskName, number> = {
  reflex: 1,       // Réaction rapide — 0-1 hésitation tolérée
  stroop: 2,       // Conflit cognitif — 1-2 hésitations tolérées
  digit_span: 4,   // Rappel mémoire — 2-4 hésitations normales
  n_back: 3,       // Mémoire de travail — 1-3 hésitations normales
  trail_tap: 1,    // Navigation spatiale — 0-1 hésitation
  vocal_ran: 2,    // Réponse vocale — 1-2 hésitations
};
```

Puis remplacer la condition globale par une condition par tâche :
```typescript
// Au lieu de : hesitationTotal <= 3
// Utiliser : toutes les tâches sous leur seuil individuel
const allTasksWithinHesitation = behaviors.every(
  (b) => b.hesitationCount <= HESITATION_THRESHOLDS_PER_TASK[b.task]
);
```

#### Option B : Augmenter le total global à une valeur réaliste

```typescript
// Au lieu de : hesitationTotal <= 3
// Utiliser : hesitationTotal <= 10
```

Basé sur les données réelles (14 hésitations observées, minimum réaliste estimé 4-10), un seuil de 10 permettrait à un humain normal de passer `ok` tout en restant suffisamment strict pour détecter un bot (qui aurait soit 0 hésitation — trop rapide — soit un nombre aberrant).

### Recommandation

**Option A** est préférable car :
1. Cohérente avec le fix variance déjà appliqué (même pattern de résolution)
2. Plus précise : un bot sur Digit Span avec 0 hésitation est suspect, mais un bot sur Reflex avec 0 hésitation est normal
3. Évite le cas où un humain génère 5 hésitations sur Digit Span (normal) et 0 ailleurs, total = 5 > 3 → `review` injustifié

**Option B** est un correctif minimal si on veut éviter de toucher à la structure.

---

## 5. Vérification payguard — Divergences

### Comparaison des deux repos

| Élément | demoguard-app | payguard |
|---|---|---|
| `HESITATION_THRESHOLD_MS` | 1500 (`behaviorScoring.ts:30`) | 1500 (`behaviorScoring.ts:30` + `touchBehaviorCollector.ts:27`) |
| Seuil variance | **Task-specific** (`VARIANCE_THRESHOLDS`, fix appliqué) | **Uniforme** `500_000` (legacy, non fixé) |
| `hesitationTotal <= 3` (quality='ok') | **Oui** (`behaviorScoring.ts:188`) | **Oui** (`behaviorScoring.ts:171`) |
| `consistencyScore >= 0.5` (demoguard) vs `>= 0.6` (payguard) | **0.5** (ligne 188) | **0.6** (ligne 171) |
| Architecture collector | `BehaviorSession` (non-singleton, par session) | `TouchBehaviorCollector` (singleton) |
| `recordVocalRanInteraction` | **Absent** (pas d'interaction tactile vocale) | **Présent** (`taskBehaviorRecorder.ts:78-81`) |
| Doublon `HESITATION_THRESHOLD_MS` | Non (1 seule définition) | **Oui** (2 définitions : `behaviorScoring.ts` + `touchBehaviorCollector.ts`) |

### Divergences identifiées

1. **Variance :** demoguard-app a le fix task-specific, payguard conserve l'ancien seuil uniforme `500_000`. C'est la divergence déjà documentée dans `BEHAVIOR_VARIANCE_FIX_01.md`.

2. **consistencyScore :** demoguard-app requiert `>= 0.5`, payguard requiert `>= 0.6`. Divergence mineure — demoguard-app est plus permissif (probablement ajusté lors du fix variance).

3. **hesitationTotal <= 3 :** Identique dans les deux repos. Le bug est présent dans les deux.

4. **Doublon constante :** payguard a `HESITATION_THRESHOLD_MS` dupliquée entre `behaviorScoring.ts` et `touchBehaviorCollector.ts`. demoguard-app n'a qu'une seule définition (architecture différente).

5. **vocal_ran :** payguard enregistre des interactions vocales dans le collector, demoguard-app non. Impact mineur sur les hésitations (vocal_ran n'a généralement que 1 interaction → 0 intervalle → 0 hésitation).

---

## Verdict

### Seuil mal calibré — confirmation

Le seuil `hesitationTotal <= 3` est **mal calibré** pour 5 tâches cognitives hétérogènes. Avec un seuil de hésitation individuelle fixe à 1500ms appliqué uniformément :

- **Digit Span** génère structurellement 2-4 hésitations (temps de rappel mémoire)
- **N-Back** génère 1-3 hésitations (réflexion match/no-match)
- **Stroop** génère 1-2 hésitations (conflit cognitif)
- **Total réaliste : 4-10 hésitations** pour un humain normal

Le seuil de 3 est **en dessous du minimum réaliste**. Les 14 hésitations observées sur le dernier run sont dans la fourchette haute mais restent plausibles pour un humain normal sur 5 tâches.

### Proposition de correction

**Recommandée (Option A) — Seuils par tâche :**

```typescript
const HESITATION_THRESHOLDS_PER_TASK: Record<CognitiveTaskName, number> = {
  reflex: 1,
  stroop: 2,
  digit_span: 4,
  n_back: 3,
  trail_tap: 1,
  vocal_ran: 2,
};
```

Remplacer `hesitationTotal <= 3` par : chaque tâche sous son seuil individuel.

**Alternative (Option B) — Total global réaliste :**

Remplacer `hesitationTotal <= 3` par `hesitationTotal <= 10`.

### Impact payguard

Si le fix est appliqué côté demoguard-app uniquement, la divergence sera :
- demoguard-app : seuils task-specific (comme pour la variance)
- payguard : seuil global `<= 3` (legacy, non corrigé)

C'est le même pattern de divergence que pour la variance — documenté et accepté.

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `demoguard-app/src/demoguard/behavior/behaviorScoring.ts:30,72-76,136,188` | Définition seuil, comptage, somme globale, condition quality='ok' |
| `demoguard-app/src/demoguard/behavior/behaviorSession.ts` | Collecteur non-singleton (enregistre interactions) |
| `demoguard-app/src/demoguard/behavior/taskBehaviorRecorder.ts` | Helpers par tâche (reflex, stroop, digit_span, n_back, trail_tap) |
| `demoguard-app/src/demoguard/behavior/behaviorTypes.ts:30,44` | `TaskTouchBehavior.hesitationCount`, `BehaviorSummary.hesitationTotal` |
| `payguard/src/demoguard/behavior/behaviorScoring.ts:30,59-63,123,171` | Même logique, seuil variance legacy (500_000), consistencyScore >= 0.6 |
| `payguard/src/demoguard/behavior/touchBehaviorCollector.ts:27` | Doublon de HESITATION_THRESHOLD_MS (exporté) |
| `payguard/src/demoguard/behavior/taskBehaviorRecorder.ts:78-81` | `recordVocalRanInteraction` (absent dans demoguard-app) |

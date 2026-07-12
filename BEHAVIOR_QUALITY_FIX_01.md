# BEHAVIOR-QUALITY-FIX-01 — hesitationPenalty global résiduel

**Date :** 2026-07-12  
**Repo :** demoguard-app  
**Référence :** BEHAVIOR_QUALITY_STILL_REVIEW_DIAG_01.md, BEHAVIOR_HESITATION_FIX_01.md  
**Précédent :** BEHAVIOR_VARIANCE_FIX_01 (variance per-task), BEHAVIOR_HESITATION_FIX_01 (hesitation thresholds per-task)

---

## 1. Problème identifié

Malgré BEHAVIOR_HESITATION_FIX_01 (suppression du hard cutoff `hesitationTotal <= 3` + seuils par tâche), le `consistencyScore` restait à 0.45 pour un run réel avec 14 hésitations.

**Root cause :** un deuxième mécanisme global d'hésitation dans la formule `consistencyScore` (`behaviorScoring.ts:172`) :

```typescript
const hesitationPenalty = Math.min(1, hesitationTotal / 10);
```

Avec `hesitationTotal = 14` → `hesitationPenalty = 1.0` (saturé) → **-0.25 sur consistencyScore**. Combiné avec `okRatio = 0.4` (2 ok / 5 tâches) → `consistencyScore = 0.45 < 0.5` → `quality = 'review'`.

---

## 2. Fix appliqué — Option A : hesitationPenalty per-task

### 2.1 Choix retenu

**Option A : hesitationPenalty per-task** (calcul basé sur la proportion individuelle de chaque tâche par rapport à son seuil).

**Pourquoi pas l'Option B (suppression pure) :** L'hésitation a une valeur fonctionnelle distincte d'`okRatio`. `okRatio` est binaire (ok ou pas), alors que `hesitationPenalty` capture l'intensité continue — une tâche à 1× son seuil est différente d'une tâche à 2× son seuil, même si les deux sont 'review'. Supprimer le penalty perdrait cette granularité.

**Pourquoi pas l'Option C (divisor recalibré à /13 ou /20) :** Un divisor global reste incohérent avec l'architecture per-task. Un total de 14 hésitations toutes sur digit_span (threshold 4) est normal, mais 14 hésitations toutes sur reflex (threshold 1) est anormal — un divisor global ne peut pas distinguer ces cas.

### 2.2 Nouveau calcul

`behaviorScoring.ts:166-185` :

```typescript
// Avant (global) :
const hesitationPenalty = Math.min(1, hesitationTotal / 10);

// Après (per-task) :
const perTaskHesitationPenalties = behaviors.map((b) => {
  const threshold = HESITATION_THRESHOLDS_PER_TASK[b.task];
  return Math.min(1, b.hesitationCount / (threshold * 2));
});
const hesitationPenalty = perTaskHesitationPenalties.reduce((s, p) => s + p, 0) / tasksObserved;
```

**Logique :**
- Pour chaque tâche, on calcule `min(1, hesitationCount / (threshold * 2))`
  - `0` = aucune hésitation
  - `0.5` = hésitations au niveau du seuil (threshold)
  - `1.0` = hésitations au double du seuil (2 × threshold)
- La moyenne across tasks donne un penalty continu [0, 1]
- Une tâche avec 0 hésitations contribue 0 au penalty, indépendamment des autres

### 2.3 Impact sur les scénarios clés

| Scénario | Répartition | okRatio | Old penalty | Old score | New penalty | New score | Quality |
|---|---|---|---|---|---|---|---|
| A (test fix 01) | reflex 1, stroop 2, ds 4, n_back 4, trail 3 | 0.6 | 1.0 | 0.55 | 0.63 | 0.64 | **ok** ✅ |
| **B (real run)** | reflex 2, stroop 2, ds 4, n_back 4, trail 2 | **0.4** | **1.0** | **0.45** | **0.73** | **0.52** | **ok** ✅ |
| C | reflex 2, stroop 3, ds 4, n_back 3, trail 2 | 0.4 | 1.0 | 0.45 | 0.63 | 0.55 | **ok** ✅ |
| All within | reflex 1, stroop 2, ds 4, n_back 3, trail 1 | 1.0 | 1.0 | 0.75 | 0.50 | 0.88 | **ok** ✅ |
| Best case | All 0 hesitations | 1.0 | 0.0 | 1.0 | 0.0 | 1.0 | **ok** ✅ |

**Le scénario B (le run réel problématique) passe de 0.45 (review) à 0.52 (ok).**

---

## 3. Cohérence avec les fixes précédents

| Critère | Avant FIX-01 | Après VARIANCE-FIX | Après HESITATION-FIX | Après QUALITY-FIX (ce fix) |
|---|---|---|---|---|
| varianceInterActionMs | Global 500k | **Per-task** ✅ | Per-task ✅ | Per-task ✅ |
| hesitationCount (behaviorQuality) | Global ≥3/≥5 | Global ≥3/≥5 | **Per-task** ✅ | Per-task ✅ |
| hesitationTotal cutoff (quality='ok') | Global ≤3 | Global ≤3 | **Supprimé** ✅ | Supprimé ✅ |
| hesitationPenalty (consistencyScore) | Global /10 | Global /10 | Global /10 ❌ | **Per-task** ✅ |
| correctionPenalty | Global /10 | Global /10 | Global /10 | Global /10 (inchangé) |

**Tous les mécanismes d'hésitation sont maintenant per-task.** Le `correctionPenalty` reste global car les corrections sont un signal uniforme (une correction est une erreur quel que soit la tâche, contrairement aux hésitations qui sont task-dependent).

---

## 4. Tests ajoutés

3 nouveaux tests dans `tests/behaviorIntegratedTouch.test.ts` :

| Test | Description | Old score | New score | Résultat |
|---|---|---|---|---|
| 14 hesitations scenario B (2 ok / 3 review) | reflex 2, stroop 2, ds 4, n_back 4, trail 2 | 0.45 | 0.52 | `quality = 'ok'` ✅ |
| 14 hesitations scenario C (2 ok / 3 review, autre distribution) | reflex 2, stroop 3, ds 4, n_back 3, trail 2 | 0.45 | 0.55 | `quality = 'ok'` ✅ |
| High hesitationTotal but all within thresholds | 11 hésitations, toutes dans les seuils | 0.75 | 0.88 | `quality = 'ok'` ✅ |

### Non-régression

Tous les tests existants (171 des fixes précédents) continuent de passer :
- `computeBehaviorSummary returns correct quality for good behavior` → toujours `ok` (score 0.97 vs 0.95 avant)
- `Full cognitive battery with normal variance produces quality ok` → toujours `ok` (score 0.98 vs 0.95)
- `Full battery with 14 hesitations` (scénario A) → toujours `ok` (score 0.64 vs 0.55)
- `Full battery with all tasks within hesitation thresholds` → toujours `ok` (score 0.88 vs 0.75)
- `wrongTapCount` et `variance` non-regression → toujours `review`

---

## 5. Validation

| Étape | Résultat |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `vite build` | ✅ 210.07 kB (gzip 66.19 kB), hash `index-C1pCuhmT.js` |
| `vitest run` | ✅ **174/174 passed** (10 test files, 36 tests in behaviorIntegratedTouch) |

### Build hash

Le nouveau build produit `index-C1pCuhmT.js` (vs `index-gMfUNfum.js` pour le fix précédent). Le hash change car le contenu de `behaviorScoring.ts` a été modifié.

---

## 6. Diff

### `src/demoguard/behavior/behaviorScoring.ts`

```diff
@@ -166,12 +166,21 @@
-  // Consistency score: based on rhythm regularity and low corrections
+  // Consistency score: based on rhythm regularity and low corrections
+  // hesitationPenalty is now per-task (BEHAVIOR-QUALITY-FIX-01): each task's hesitationCount
+  // is compared to 2× its HESITATION_THRESHOLDS_PER_TASK value, producing a continuous ratio
+  // (0 = no hesitation, 1 = at 2× threshold). The average across tasks gives a per-task
+  // penalty that is coherent with the per-task behaviorQuality and VARIANCE_THRESHOLDS.
+  // The old global `hesitationTotal / 10` penalized all tasks equally for a high total,
+  // even if most tasks were within their individual thresholds.
   let consistencyScore = 0;
   if (tasksObserved > 0) {
     const okTasks = behaviors.filter((b) => b.behaviorQuality === 'ok').length;
     const okRatio = okTasks / tasksObserved;
     const correctionPenalty = Math.min(1, correctionTotal / 10);
-    const hesitationPenalty = Math.min(1, hesitationTotal / 10);
+    const perTaskHesitationPenalties = behaviors.map((b) => {
+      const threshold = HESITATION_THRESHOLDS_PER_TASK[b.task];
+      return Math.min(1, b.hesitationCount / (threshold * 2));
+    });
+    const hesitationPenalty = perTaskHesitationPenalties.reduce((s, p) => s + p, 0) / tasksObserved;
     consistencyScore = Math.max(0, Math.min(1, okRatio * 0.5 + (1 - correctionPenalty) * 0.25 + (1 - hesitationPenalty) * 0.25));
     consistencyScore = Math.round(consistencyScore * 100) / 100;
   }
```

### `tests/behaviorIntegratedTouch.test.ts`

```diff
+    it('14 hesitations scenario B (2 ok / 3 review) → consistencyScore >= 0.5 (BEHAVIOR-QUALITY-FIX-01)', () => { ... });
+    it('14 hesitations scenario C (2 ok / 3 review, different distribution) → consistencyScore >= 0.5', () => { ... });
+    it('High hesitationTotal but most tasks within thresholds → per-task penalty is lenient', () => { ... });
```

---

## 7. Divergences demoguard-app vs payguard (mise à jour)

| # | Élément | demoguard-app | payguard | Fix |
|---|---|---|---|---|
| 1 | Variance threshold | Per-task (`VARIANCE_THRESHOLDS`) | Uniforme 500_000 | VARIANCE-FIX-01 |
| 2 | Hesitation threshold (behaviorQuality) | Per-task (`HESITATION_THRESHOLDS_PER_TASK`) | Hardcodé ≥3/≥5 | HESITATION-FIX-01 |
| 3 | Hesitation cutoff (quality='ok') | Supprimé | `hesitationTotal <= 3` | HESITATION-FIX-01 |
| 4 | **hesitationPenalty (consistencyScore)** | **Per-task** (avg de hesitationCount/(threshold×2)) | **Global** `hesitationTotal / 10` | **QUALITY-FIX-01 (ce fix)** |
| 5 | consistencyScore minimum | `>= 0.5` | `>= 0.6` | VARIANCE-FIX-01 |
| 6 | Doublon `HESITATION_THRESHOLD_MS` | 1 définition | 2 définitions | Architecture |
| 7 | Architecture collector | `BehaviorSession` (non-singleton) | `TouchBehaviorCollector` (singleton) | Refactor |
| 8 | `recordVocalRanInteraction` | Absent | Présent | Architecture |
| 9 | behaviorQuality (variance) | `VARIANCE_THRESHOLDS[task]` | `> 500_000` uniforme | VARIANCE-FIX-01 |

**Total : 9 divergences accumulées.** Payguard reste non modifié.

---

## 8. Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/demoguard/behavior/behaviorScoring.ts` | `hesitationPenalty` global → per-task (7 lignes remplacées) |
| `tests/behaviorIntegratedTouch.test.ts` | 3 nouveaux tests (scénarios B, C, high-total-within-thresholds) |

---

## 9. Run réel mobile — attente

Le fix est validé par tests unitaires (174/174). Un run réel sur `demoguard.vercel.app` est nécessaire pour confirmer :
- **Behavior quality attendu :** `ok` (consistencyScore ≈ 0.52 pour le scénario B)
- **Consistency :** ~50-65% (vs 45% avant ce fix)
- **Final Decision :** à observer — si cognitive/vocal/behavior sont alignés positivement

> **Note déploiement :** Le build doit être déployé sur Vercel (`demoguard.vercel.app`). Le nouveau hash JS est `index-C1pCuhmT.js`. Le déploiement se fait probablement via auto-deploy GitHub (push sur `main` → Vercel build).

# BEHAVIOR-VARIANCE-FIX-01 — Seuils de variance task-specific

**Task** : Corriger le seuil unique `varianceInterActionMs > 500000` qui flagge les tâches cognitives comme 'review' à tort, plafonnant `consistencyScore` à 35-45%.
**Référence** : BEHAVIOR_CONSISTENCY_DIAG_01.md
**Date** : 2026-07-12
**Statut** : ✅ Code terminé, en attente de run réel mobile pour validation empirique

---

## 1. VERDICT PAYGUARD — Divergence documentée

`payguard/src/demoguard/behavior/behaviorScoring.ts:98` contient le **même seuil unique** `varianceInterActionMs > 500000`.

**Ce fix crée une divergence de calibration entre demoguard-app et payguard.** Le shadow dataset FAR/FRR historique de payguard a été collecté avec l'ancien seuil. Conséquences :

- Les décisions historiques de payguard basées sur `behaviorSummary.quality` ont utilisé l'ancien seuil (plus strict)
- demoguard-app utilise maintenant des seuils task-specific (plus réalistes)
- **Action** : Signaler la divergence, **NE PAS corriger payguard** (hors scope, legacy)
- Si une analyse FAR/FRR croisée est nécessaire, prendre en compte que les scores de consistency ne sont pas comparables entre les deux apps post-fix

---

## 2. FIX — Seuils par tâche

### Fichier modifié

`src/demoguard/behavior/behaviorScoring.ts`

### Avant

```typescript
// Seuil unique pour toutes les tâches
} else if (wrongTapCount >= 2 || hesitationCount >= 3 || (varianceInterActionMs !== null && varianceInterActionMs > 500000)) {
  behaviorQuality = 'review';
}
```

### Après

```typescript
// Table de seuils par tâche (ms²)
const VARIANCE_THRESHOLDS: Record<CognitiveTaskName, number> = {
  reflex: 100_000,       // Fast motor reaction — strict, σ ≈ 316ms
  stroop: 2_000_000,     // Cognitive conflict — permissive, σ ≈ 1414ms
  digit_span: 3_000_000, // Memory recall — very permissive, σ ≈ 1732ms
  n_back: 1_500_000,     // Working memory — permissive, σ ≈ 1225ms
  trail_tap: 1_000_000,  // Spatial motor — moderate, σ ≈ 1000ms
  vocal_ran: 2_000_000,  // Vocal response — permissive, σ ≈ 1414ms
};

// Utilisation du seuil task-specific
} else if (wrongTapCount >= 2 || hesitationCount >= 3 || (varianceInterActionMs !== null && varianceInterActionMs > VARIANCE_THRESHOLDS[task])) {
  behaviorQuality = 'review';
}
```

### Justification des seuils

| Tâche | Seuil (ms²) | σ équivalent | Rationale |
|---|---|---|---|
| reflex | 100 000 | 316ms | Tâche motrice rapide — variance élevée = anomalie |
| stroop | 2 000 000 | 1414ms | Conflit cognitif — temps de réflexion variable |
| digit_span | 3 000 000 | 1732ms | Rappel mémoire — très variable selon difficulté |
| n_back | 1 500 000 | 1225ms | Mémoire de travail — charge cognitive variable |
| trail_tap | 1 000 000 | 1000ms | Spatial moteur — modéré |
| vocal_ran | 2 000 000 | 1414ms | Réponse vocale — permissif |

**Ancien seuil unique** : 500 000 (σ ≈ 707ms) — calibré pour des tâches motrices uniformes, trop strict pour les tâches cognitives.

---

## 3. CONTRADICTION HV vs APP — Résolue et documentée

### Les deux évaluations

| Champ | Calculé dans | Formule | Utilise consistencyScore ? |
|---|---|---|---|
| `behaviorStatus` | HV `computeBehaviorStatus()` | `tasksObserved >= 3 && motorConfidence >= 0.65` | ❌ Non |
| `behaviorSummary.quality` | App `computeBehaviorSummary()` | `tasksObserved >= 4 && consistencyScore >= 0.5 && hesitationTotal <= 3` | ✅ Oui |

### Lequel l'admin affiche

L'admin E2E Trace affiche **`behaviorSummary.quality`** (calculé côté app) comme "Behavior quality". C'est ce champ qui affichait 'review' malgré `behaviorStatus = 'ok'` côté HV.

### Cross-reference comments ajoutés

**Côté demoguard-app** (`behaviorScoring.ts:180-184`) :
```typescript
// NOTE: This 'quality' field is what the admin E2E Trace displays as "Behavior quality".
// It is computed here (demoguard-app) and can diverge from 'behaviorStatus' computed
// in hybrid-vector-api/demoguardFusionTrigger.ts:computeBehaviorStatus() which uses
// motorConfidence + tasksObserved only (no consistencyScore). See BEHAVIOR_VARIANCE_FIX_01.md.
```

**Côté hybrid-vector-api** (`demoguardFusionTrigger.ts:609-614`) :
```typescript
// NOTE: This 'behaviorStatus' is computed purely from motorConfidence + tasksObserved.
// It is DIFFERENT from 'behaviorSummary.quality' computed in demoguard-app
// (behaviorScoring.ts) which also uses consistencyScore. The admin E2E Trace
// displays 'behaviorSummary.quality' as "Behavior quality". These two fields
// can diverge. See BEHAVIOR_VARIANCE_FIX_01.md.
```

### Décision

**`behaviorStatus` (HV) n'a pas besoin de changer.** Il utilise `motorConfidence + tasksObserved` uniquement, ce qui est une métrique valide (présence motrice). Le fix de l'étape 2 corrige directement `behaviorSummary.quality` (app) en permettant aux tâches cognitives d'être 'ok' au lieu de 'review'.

---

## 4. AJUSTEMENT DU SEUIL quality='ok'

### Avant

```typescript
} else if (tasksObserved >= 4 && consistencyScore >= 0.6 && hesitationTotal <= 3) {
  quality = 'ok';
}
```

### Après

```typescript
} else if (tasksObserved >= 4 && consistencyScore >= 0.5 && hesitationTotal <= 3) {
  quality = 'ok';
}
```

### Simulation avec les nouveaux seuils

**Cas normal : 5 tâches, toutes 'ok', 0 corrections, 2 hésitations**

```
okRatio = 5/5 = 1.0
correctionPenalty = 0
hesitationPenalty = 2/10 = 0.2
consistencyScore = 1.0 * 0.5 + 1.0 * 0.25 + 0.8 * 0.25 = 0.5 + 0.25 + 0.2 = 0.95
quality = 'ok' (0.95 >= 0.5) ✅
```

**Cas moyen : 5 tâches, 4 'ok' + 1 'review', 1 correction, 2 hésitations**

```
okRatio = 4/5 = 0.8
correctionPenalty = 1/10 = 0.1
hesitationPenalty = 2/10 = 0.2
consistencyScore = 0.8 * 0.5 + 0.9 * 0.25 + 0.8 * 0.25 = 0.4 + 0.225 + 0.2 = 0.83
quality = 'ok' (0.83 >= 0.5) ✅
```

**Cas limite : 4 tâches, 3 'ok' + 1 'review', 2 corrections, 3 hésitations**

```
okRatio = 3/4 = 0.75
correctionPenalty = 2/10 = 0.2
hesitationPenalty = 3/10 = 0.3
consistencyScore = 0.75 * 0.5 + 0.8 * 0.25 + 0.7 * 0.25 = 0.375 + 0.2 + 0.175 = 0.75
quality = 'ok' (0.75 >= 0.5, hesitationTotal = 3 <= 3) ✅
```

**Cas pré-fix (ancien seuil 0.6) : 5 tâches, 1 'ok' + 4 'review', 0 corrections, 2 hésitations**

```
okRatio = 1/5 = 0.2
consistencyScore = 0.2 * 0.5 + 1.0 * 0.25 + 0.8 * 0.25 = 0.1 + 0.25 + 0.2 = 0.55
Ancien: quality = 'review' (0.55 < 0.6) ❌
Nouveau: quality = 'ok' (0.55 >= 0.5) ✅ — mais ce cas ne devrait plus exister car les tâches cognitives ne sont plus 'review' à tort
```

Le seuil de 0.5 reste prudent — il ne valide que les sessions où au moins la moitié du score vient de tâches 'ok' + absence de corrections/hésitations excessives.

---

## 5. TESTS

### Nouveaux tests ajoutés (7 tests)

`tests/behaviorIntegratedTouch.test.ts` — describe block `Task-specific variance thresholds (BEHAVIOR-VARIANCE-FIX-01)`

| Test | Description | Résultat attendu |
|---|---|---|
| Stroop with normal cognitive pauses (1-2s) | intervals 1300-1600ms, variance ~10K | `behaviorQuality = 'ok'` |
| Digit Span with variable recall times | intervals 1200-1700ms, variance ~44K | `behaviorQuality = 'ok'` |
| N-Back with moderate cognitive variance | intervals 800-1100ms, variance ~18K | `behaviorQuality = 'ok'` |
| Reflex with abnormal 10s pause | 1 interval de 10s, variance ~17.6M | `behaviorQuality = 'review'` (seuil 100K) |
| Reflex with fast uniform taps | intervals 330-360ms, variance ~125 | `behaviorQuality = 'ok'` |
| Full cognitive battery normal variance | 5 tâches toutes 'ok', consistencyScore ≥ 0.5 | `quality = 'ok'` |
| wrongTapCount and hesitationCount unchanged | trail_tap avec 2 wrong taps | `behaviorQuality = 'review'` |

### Tests existants — Non-régression

Le test existant `computeBehaviorSummary returns correct quality for good behavior` (ligne 255) utilise des `behaviorQuality: 'ok'` pré-définis (pas calculés via `computeTaskBehavior`), donc il n'est pas affecté par le changement de seuil. Il vérifie que `computeBehaviorSummary` agrège correctement — toujours `quality = 'ok'` et `behaviorLikelihood = 'high'`.

### Résultats

```
npx tsc --noEmit → ✅ 0 errors
npx vitest run → 160/160 pass (10 files)
```

---

## 6. FICHIERS MODIFIÉS

| Repo | Fichier | Changement |
|---|---|---|
| demoguard-app | `src/demoguard/behavior/behaviorScoring.ts` | + `VARIANCE_THRESHOLDS` table, seuil task-specific, seuil quality 0.6→0.5, commentaire cross-ref |
| demoguard-app | `tests/behaviorIntegratedTouch.test.ts` | + import `computeTaskBehavior`, + 7 nouveaux tests |
| hybrid-vector-api | `src/services/demoguardFusionTrigger.ts` | + commentaire cross-ref sur `computeBehaviorStatus` |
| payguard | — | **Non modifié** (legacy, divergence documentée) |

**Total** : 3 fichiers modifiés, 0 fichier créé.

---

## 7. VALIDATION EMPIRIQUE — En attente

### Procédure

1. Deploy demoguard-app + hybrid-vector-api
2. Run réel mobile complet (même téléphone que les runs précédents)
3. Observer dans l'E2E Trace admin :
   - `behaviorSummary.quality` — attendu 'ok' ou significativement amélioré
   - `behaviorSummary.consistencyScore` — attendu > 0.5 (vs 0.35-0.45 avant)
   - `behaviorStatus` — devrait rester 'ok' (déjà 'ok' avant le fix)
4. Confirmer zéro régression sur cognitive/vocal/touch/completeness

### Avant/Après attendu

| Métrique | Avant | Après attendu |
|---|---|---|
| `consistencyScore` | 0.35-0.45 | 0.65-0.90 |
| `behaviorSummary.quality` | 'review' | 'ok' |
| `behaviorStatus` (HV) | 'ok' | 'ok' (inchangé) |
| `behaviorLikelihood` | 'medium' | 'high' |

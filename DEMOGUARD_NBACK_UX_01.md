# DEMOGUARD-NBACK-UX-01 — Refonte UX complète du N-Back

**Date :** 2026-07-11
**Task :** DEMOGUARD-NBACK-UX-01
**Scope :** `demoguard-app` uniquement
**Statut :** ✅ Implémenté, testé, build validé

---

## 1. Avant / Après

### Avant

```
PhaseHeader: "5/7 — 2/8"  ← double compteur sans légende (trial/lettre)
Affichage lettre: "C"
Texte: "Mémorisez..."  ← pas actionnable
Question: "Identique au précédent ?"  ← uniquement après disparition de la lettre
Feedback: aucun
Practice: aucun (l'utilisateur démarre directement dans le test réel)
```

### Après

```
Phase 1 — Intro:
  Titre: "Vous allez voir une suite de lettres."
  Sous-titre: "Dites si la lettre affichée est identique à la précédente."
  Exemple visuel statique:
    C → C  [Identique → Oui]  (badge vert)
    F → B  [Différent → Non]  (badge rouge)
  Bouton: "Commencer l'entraînement"

Phase 2 — Practice (2 essais):
  PhaseHeader: "Comparaison — Entraînement | 5/7 — 1/2"
  Lettre affichée 2s, puis: "Est-ce la même lettre qu'avont ?"
  Feedback explicite: "✓ Correct" (vert) ou "✗ C'était identique/différent" (rouge)
  Délai 1200ms entre essais practice
  → transition automatique vers le test réel

Phase 3 — Test réel (8 essais):
  PhaseHeader: "Comparaison (N-Back) | 5/7 — 1/8"  ← UN SEUL compteur
  Lettre affichée 2s (silence = concentration, aucun texte "Mémorisez...")
  Puis: "Est-ce la même lettre qu'avant ?"  ← instruction permanente
  Feedback discret: "✓" (gris, 400ms)  ← ne révèle pas si correct/incorrect
  Délai 400ms entre essais
```

---

## 2. Changements de paramètres protocole

| Paramètre | Avant | Après | Justification |
|-----------|-------|-------|---------------|
| `NBACK_PRACTICE_TRIALS` | 3 | **2** | Aligné sur la spécification task : "2 essais practice avec feedback explicite". Le 3e trial practice (F, non-target) n'ajoutait pas de valeur pédagogique. |
| `generateNBackPracticeTrials()` | 3 trials (C, C, F) | **2 trials (C, C)** | Garde l'exemple guidé minimal : 1 non-target + 1 target identique. L'utilisateur comprend le pattern en 2 essais. |
| Déllai feedback practice | N/A | **1200ms** | Temps suffisant pour lire le feedback "✓ Correct" / "✗ C'était identique" avant l'essai suivant. |
| Délai feedback test | 300ms | **400ms** | Léger allongement pour que le feedback discret "✓" soit perceptible sans ralentir le test. |
| Délai affichage lettre | 2000ms | **2000ms** (inchangé) | Pas de modification du timing d'affichage — reste identique au protocole original. |
| `NBACK_TRIALS` | 8 | **8** (inchangé) | Pas de réduction du nombre de trials. |
| `NBACK_TARGET_RATIO` | 0.3 | **0.3** (inchangé) | Pas de modification du ratio de targets. |
| `NBACK_LETTERS` | A-F | **A-F** (inchangé) | Pas de modification du set de lettres. |

### Thresholds de scoring — NON MODIFIÉS

Les seuils dans `cognitiveScoring.ts` et `nBackChallenge.ts` restent **strictement identiques** :

- `accuracy < 0.4` → `quality: 'failed'`
- `accuracy < 0.6 || false_positives >= 3` → `quality: 'review'`
- `accuracy >= 0.6 && false_positives < 3` → `quality: 'ok'`

Les scores d'anomalie dans `computeCognitiveSummary` (low accuracy modules, high false positives) sont inchangés.

---

## 3. Confirmation : payload n_back shape et thresholds inchangés

### NBackSignal (shape inchangée)

```typescript
interface NBackSignal {
  trials: number;          // 8
  targets: number;         // ~2-3
  hits: number;
  false_positives: number;
  misses: number;
  accuracy: number;
  avg_response_ms: number;
  quality: CognitiveQuality;  // 'ok' | 'review' | 'failed' | 'missing'
}
```

Aucun champ ajouté, supprimé ou renommé. Le payload envoyé à `hybrid-vector-api` a exactement la même structure qu'avant.

### Thresholds cognitiveScoring.ts — inchangés

- `lowAccuracyModules` filter: `accuracy < 0.4` → inchangé
- `false_positives >= 3` → anomaly score +0.1 → inchangé
- `avgModuleAccuracy` inclut `n_back.accuracy` → inchangé

### Ce qui n'a PAS changé

- `hybrid-vector-api` : **zéro modification**
- `hcs-u7-backend` : **zéro modification**
- `cognitiveScoring.ts` thresholds : **zéro modification**
- `nBackChallenge.ts` scoring logic (`computeNBackResult`) : **zéro modification**
- `NBackSignal` type : **zéro modification**

---

## 4. Fichiers modifiés

| Fichier | Action | Description |
|---------|--------|-------------|
| `src/screens/NBackScreen.tsx` | **Réécriture complète** | 3 phases (intro/practice/test), compteur unique, instruction permanente, feedback visuel |
| `src/demoguard/cognitive/nBackChallenge.ts` | Modification | `NBACK_PRACTICE_TRIALS` 3→2, `generateNBackPracticeTrials` 3→2 trials |
| `src/index.css` | Ajout | Styles `.nback-intro`, `.nback-example`, `.nback-instruction`, `.nback-feedback`, animation `nback-fade` |
| `tests/nbackUx.test.ts` | **Nouveau** | 9 tests : practice mode, compteur unique, non-régression scoring |

---

## 5. Résultats tests

### TypeScript

```
npx tsc -b
```
**Résultat :** 0 erreur ✅

### Build

```
npx vite build
```
**Résultat :** ✓ 74 modules transformed, built in 1.17s ✅

### Tests unitaires

```
npx vitest run
```
**Résultat :** 8 files, 116 tests, 100% pass ✅

Nouveaux tests (`tests/nbackUx.test.ts` — 9 tests) :

**Practice mode (3 tests) :**
- `generates exactly 2 practice trials` — vérifie que `generateNBackPracticeTrials()` retourne exactement 2 trials
- `practice trials are not counted in nbackResults scoring` — vérifie que les practice trials sont filtrés par `computeNBackResult`
- `first practice trial is non-target, second is target (guided example)` — vérifie l'ordre pédagogique

**Single counter (3 tests) :**
- `NBACK_TRIALS is 8 (real trials only, practice excluded)` — vérifie le nombre de trials réels
- `NBACK_PRACTICE_TRIALS is 2` — vérifie le nombre de trials practice
- `progress string shows only trial index / total, not mixed counters` — vérifie le format `5/7 — X/8`

**Scoring non-regression (3 tests) :**
- `computeCognitiveSummary with perfect n_back still yields high human_likelihood` — non-régression du scoring
- `computeCognitiveSummary with failed n_back (accuracy < 0.4) flags anomaly` — détection d'anomalie préservée
- `n_back signal shape is unchanged` — vérifie que tous les champs du NBackSignal sont présents

---

## 6. Décisions de design

### Feedback en mode test réel : discret, non révélateur

Le feedback en mode test est un simple "✓" gris (400ms) qui confirme que la réponse a été enregistrée, **sans révéler si elle était correcte ou incorrecte**. Ceci évite le biais d'apprentissage pendant le test réel. Seul le mode practice révèle le juste/faux.

### Silence pendant l'affichage de la lettre

Le texte "Mémorisez..." a été remplacé par un espace vide (`&nbsp;`). Le silence visuel favorise la concentration. La question "Est-ce la même lettre qu'avant ?" n'apparaît qu'après la disparition de la lettre, forçant l'utilisateur à mémoriser puis répondre.

### Exemple visuel statique dans l'intro

L'intro montre deux exemples côte à côte :
- `C → C` avec badge vert "Identique → Oui"
- `F → B` avec badge rouge "Différent → Non"

Ceci donne un modèle visuel immédiatement compréhensible sans nécessiter de lecture longue.

---

**Fin du rapport.**

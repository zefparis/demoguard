# REACTION-SIGNAL-AUDIT-01 — reaction est-il un test distinct ou redondant avec Reflex ?

**Task** : Déterminer si le signal `reaction` dans le payload DemoGuard est un test cognitif distinct ou un vestige redondant remplacé par `reflexChallenge.ts` (Reflex).
**Date** : 2026-07-12
**Verdict** : **(a) REDONDANT — reflexChallenge remplace fonctionnellement reaction**

---

## 1. COMPARAISON FONCTIONNELLLE : reactionCollector vs reflexChallenge

### `DemoGuardReactionSignal` (le type dans le schema)

```typescript
// demoguard-app/src/demoguard/types.ts:55-60
export interface DemoGuardReactionSignal {
  reaction_ms?: number;   // un seul temps de réaction
  too_fast: boolean;       // un seul booléen
  too_slow: boolean;       // un seul booléen
  quality: SignalQuality;
}
```

### `ReflexSignal` (le type produit par reflexChallenge)

```typescript
// demoguard-app/src/demoguard/cognitive/cognitiveTypes.ts:15-26
export interface ReflexSignal {
  rounds: number;          // 5 rounds
  avg_ms: number;          // moyenne
  median_ms: number;       // médiane
  variance_ms: number;     // variance
  min_ms: number;          // min
  max_ms: number;          // max
  too_fast_count: number;  // count sur 5 rounds
  too_slow_count: number;  // count sur 5 rounds
  regularity_score: number; // CV-based robot detection
  quality: CognitiveQuality;
}
```

### Analyse comparative

| Dimension | `DemoGuardReactionSignal` | `ReflexSignal` (reflexChallenge) |
|---|---|---|
| **Rounds** | 1 (single shot : `reaction_ms`) | 5 rounds minimum |
| **Métriques** | `reaction_ms`, `too_fast`, `too_slow` | avg, median, variance, min, max, too_fast_count, too_slow_count, regularity_score |
| **Détection bot** | Aucune (pas de régularité, pas de variance) | Régularité CV-based, détection robotic |
| **UI/Screen** | **Aucun** — pas de `ReactionScreen.tsx` dans le repo | `ReflexScreen.tsx` — câblé dans le flow |
| **Collector** | **Aucun** — pas de `reactionCollector.ts` dans le repo | `reflexChallenge.ts` + `ReflexScreen.tsx` |
| **Câblé dans le flow** | **Non** — `buildDemoGuardPayload.ts:37` hardcode `reaction: undefined` | **Oui** — ReflexScreen → reducer → payload |

### Verdict fonctionnel

`DemoGuardReactionSignal` est un **prototype V1 à un seul shot** (1 temps de réaction, 1 booléen too_fast/too_slow). `ReflexSignal` est l'**évolution V2 multi-rounds** (5 rounds, 9 métriques, détection robotic). Ils mesurent **le même phénomène** (temps de réaction à un stimulus visuel) mais Reflex est strictement supérieur en granularité et détection bot.

---

## 2. TRACE HISTORIQUE : INTENTION D'ORIGINE

### Git history

- **Commit initial** (`32cfe01` — DEMOGUARD-STANDALONE-01b) : `DemoGuardReactionSignal` est présent dans `types.ts` depuis le premier commit. Aucun `reactionCollector.ts` ou `ReactionScreen.tsx` n'a **jamais existé** dans le repo.
- Aucun commit n'ajoute un collector ou un screen pour `reaction`.
- Le commentaire dans `signalCompleteness.ts:6` dit explicitement : **"'reaction' is NOT a critical slot in standalone app (no separate reaction test)"**.

### Documentation

- `DEMOGUARD_PAYLOAD_PARITY_01.md:137` : **"`reaction`: toujours `null` (le state `reactionSignal` n'est jamais set à non-null)"**
- `DEMOGUARD_PAYLOAD_PARITY_01.md:370` : **"Identique dans les deux"** — payguard envoie aussi `reaction: null`
- `DEMOGUARD_PARITY_FIX_01.md:29` : `reaction: undefined` hardcodé dans `buildDemoGuardPayload.ts`

### Conclusion historique

`reaction` était prévu comme un signal placeholder dans le schema V1, jamais implémenté. Le test cognitif "Reflex" (`reflexChallenge.ts`) a été implémenté séparément comme un module cognitif à part entière (5 rounds, scoring, régularité). Le champ `reaction` dans `DemoGuardSignals` est un **vestige du schema V1** qui n'a jamais été câblé.

---

## 3. UTILISATION CÔTÉ HYBRID-VECTOR-API / BRAIN

### 3a. Schema Zod (routes/demoguard.ts:98)

```typescript
reaction: signalSlotSchema,  // accepté dans le schema mais juste un slot vide
```

### 3b. `demoguardFusionTrigger.ts` — 2 références, aucune n'exploite les données

**Ligne 54** — `mapDemoGuardToGuardResult` :
```typescript
c.includes('reaction'),  // vérifie si reaction est dans critical_missing
```
Comme `reaction` n'est **pas dans `CRITICAL_SLOTS`** côté demoguard-app (`CRITICAL_SLOTS = ['selfie', 'voice']`), cette ligne ne se déclenche **jamais**. C'est un check défensif mort.

**Ligne 130** — `buildSignalsReadyEvent` :
```typescript
hasReaction: !!signals.reaction,  // toujours false car toujours undefined/null
```
Le champ `hasReaction` est publié dans l'événement `demoguard.signals.ready` mais est **toujours `false`**. Aucun consommateur en aval ne l'utilise pour du scoring.

### 3c. Routes PayGuard / EdGuard / AccessGuard — `reaction_ms` est utilisé mais c'est un champ DIFFÉRENT

Les routes `payguard.ts`, `edguard.ts`, `accessguard.ts` utilisent `reaction_ms` (un nombre en ms) dans leur schema Zod et leur scoring (`reflexScoreFromMs(body.reaction_ms)`). Mais c'est **un champ complètement différent** du `signals.reaction` du payload DemoGuard :

- `reaction_ms` est un **top-level field** dans le payload PayGuard/EdGuard, pas `signals.reaction`
- Il vient du flux PayGuard (où l'utilisateur envoie un simple `reaction_ms` numérique), pas de DemoGuard
- DemoGuard envoie `signals.reaction: undefined` — jamais de `reaction_ms`

### 3d. HCS Backend (hcs-u7-backend)

Le HCS backend a un test `reaction_time` dans `cognitive-analysis.routes.ts` (5 tests cognitifs : stroop, digit_span, ran_vocal, reaction_time, pattern_recognition). Mais ce test `reaction_time` est alimenté par le **dashboard cognitif** (cognitive-scratch-interaction), pas par le payload DemoGuard mobile. Le payload DemoGuard envoie ses résultats cognitifs via `signals.cognitive.reflex` (le `ReflexSignal`), pas via `signals.reaction`.

### 3e. `signalCompleteness.ts` — impact sur `overall_ready`

```typescript
// demoguard-app/src/demoguard/quality/signalCompleteness.ts:15
const CRITICAL_SLOTS: (keyof DemoGuardSignals)[] = ['selfie', 'voice'];
```

`reaction` **n'est PAS dans `CRITICAL_SLOTS`** côté demoguard-app. Il n'est pas non plus dans `OPTIONAL_SLOTS`. Il n'apparaît dans aucune liste — il est **completètement ignoré** par le calcul de `signal_completeness`. Le commentaire ligne 6 le confirme : **"'reaction' is NOT a critical slot in standalone app"**.

Cependant, le test `qualityAssessors.test.ts:143` montre que si `reaction` était rempli, il compterait dans le test du 100% completeness — mais comme il est toujours `null`/`undefined`, il n'impacte pas le score.

### 3f. Résumé d'utilisation

| Localisation | Lit `signals.reaction` ? | Impact réel |
|---|---|---|
| `demoguardFusionTrigger.ts:54` | Check `critical_missing` | **Mort** — reaction n'est jamais dans critical_missing |
| `demoguardFusionTrigger.ts:130` | `hasReaction` dans event | **Toujours false** — cosmétique |
| `signalCompleteness.ts` | Non listé | **Ignoré** |
| `cognitiveScoring.ts` | N'utilise pas `signals.reaction` | **Ignoré** — utilise `signals.cognitive.reflex` |
| Routes PayGuard/EdGuard | Utilise `reaction_ms` (champ différent) | **Non concerné** |
| HCS Backend | Utilise `reaction_time` (flux dashboard) | **Non concerné** |

---

## 4. VERDICT TRANCHÉ

### **(a) REDONDANT — reflexChallenge remplace fonctionnellement reaction**

**Arguments :**

1. **Même phénomène mesuré** : temps de réaction à un stimulus visuel. Reflex est strictement supérieur (5 rounds vs 1, 9 métriques vs 3, détection robotic vs aucune).

2. **Jamais implémenté** : aucun `reactionCollector.ts`, aucun `ReactionScreen.tsx` n'a jamais existé dans le repo. Le champ est `undefined` depuis le premier commit.

3. **Jamais exploité** : aucun scoring, aucun FAR/FRR, aucun human state ne lit `signals.reaction`. Les 2 références dans `demoguardFusionTrigger.ts` sont mortes (check défensif qui ne se déclenche jamais, flag cosmétique toujours false).

4. **Remplacé par Reflex** : le test cognitif "Reflex" (`reflexChallenge.ts` + `ReflexScreen.tsx`) est câblé dans le flow, produit un `ReflexSignal` riche, et est exploité par `cognitiveScoring.ts` pour depth, anomaly, consistency et human_likelihood.

5. **Pas dans CRITICAL_SLOTS** : le commentaire dans `signalCompleteness.ts` le dit explicitement — reaction n'est pas un slot critique.

### Recommandation de nettoyage (à implémenter dans un task séparé)

1. **Retirer `reaction` de `DemoGuardSignals`** dans `demoguard-app/src/demoguard/types.ts` — supprimer `DemoGuardReactionSignal` et le champ `reaction` de l'interface
2. **Retirer `reaction: undefined`** de `buildDemoGuardPayload.ts:37`
3. **Retirer `reaction: null`** de `demoguardReducer.ts:58`
4. **Retirer `reaction` du schema Zod** dans `hybrid-vector-api/src/routes/demoguard.ts:98`
5. **Retirer `c.includes('reaction')`** de `demoguardFusionTrigger.ts:54` (check mort)
6. **Retirer `hasReaction`** de `demoguardFusionTrigger.ts:130` et du type `demoguard.ts:188`
7. **Retirer `reaction` des tests** `qualityAssessors.test.ts` (lignes 107, 116, 131, 143)
8. **Documenter la dépréciation** : ajouter un commentaire dans `types.ts` expliquant que `reaction` a été remplacé par `cognitive.reflex` (ReflexSignal)
9. **Garder compatibilité** : si un payload legacy avec `reaction: null` arrive, le schema Zod `.optional()` l'acceptera (clé absente = OK, `null` = rejet mais déjà le cas actuel)

### Note sur PayGuard / EdGuard / AccessGuard

Les champs `reaction_ms` dans ces routes sont **indépendants** du `signals.reaction` DemoGuard. Ils viennent du flux PayGuard où l'utilisateur envoie un simple nombre. Le nettoyage de `signals.reaction` n'a **aucun impact** sur ces routes.

---

## 5. ARBRE DE DÉCISION

```
reaction est-il un test distinct ?
├── Mesure-t-il quelque chose que Reflex ne capture pas ?
│   └── NON — même phénomène (RT à stimulus), Reflex a plus de métriques
├── Est-il câblé dans le flow ?
│   └── NON — pas de collector, pas de screen, hardcoded undefined
├── Est-il lu côté backend ?
│   └── NON — 2 références mortes, aucune n'exploite les données
├── Est-il dans CRITICAL_SLOTS ?
│   └── NON — explicitement exclu par commentaire
└── A-t-il jamais été implémenté ?
    └── NON — jamais de fichier reactionCollector ou ReactionScreen
→ VERDICT : REDONDANT, vestige V1, à nettoyer
```

---

## 6. FICHIERS ANALYSÉS

| Fichier | Rôle |
|---|---|
| `demoguard-app/src/demoguard/types.ts:55-60,163` | Type `DemoGuardReactionSignal` + champ dans `DemoGuardSignals` |
| `demoguard-app/src/demoguard/quality/signalCompleteness.ts:6,15` | Commentaire d'exclusion + `CRITICAL_SLOTS` sans reaction |
| `demoguard-app/src/payload/buildDemoGuardPayload.ts:37` | Hardcode `reaction: undefined` |
| `demoguard-app/src/state/demoguardReducer.ts:58` | Init `reaction: null` |
| `demoguard-app/src/demoguard/cognitive/reflexChallenge.ts` | Implémentation Reflex (5 rounds) — le remplaçant |
| `demoguard-app/src/demoguard/cognitive/cognitiveScoring.ts` | Scoring utilise `signals.cognitive.reflex`, pas `signals.reaction` |
| `demoguard-app/src/screens/ReflexScreen.tsx` | UI câblée pour Reflex |
| `hybrid-vector-api/src/types/demoguard.ts:75,188` | Schema type avec `reaction?` + `hasReaction` |
| `hybrid-vector-api/src/services/demoguardFusionTrigger.ts:54,130` | 2 références mortes |
| `hybrid-vector-api/src/routes/demoguard.ts:98` | Schema Zod avec `reaction: signalSlotSchema` |
| `hybrid-vector-api/src/routes/payguard.ts` | `reaction_ms` — champ DIFFÉRENT (PayGuard, pas DemoGuard) |
| `hcs-u7-backend/src/routes/cognitive-analysis.routes.ts` | `reaction_time` test — flux dashboard, pas DemoGuard |

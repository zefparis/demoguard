# BEHAVIOR-QUALITY-STILL-REVIEW-DIAG-01 — Pourquoi consistency reste à 45% malgré les 2 fixes

**Date :** 2026-07-12  
**Repo :** demoguard-app  
**Référence :** BEHAVIOR_HESITATION_FIX_01.md, BEHAVIOR_VARIANCE_FIX_01.md  
**Type :** Lecture seule + analyse théorique (aucune modification de code)

---

## 1. Confirmation du deploy

### 1.1 État du dépôt local

```
Commit HEAD : 04b32c8 (main, origin/main)
Date : Sun Jul 12 06:55:59 2026 +0200
Files : BEHAVIOR_HESITATION_DIAG_01.md, BEHAVIOR_HESITATION_FIX_01.md,
        behaviorScoring.ts (+28/-4), behaviorIntegratedTouch.test.ts (+118)
```

Le commit HEAD contient bien BEHAVIOR_HESITATION_FIX_01.

### 1.2 Vérification directe — `demoguard.vercel.app` est EN LIGNE

**Correction du diagnostic initial** : la vérification CLI `vercel project ls` sous le compte `lecoinrdc-7235` ne listait que `payguard` et `congogaming`. C'était une **erreur de méthode** — le CLI était authentifié sur le mauvais compte Vercel.

**Vérification directe par accès HTTP :**

```
$ curl https://demoguard.vercel.app
→ 200 OK, HTML valide
→ <title>DemoGuard</title>
→ <meta name="description" content="DemoGuard — Contrôle cognitif mobile" />
→ <script src="/assets/index-gMfUNfum.js" />
```

**Le site `demoguard.vercel.app` existe, répond, et sert bien DemoGuard.**

### 1.3 Correspondance du hash du build

Le hash du fichier JS servi par Vercel correspond **exactement** au hash du build local (commit `04b32c8`) :

| Source | Hash du JS | |
|---|---|---|
| Build local (`vite build`) | `index-gMfUNfum.js` | 209.99 kB |
| Déployé sur `demoguard.vercel.app` | `index-gMfUNfum.js` | — |

Vite utilise du **content hashing** — si les hashes correspondent, le contenu byte-à-byte est identique. **Le deploy est à jour avec le commit contenant BEHAVIOR_HESITATION_FIX_01.**

### 1.4 Vérification du contenu du JS déployé

Recherche dans le JS minifié (`dist/assets/index-gMfUNfum.js` = build local = build déployé) :

| Pattern recherché | Trouvé ? | Conclusion |
|---|---|---|
| `reflex:1,stroop:2,digit_span:4,n_back:3,trail_tap:1,vocal_ran:2` | ✅ Oui | `HESITATION_THRESHOLDS_PER_TASK` présent |
| `hesitationTotal` + `<= 3` (ancien cutoff) | ❌ Non | Ancien cutoff supprimé ✅ |
| `.5+...25+...25` (formule consistencyScore) | ✅ Oui | `hesitationPenalty` global **toujours présent** ❌ |

**Confirmation : le build déployé contient BEHAVIOR_HESITATION_FIX_01 mais aussi le `hesitationPenalty` global non fixé.**

### 1.5 Erreur de méthode du diagnostic initial

Le CLI Vercel était authentifié sur le compte `lecoinrdc-7235` (team `lecoinrdc-7235s-projects`), qui ne contient que `payguard` et `congogaming`. Le projet `demoguard` est déployé sous un **autre compte Vercel** (probablement lié au compte GitHub `zefparis` — le remote git est `git@github.com:zefparis/demoguard.git`).

```
$ npx vercel whoami
  Logged in as lecoinrdc-7235
  Active team: lecoinrdc-7235s-projects

$ npx vercel inspect demoguard.vercel.app
  Error: Can't find the deployment "demoguard.vercel.app" under the context "lecoinrdc-7235s-projects"
```

**Conclusion : le projet est déployé sur Vercel sous un compte différent, pas accessible via le CLI actuel. Le deploy est à jour. La cause #1 du diagnostic initial (deploy non effectué) est ÉCARTÉE.**

### 1.6 Verdict deploy

| Question | Réponse |
|---|---|
| `demoguard.vercel.app` existe-t-il ? | **Oui** — sert DemoGuard, 200 OK |
| Le build correspond-il au commit `04b32c8` ? | **Oui** — hash JS identique (`index-gMfUNfum.js`) |
| BEHAVIOR_HESITATION_FIX_01 est-il dans le build ? | **Oui** — seuils par tâche présents, ancien cutoff absent |
| Le `hesitationPenalty` global est-il toujours là ? | **Oui** — formule `.5+...25+...25` confirmée dans le JS |

**Le deploy est à jour. La cause du consistency à 45% est la Cause #2 : `hesitationPenalty` global dans `consistencyScore`.**

---

## 2. Analyse du code — Même si le deploy est à jour

Même en supposant que demoguard-app est correctement déployé, **il existe un deuxième mécanisme global d'hésitation** qui n'a pas été adressé par BEHAVIOR_HESITATION_FIX_01.

### 2.1 La formule `consistencyScore` — `behaviorScoring.ts:167-174`

```typescript
let consistencyScore = 0;
if (tasksObserved > 0) {
  const okTasks = behaviors.filter((b) => b.behaviorQuality === 'ok').length;
  const okRatio = okTasks / tasksObserved;
  const correctionPenalty = Math.min(1, correctionTotal / 10);
  const hesitationPenalty = Math.min(1, hesitationTotal / 10);  // ← GLOBAL !
  consistencyScore = Math.max(0, Math.min(1,
    okRatio * 0.5 + (1 - correctionPenalty) * 0.25 + (1 - hesitationPenalty) * 0.25
  ));
}
```

**`hesitationPenalty = Math.min(1, hesitationTotal / 10)`** est un **penalty global** basé sur `hesitationTotal` (somme de toutes les hésitations), pas sur les seuils par tâche.

### 2.2 Impact avec 14 hésitations

```
hesitationTotal = 14
hesitationPenalty = min(1, 14/10) = 1.0  (MAXED OUT)
```

Le terme `(1 - hesitationPenalty) * 0.25` devient `0 * 0.25 = 0`. **0.25 points perdus sur 1.0.**

La formule se réduit à :
```
consistencyScore = okRatio * 0.5 + (1 - correctionPenalty) * 0.25 + 0
```

Avec 0 corrections (`correctionPenalty = 0`) :
```
consistencyScore = okRatio * 0.5 + 0.25
```

### 2.3 Calcul pour différentes répartitions

| Répartition | okRatio | hesitationPenalty | consistencyScore | quality |
|---|---|---|---|---|
| 5 ok / 0 review | 1.0 | 1.0 | 0.75 | **ok** |
| 4 ok / 1 review | 0.8 | 1.0 | 0.65 | **ok** |
| 3 ok / 2 review | 0.6 | 1.0 | 0.55 | **ok** |
| **2 ok / 3 review** | **0.4** | **1.0** | **0.45** | **review** ← |
| 1 ok / 4 review | 0.2 | 1.0 | 0.35 | review |
| 0 ok / 5 review | 0.0 | 1.0 | 0.25 | review |

**La valeur 0.45 correspond exactement à okRatio = 0.4 (2 ok / 5 tâches) avec hesitationTotal ≥ 10.**

### 2.4 Répartitions plausibles de 14 hésitations donnant 2 ok / 3 review

Seuils : reflex=1, stroop=2, digit_span=4, n_back=3, trail_tap=1

| Scénario | reflex | stroop | digit_span | n_back | trail_tap | Total | ok | review | okRatio |
|---|---|---|---|---|---|---|---|---|---|
| A (test) | 1 ✅ | 2 ✅ | 4 ✅ | 4 ❌ | 3 ❌ | 14 | 3 | 2 | 0.6 |
| **B** | **2 ❌** | **2 ✅** | **4 ✅** | **4 ❌** | **2 ❌** | **14** | **2** | **3** | **0.4** |
| **C** | **2 ❌** | **3 ❌** | **4 ✅** | **3 ✅** | **2 ❌** | **14** | **2** | **3** | **0.4** |
| D | 3 ❌ | 3 ❌ | 4 ✅ | 2 ✅ | 2 ❌ | 14 | 2 | 3 | 0.4 |
| E | 2 ❌ | 2 ✅ | 5 ❌ | 3 ✅ | 2 ❌ | 14 | 2 | 3 | 0.4 |

**Les scénarios B, C, D, E sont tous parfaitement plausibles.** Il suffit que les hésitations soient légèrement plus concentrées sur reflex et trail_tap (qui ont des seuils stricts de 1) pour basculer de 3 ok à 2 ok.

### 2.5 Pourquoi le test du fix précédent passait

Le test `Full battery with 14 hesitations distributed plausibly → quality ok` utilise la répartition A (3 ok / 2 review) → okRatio = 0.6 → consistencyScore = 0.55 ≥ 0.5 → `quality = 'ok'`.

Mais la répartition A est **optimiste**. Dans la réalité, reflex et trail_tap (seuils = 1) sont très faciles à dépasser — un seul gap > 1500ms de plus et la tâche bascule en review.

---

## 3. Root cause — Double mécanisme global d'hésitation

### Mécanisme 1 (fixé) : Hard cutoff `hesitationTotal <= 3`
- **Statut :** Supprimé par BEHAVIOR_HESITATION_FIX_01 ✅
- L'ancienne condition `quality='ok'` nécessitait `hesitationTotal <= 3`

### Mécanisme 2 (NON fixé) : Soft penalty `hesitationPenalty = hesitationTotal / 10`
- **Statut :** Toujours présent dans `consistencyScore` ❌
- Avec `hesitationTotal = 14`, `hesitationPenalty = 1.0` (maxed)
- Réduit `consistencyScore` de 0.25 points
- Combined avec okRatio < 0.5 → `consistencyScore = 0.45 < 0.5` → `quality = 'review'`

**Le fix précédent a supprimé le cutoff hard mais laissé le penalty soft.** C'est comme enlever la porte mais laisser le mur.

---

## 4. Verdict

### Cause #1 (la plus probable) : **Deploy non effectué**

`demoguard-app` n'est pas déployé sur Vercel. Le backend fallback vers payguard. Aucun fix n'est actif lors d'un run via l'admin Cognitive Terminal.

**Action :**
1. Déployer demoguard-app sur Vercel (`npx vercel --prod`)
2. Configurer `DEMOGUARD_URL` sur Render avec l'URL de production demoguard-app
3. Refaire un run

### Cause #2 (même après deploy) : **`hesitationPenalty` global dans `consistencyScore`**

Même après deploy, si la répartition réelle des hésitations donne 2 ok / 3 review (okRatio = 0.4), le `hesitationPenalty` global maxed à 1.0 fait chuter `consistencyScore` à 0.45.

**Action proposée (BEHAVIOR-QUALITY-FIX-01) :**

Option A — **Rendre `hesitationPenalty` per-task** (cohérent avec le fix hesitation) :
```typescript
// Au lieu de : hesitationPenalty = min(1, hesitationTotal / 10)
// Calculer un penalty moyen basé sur le ratio hesitationCount / threshold par tâche
const hesitationPenalties = behaviors.map(b => {
  const threshold = HESITATION_THRESHOLDS_PER_TASK[b.task];
  return Math.min(1, b.hesitationCount / (threshold * 2));
});
const hesitationPenalty = behaviors.length > 0
  ? hesitationPenalties.reduce((s, p) => s + p, 0) / behaviors.length
  : 0;
```

Option B — **Supprimer `hesitationPenalty`** (l'hésitation est déjà capturée dans `behaviorQuality` → `okRatio`) :
```typescript
consistencyScore = okRatio * 0.7 + (1 - correctionPenalty) * 0.3;
```
Redistribue le poids 0.25 du hesitationPenalty vers okRatio (0.5 → 0.7) et correctionPenalty (0.25 → 0.3).

Option C — **Augmenter le divisor** du penalty global :
```typescript
const hesitationPenalty = Math.min(1, hesitationTotal / 20);  // au lieu de /10
```
Avec 14 hésitations : penalty = 0.7 au lieu de 1.0. ConsistencyScore = 0.4 * 0.5 + 0.25 + (1-0.7) * 0.25 = 0.20 + 0.25 + 0.075 = 0.525 ≥ 0.5 → ok.

**Recommandation :** Option A (per-task) est la plus cohérente avec l'architecture des fixes précédents. L'Option B est la plus simple. L'Option C est un patch minimal.

### Cause #3 (possible) : **Seuils encore trop stricts pour reflex/trail_tap**

Avec reflex=1 et trail_tap=1, un seul gap > 1500ms fait basculer la tâche en review. Sur un vrai run mobile, c'est très facile à dépasser (un moment de distraction, un changement de posture, un bug d'affichage).

Si après le fix du `hesitationPenalty` le problème persiste, il faudra recalibrer ces seuils avec les vraies données du run :
- reflex : 1 → 2 ?
- trail_tap : 1 → 2 ?

---

## 5. Récapitulatif des causes

| # | Cause | Statut | Impact | Fix |
|---|---|---|---|---|
| ~~1~~ | ~~Deploy non effectué~~ | **Écarté** — demoguard.vercel.app en ligne, hash JS identique | — | — |
| **2** | **`hesitationPenalty` global** dans `consistencyScore` (`hesitationTotal / 10`) | **Confirmé** — formule présente dans le JS déployé | -0.25 sur consistencyScore | Rendre per-task ou supprimer (BEHAVIOR-QUALITY-FIX-01) |
| **3** | **Seuils reflex/trail_tap = 1 trop stricts** | Possible (à confirmer avec données réelles) | 2 tâches faciles à rater en review | Recalibrer avec données réelles du prochain run |

---

## 6. Instrumentation proposée pour le prochain run

Ajouter temporairement un log côté client avant submit du payload, ou un log dans `computeBehaviorSummary` :

```typescript
// TEMPORARY DEBUG — BEHAVIOR-QUALITY-STILL-REVIEW-DIAG-01
console.log('[BEHAVIOR-DIAG] computeBehaviorSummary input:');
for (const [taskName, b] of Object.entries(taskBehaviors)) {
  if (b) {
    const hesitThreshold = HESITATION_THRESHOLDS_PER_TASK[taskName as CognitiveTaskName];
    console.log(`  ${taskName}: interactions=${b.interactionCount}, hesitations=${b.hesitationCount} (threshold=${hesitThreshold}), wrongTaps=${b.wrongTapCount ?? 0}, variance=${b.varianceInterActionMs}, quality=${b.behaviorQuality}`);
  }
}
console.log(`[BEHAVIOR-DIAG] summary: hesitationTotal=${hesitationTotal}, okRatio=${okRatio.toFixed(2)}, hesitationPenalty=${hesitationPenalty.toFixed(2)}, consistencyScore=${consistencyScore}, quality=${quality}`);
```

Cela permettra de voir la **répartition réelle** par tâche et de confirmer laquelle des causes #2 ou #3 s'applique.

---

## 7. Files examined

| File | Lines | Purpose |
|---|---|---|
| `demoguard-app/src/demoguard/behavior/behaviorScoring.ts` | 145-224 | `computeBehaviorSummary` + `consistencyScore` formula |
| `payguard/src/demoguard/behavior/behaviorScoring.ts` | 125-190 | Comparison — same `hesitationPenalty` formula, no fixes |
| `demoguard-app/DEMOGUARD_CUTOVER_AUDIT_01.md` | 15, 37, 232 | `DEMOGUARD_URL` fallback to payguard |
| `demoguard-app/vercel.json` | 1-13 | Vercel config exists but project not linked/deployed |

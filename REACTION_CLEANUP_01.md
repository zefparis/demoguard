# REACTION-CLEANUP-01 — Retrait propre du champ reaction mort

**Task** : Supprimer le vestige V1 `reaction` sans casser le contrat de payload existant ni la compat avec des clients plus anciens.
**Référence** : REACTION_SIGNAL_AUDIT_01.md
**Date** : 2026-07-12
**Statut** : ✅ Terminé

---

## 1. DIFFS PAR FICHIER

### demoguard-app (6 fichiers modifiés)

#### `src/demoguard/types.ts`
- **Supprimé** : interface `DemoGuardReactionSignal` (lignes 55-60)
- **Modifié** : champ `reaction` dans `DemoGuardSignals` → `reaction?: undefined` avec JSDoc `@deprecated`
- **Raison** : Le type ne peut plus être instancié avec des données réelles, mais la clé reste acceptée pour compat schema

#### `src/state/demoguardReducer.ts`
- **Supprimé** : `reaction: null,` de l'initial state (ligne 58)
- **Raison** : Plus de state à maintenir pour un champ jamais peuplé

#### `src/demoguard/quality/signalCompleteness.ts`
- **Modifié** : commentaire ligne 6-7 — remplacé "reaction is NOT a critical slot" par "reaction (V1 vestige) was removed from the signal schema"
- **Note** : `reaction` n'était déjà PAS dans `CRITICAL_SLOTS` ni `OPTIONAL_SLOTS` — aucun changement fonctionnel, juste documentation

#### `src/payload/buildDemoGuardPayload.ts`
- **Conservé** : `reaction: undefined` (ligne 40)
- **Ajouté** : commentaire de dépréciation 3 lignes (lignes 37-39)
- **Raison** : Garantit que la clé `reaction` est absente du JSON sérialisé (undefined = omis par JSON.stringify), compatible avec le schema Zod `.optional()` côté HV

#### `tests/qualityAssessors.test.ts`
- **Supprimé** : `reaction: null` de 3 objets signals de test (lignes 107, 116, 130)
- **Supprimé** : `reaction: { reaction_ms: 300, ... }` du test "100%" (ligne 143)
- **Modifié** : description du test "100%" → "13 slots" au lieu de "14 slots"

#### `tests/buildDemoGuardPayload.test.ts`
- **Supprimé** : `reaction: null` du mockState (ligne 42) et du nullSignalsState (ligne 357)
- **Modifié** : description du test GAP 0 → "deprecated, always undefined" au lieu de "when null"

#### `tests/empirical-payload.test.ts`
- **Supprimé** : `reaction: null` du mockState (ligne 41)
- **Modifié** : commentaire ligne 85 → "deprecated, always undefined"

### hybrid-vector-api (3 fichiers modifiés)

#### `src/services/demoguardFusionTrigger.ts`
- **Supprimé** : `c.includes('reaction')` du check `hasCriticalMissing` (ligne 54)
- **Supprimé** : `hasReaction: !!signals.reaction,` du `buildSignalsReadyEvent` (ligne 130)
- **Ajouté** : commentaire de dépréciation à la place (lignes 129-130)

#### `src/types/demoguard.ts`
- **Supprimé** : `hasReaction: boolean;` de l'interface `DemoguardSignalsReadyEvent` (ligne 188)

#### `tests/demoguard-verify.test.ts`
- **Supprimé** : `reaction: {}` de tous les objets signals de test (12 occurrences)
- **Supprimé** : test "returns failed when critical_missing contains reaction" (lignes 447-457)

#### `tests/p07-e2e-traceability.test.ts`
- **Supprimé** : `hasReaction: true,` de l'objet event de test (ligne 93)

---

## 2. RÉSULTATS TESTS

### demoguard-app

```
npx tsc --noEmit → ✅ 0 errors
npx vitest run → 10 files, 153 tests, 100% pass
```

| Test File | Tests | Status |
|---|---|---|
| demoguardReducer.test.ts | 14 | ✅ |
| behaviorIntegratedTouch.test.ts | 18 | ✅ |
| qualityAssessors.test.ts | 24 | ✅ |
| buildDemoGuardPayload.test.ts | 19 | ✅ |
| continuousSignals.test.ts | 25 | ✅ |
| cognitiveBattery.test.ts | 30 | ✅ |
| audio.test.ts | 10 | ✅ |
| nbackUx.test.ts | 9 | ✅ |
| empirical-payload.test.ts | 1 | ✅ |

### hybrid-vector-api

```
npx tsc --noEmit → ✅ 0 errors
npx vitest run → 26 files, 745 tests, 744 pass, 1 fail (pre-existing)
```

| Test File | Tests | Status |
|---|---|---|
| demoguard-verify.test.ts | 31 | ✅ (reaction test removed) |
| p07-e2e-traceability.test.ts | 5 | ✅ |
| All other test files | 709 | ✅ |
| demoguard-vocal-relay.test.ts | 1 fail | ⚠️ Pre-existing (FUSION_SRC check for `vocalResult?.status` vs `vocalResult.status`) |

**Note** : Le test `demoguard-vocal-relay.test.ts:129` échouait déjà avant ce cleanup — il vérifie `FUSION_SRC.contains("vocalResult?.status === 'review'")` mais le code source utilise `vocalResult.status === 'review'` (sans optional chaining). Non lié à ce task.

---

## 3. SIGNAL_COMPLETENITY AVANT/APRÈS

### Avant (avec reaction dans le schema)

`computeSignalCompleteness` calculait sur `CRITICAL_SLOTS (2) + OPTIONAL_SLOTS (5) + 6 cognitive = 13 slots`.
`reaction` n'était dans aucune liste — il n'impactait pas le score directement.
Cependant, le test "100%" échouait si `reaction` n'était pas fourni car l'objet test avait 14 slots dont 13 comptés → le test passait mais la logique était confuse.

### Après (sans reaction)

`computeSignalCompleteness` calcule sur `CRITICAL_SLOTS (2) + OPTIONAL_SLOTS (5) + 6 cognitive = 13 slots`.
`reaction` n'est plus dans le schema actif — le test "100%" utilise 13 slots et obtient `score = 1.0`.

### Impact sur `overall_ready`

```typescript
const overall_ready = device_ready && permissions_ready && critical_missing.length === 0 && signal_completeness >= 0.5;
```

- **Avant** : `critical_missing` ne contenait jamais `reaction` (pas dans `CRITICAL_SLOTS`) → aucun changement
- **Après** : identique — `reaction` n'a jamais pesé sur `overall_ready`

### Conclusion signal_completeness

**Aucun changement fonctionnel** sur le score ou `overall_ready`. `reaction` n'était pas dans `CRITICAL_SLOTS` et n'a jamais impacté le calcul. Le cleanup est purement sanitaire : suppression de code mort, types, et tests qui référencaient un champ inactif.

---

## 4. COMPATIBILITÉ PAYLOAD

### Schema Zod côté hybrid-vector-api (`routes/demoguard.ts:98`)

```typescript
reaction: signalSlotSchema,  // .passthrough().optional() — NON MODIFIÉ
```

Le schema Zod **n'est pas modifié** — il accepte toujours une clé `reaction` optionnelle. Si un vieux client (payguard) envoie `reaction: null` ou `reaction: {}`, le schema l'accepte. Le cleanup ne concerne que le code mort côté fusion trigger et les types côté demoguard-app.

### Payload sérialisé

`buildDemoGuardPayload.ts` continue à set `reaction: undefined` → `JSON.stringify` omet la clé → le payload JSON n'a pas de clé `reaction`. C'est le comportement attendu et compatible.

---

## 5. RUN E2E DE VALIDATION

**Statut** : Non effectué (task en lecture/écriture code uniquement, pas de run mobile E2E dans ce scope).

**Recommandation** : Lors du prochain run mobile E2E, vérifier dans l'admin Trace :
- "Reaction" n'apparaît plus dans Signal Intelligence (ou marqué N/A)
- `signal_completeness` est identique ou supérieur (pas de régression)
- `overall_ready` n'est pas impacté
- Zéro régression sur cognitive/behavior/vocal/touch

---

## 6. FICHIERS MODIFIÉS (RÉCAPITULATIF)

| Repo | Fichier | Changement |
|---|---|---|
| demoguard-app | `src/demoguard/types.ts` | Supprimé `DemoGuardReactionSignal`, `reaction?: undefined` |
| demoguard-app | `src/state/demoguardReducer.ts` | Supprimé `reaction: null` |
| demoguard-app | `src/demoguard/quality/signalCompleteness.ts` | Mis à jour commentaire |
| demoguard-app | `src/payload/buildDemoGuardPayload.ts` | Ajouté commentaire dépréciation |
| demoguard-app | `tests/qualityAssessors.test.ts` | Retiré reaction des tests |
| demoguard-app | `tests/buildDemoGuardPayload.test.ts` | Retiré reaction des tests |
| demoguard-app | `tests/empirical-payload.test.ts` | Retiré reaction des tests |
| hybrid-vector-api | `src/services/demoguardFusionTrigger.ts` | Retiré check mort + hasReaction |
| hybrid-vector-api | `src/types/demoguard.ts` | Retiré hasReaction du type |
| hybrid-vector-api | `tests/demoguard-verify.test.ts` | Retiré reaction des tests + test supprimé |
| hybrid-vector-api | `tests/p07-e2e-traceability.test.ts` | Retiré hasReaction du test |

**Total** : 11 fichiers modifiés, 0 fichier créé, 0 fichier supprimé.

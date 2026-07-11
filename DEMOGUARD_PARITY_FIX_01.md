# DEMOGUARD-PARITY-FIX-01 — Fix confirmé par test empirique

**Date :** 2026-07-11
**Task :** DEMOGUARD-PARITY-FIX-01
**Prérequis :** DEMOGUARD_PAYLOAD_PARITY_01.md (audit de parity)
**Statut :** ✅ Implémenté, testé, validé empiriquement

---

## 1. Contexte

Le curl direct contre hybrid-vector-api a confirmé que `reaction: null` est rejeté par le schema Zod (`signalSlotSchema = passthrough().optional()`, n'accepte pas `null`). Le Gap 0 n'est plus conditionnel — il est **bloquant**, au même titre que Gap 1.

---

## 2. Fixes appliqués

### GAP 0 — BLOQUANT — null → undefined pour tous les signal slots

**Problème :** `buildDemoGuardPayload.ts` assignait `null` explicite pour `reaction` et passait les autres signaux tels quels (pouvant être `null`). Le schema Zod `.optional()` accepte `undefined` (clé absente du JSON) mais rejette `null`.

**Fix :** Conversion `?? undefined` pour tous les signal slots avant assemblage.

**Fichier :** `src/payload/buildDemoGuardPayload.ts:35-43`

```typescript
const signals: DemoGuardSignals = {
  selfie: state.signals.selfie ?? undefined,
  reaction: undefined,
  voice: state.signals.voice ?? undefined,
  motion: state.signals.motion ?? undefined,
  orientation: state.signals.orientation ?? undefined,
  touch: state.signals.touch ?? undefined,
  visibility: state.signals.visibility ?? undefined,
  network: state.signals.network ?? undefined,
  // ...
};
```

**Effet :** `JSON.stringify` omet les clés `undefined` → Zod `.optional()` accepte l'absence.

**Type :** `DemoGuardSignals` mis à jour pour accepter `T | null | undefined` sur tous les signal slots (`src/demoguard/types.ts:161-175`).

### GAP 1 — CRITIQUE — cognitive.summary jamais calculé

**Problème :** `computeCognitiveSummary()` existe dans `cognitiveScoring.ts` mais n'était jamais appelé dans le flow demoguard-app. Le payload envoyait `cognitive.summary: null` → rejeté par Zod.

**Fix :** Appel à `computeCognitiveSummary()` dans `buildDemoGuardPayload.ts` avant assemblage du payload.

**Fichier :** `src/payload/buildDemoGuardPayload.ts:31-33`

```typescript
const cognitiveWithSummary = state.cognitiveSignals
  ? { ...state.cognitiveSignals, summary: computeCognitiveSummary(state.cognitiveSignals) }
  : null;
```

**Effet :** `cognitive.summary` est maintenant un objet réel avec `completed_modules`, `total_modules`, `depth_score`, `consistency_score`, `anomaly_score`, `human_likelihood`, `quality`.

### GAP 3 — touchDiagnostics toujours undefined

**Problème :** Aucune action du reducer ne set `state.touchDiagnostic`. Le payload envoyait `touchDiagnostics: undefined` (clé absente). Payguard a une fonction `buildTouchDiagnosticsSafe` qui retourne toujours un objet.

**Fix :** Port de `buildTouchDiagnosticsSafe` depuis payguard dans un nouveau fichier `src/payload/diagnosticsSafe.ts`. La fonction est appelée dans `buildDemoGuardPayload.ts`.

**Fichier :** `src/payload/diagnosticsSafe.ts:59-82` + `src/payload/buildDemoGuardPayload.ts:51-54`

```typescript
touchDiagnostics: buildTouchDiagnosticsSafe(
  state.signals.touch,
  behaviorDiag,
),
```

**Effet :** `touchDiagnostics` est maintenant toujours un objet (status `missing` si pas de touch, sinon basé sur behaviorDiag ou touchSignal).

### GAP 4 — voiceDiagnostics undefined si voix absente

**Problème :** `VoiceScreen` ne set le diagnostic que si voix enregistrée. Pas de fallback. Payguard a `buildVoiceDiagnosticsSafe` qui retourne toujours un objet avec fallback `not_checked` / `voice_missing`.

**Fix :** Port de `buildVoiceDiagnosticsSafe` depuis payguard dans `src/payload/diagnosticsSafe.ts`. La fonction est appelée dans `buildDemoGuardPayload.ts`.

**Fichier :** `src/payload/diagnosticsSafe.ts:19-57` + `src/payload/buildDemoGuardPayload.ts:46-50`

```typescript
voiceDiagnostics: buildVoiceDiagnosticsSafe(
  state.signals.voice,
  state.voiceDiagnostic,
  !!sensitive.voice_b64,
),
```

**Effet :** `voiceDiagnostics` est maintenant toujours un objet :
- Si `voiceDiagnostic` existe → objet réel
- Si voix enregistrée mais pas de diagnostic → `status: 'not_checked'`, `reasonSafe: 'not_attempted'`
- Si pas de voix → `status: 'not_checked'`, `reasonSafe: 'voice_missing'`

### GAP 2 — vocal_ran — Dette technique documentée

**Problème :** `VoiceScreen.onComplete` passe 5 arguments (incluant `vocalRan`), mais `App.tsx:handleVoiceCaptured` n'en reçoit que 4 → `vocalRan` signal est droppé.

**Statut :** Non fixé dans cette itération. Documenté comme dette technique. Le payload envoie `vocal_ran: null` dans `cognitive`, ce qui est accepté par Zod (le slot cognitive est `.nullable()`).

**Fix futur :** Ajouter le 5e paramètre `vocalRan: VocalRanSignal` dans `App.tsx:handleVoiceCaptured` et dispatcher une action `COGNITIVE_TEST_COMPLETED` avec `testName: 'vocal_ran'`.

---

## 3. Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `src/payload/buildDemoGuardPayload.ts` | GAP 0, 1, 3, 4 — conversion null→undefined, computeCognitiveSummary, buildVoiceDiagnosticsSafe, buildTouchDiagnosticsSafe |
| `src/payload/diagnosticsSafe.ts` | **Nouveau** — Port de `buildVoiceDiagnosticsSafe` et `buildTouchDiagnosticsSafe` depuis payguard |
| `src/demoguard/types.ts` | GAP 0 — `DemoGuardSignals` interface: `T \| null` → `T \| null \| undefined` |
| `tests/buildDemoGuardPayload.test.ts` | Tests adaptés (null→undefined) + 8 nouveaux tests pour les gaps |
| `tests/empirical-payload.test.ts` | **Nouveau** — Génère le payload réel pour validation curl |

---

## 4. Validation

### 4.1 TypeScript

```
npx tsc --noEmit
```
**Résultat :** 0 erreur ✅

### 4.2 Build

```
npx vite build
```
**Résultat :** ✓ 74 modules transformed, built in 1.17s ✅

### 4.3 Tests unitaires

```
npx vitest run
```
**Résultat :** 7 files, 107 tests, 100% pass ✅

Nouveaux tests :
- `GAP 0: reaction key absent from JSON when null`
- `GAP 0: all null signal slots are undefined (omitted from JSON)`
- `GAP 1: cognitive.summary is a computed object (not null)`
- `GAP 1: cognitive.summary is null when cognitiveSignals is null`
- `GAP 3: touchDiagnostics is an object even when touch is null and behaviorDiag is null`
- `GAP 3: touchDiagnostics uses behaviorDiag when available`
- `GAP 4: voiceDiagnostics is an object even when voice is null and no diagnostic`
- `GAP 4: voiceDiagnostics fallback to not_checked when voice recorded but no diagnostic`

### 4.4 Validation empirique — curl contre hybrid-vector-api

**Payload généré :** `tests/empirical-payload-output.json` (produit par `buildDemoGuardPayload` avec un mock state complet)

**Commande exécutée :**

```bash
curl.exe -s -X POST \
  "https://hybrid-vector-api-m5xt.onrender.com/demoguard/verify" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <HV_API_KEY>" \
  -d "@tests/empirical-payload-output.json"
```

**Réponse de l'API :**

```json
{
  "ok": true,
  "source": "demoguard_mobile",
  "status": "submitted",
  "received": true,
  "quality_score": 0.9230769230769231,
  "ready": true,
  "traceId": "dg_8dae15a2",
  "message": "HCS result unavailable",
  "hybridFusion": {
    "triggered": true,
    "globalDecision": "REVIEW",
    "trustLevel": "medium",
    "cognitiveStatus": "passed",
    "monitoringRecorded": true,
    "monitoringStatus": "recorded",
    "behaviorStatus": "missing"
  }
}
```

**Verdict :** `{"ok":true}` — **Aucune erreur Zod** ✅

Le payload produit par `buildDemoGuardPayload` après les fixes est accepté par le schema Zod de hybrid-vector-api.

### 4.5 Vérifications clés dans le payload

| Champ | Avant fix | Après fix | Status |
|-------|-----------|-----------|--------|
| `signals.reaction` | `null` (rejeté Zod) | absent du JSON | ✅ |
| `signals.cognitive.summary` | `null` (rejeté Zod) | objet réel (`completed_modules: 5`) | ✅ |
| `signals.touchDiagnostics` | `undefined` (absent) | objet (`status: "ok"`) | ✅ |
| `signals.voiceDiagnostics` | `undefined` si pas de voix | objet (`status: "not_checked"`) | ✅ |
| `signals.cognitive.vocal_ran` | `null` | `null` (dette technique, accepté par Zod) | ⚠️ |

---

## 5. Étapes suivantes (non incluses dans ce fix)

1. **Run réel téléphone** : Lancer demoguard-app sur téléphone, effectuer un run complet, submit, vérifier la réponse API.
2. **E2E Trace admin** : Vérifier dans l'admin HCS que le trace est visible avec les bonnes données.
3. **GAP 2 (vocal_ran)** : Fixer le mismatch de signature entre `VoiceScreen.onComplete` (5 args) et `App.tsx:handleVoiceCaptured` (4 args).
4. **Déploiement** : Déployer demoguard-app sur Vercel avec les variables d'environnement correctes (`HV_API_KEY`, `DEMOGUARD_TENANT_ID`, `PAYGUARD_ALLOWED_ORIGINS`).

---

**Fin du rapport.**

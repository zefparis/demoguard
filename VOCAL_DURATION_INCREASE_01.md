# VOCAL-DURATION-INCREASE-01 — Augmentation durée d'acquisition vocale

**Task** : Augmenter le temps de capture vocale de 4000ms à 7000ms pour permettre à `breathingPresence` et `pitchDynamics` de se manifester naturellement et sortir de la zone `review` (confidence 69-72%, seuil `passed` à 0.75).
**Repo** : `demoguard-app`
**Date** : 2026-07-12

---

## 1. VÉRIFICATIONS AVANT CHANGEMENT

### 1a. Constante de durée actuelle

**Fichier** : `src/demoguard/collectors/audioCollector.ts:21`

```typescript
export const VOICE_DURATION_MS = 4000;  // ← AVANT
```

Utilisée dans :
- `src/screens/VoiceScreen.tsx:39` — `recordVoiceChallenge(VOICE_DURATION_MS, ...)`
- `src/screens/VoiceScreen.tsx:80` — `Durée : {VOICE_DURATION_MS / 1000}s` (UI dynamique, déjà liée à la constante)
- `src/demoguard/collectors/audioCollector.ts:49` — `durationMs: number = VOICE_DURATION_MS` (default param)

**Aucune valeur hardcodée `4000` trouvée ailleurs dans le code source** (uniquement dans les tests comme données mock, pas liés à la constante).

### 1b. Limites backend — aucune contrainte bloquante

| Limite | Valeur | Source | Impact pour 7s |
|---|---|---|---|
| `bodyLimit` (route voice) | 5 MB | `hcs-u7-backend/src/routes/demoguard-voice-analysis.routes.ts:163` | 7s WAV 16kHz mono 16-bit = ~224KB → ✅ |
| `WAV_MAX_DURATION_MS` | 120 000 ms (120s) | `hcs-u7-backend/src/routes/voice-biometrics.routes.ts:48` | 7s → ✅ |
| `WAV_MAX_SIZE_BYTES` | 10 MB | `hcs-u7-backend/src/routes/voice-biometrics.routes.ts:49` | ~224KB → ✅ |
| `requestTimeout` (server) | 30 000 ms | `hcs-u7-backend/src/server.ts:412` | 7s audio + processing → ✅ |
| `TIMEOUT_MS` (relay HCS) | 10 000 ms | `hybrid-vector-api/src/services/hcsVocalRelay.ts:19` | Processing < 3s → ✅ |

**Calcul taille payload** :
- 7s × 16000 Hz × 2 bytes (16-bit PCM) = 224 000 bytes = ~219 KB
- Base64 : ~292 KB
- Bien sous 5 MB (route voice) et 10 MB (voice-biometrics)

### 1c. MFCC — s'adapte à durée variable

**Fichier** : `src/lib/audio.ts:107-142`

```typescript
function extractMFCC(audioData: Float32Array, sampleRate: number): Float32Array {
  const winSize = Math.floor(sampleRate * 0.025)   // 25ms window
  const hopSize = Math.floor(sampleRate * 0.01)    // 10ms hop
  // ...
  const frames = [] // dynamique — basé sur la longueur de audioData
  // ...
  const mfccSum = new Float32Array(numMfcc)        // 40 coefficients
  for (const frame of frames) { /* accumulate */ }
  for (let i = 0; i < numMfcc; i++) mfccSum[i] /= frames.length  // moyenne
  // Output: toujours 192 dimensions (40 MFCC répétés/tiled)
}
```

Le calcul MFCC :
- **Nombre de frames dynamique** : basé sur `audioData.length`, pas un count fixe
- **Output toujours 192-dim** : les 40 coefficients MFCC sont moyennés sur toutes les frames, puis tiled à 192
- **Aucune hypothèse sur 4s** : s'adapte à n'importe quelle durée

---

## 2. CHANGEMENT APPLIQUÉ

### Diff

```diff
--- a/src/demoguard/collectors/audioCollector.ts
+++ b/src/demoguard/collectors/audioCollector.ts
@@ -18,7 +18,7 @@
   return 'large';
 }
 
-export const VOICE_DURATION_MS = 4000;
+export const VOICE_DURATION_MS = 7000;
```

**Fichier unique modifié** : `src/demoguard/collectors/audioCollector.ts`

### UI — déjà dynamique

`VoiceScreen.tsx:80` affiche `{VOICE_DURATION_MS / 1000}s` — affiche maintenant **"Durée : 7s"** automatiquement, aucune modification nécessaire.

### Tests — ajout de 2 tests

```diff
--- a/tests/audio.test.ts
+++ b/tests/audio.test.ts
+import { VOICE_DURATION_MS } from '../src/demoguard/collectors/audioCollector';
+
+describe('VOICE_DURATION_MS constant', () => {
+  it('is set to 7000ms (not the old 4000ms)', () => {
+    expect(VOICE_DURATION_MS).toBe(7000);
+  });
+
+  it('recordAudio with 7000ms produces ~7s buffer at 16kHz', async () => {
+    // ... mock AudioContext, simulate 28 frames of 4096 samples
+    // 28 × 4096 = 114 688 samples at 16kHz = 7.168s
+    expect(samples.length).toBe(114688);
+    expect(samples.length).toBeGreaterThan(100000); // well above 4s (64000)
+  });
+});
```

---

## 3. RÉSULTATS TESTS

### TypeScript

```
npx tsc --noEmit → exit 0 ✅
```

### Build

```
npm run build → exit 0 ✅
  dist/assets/index-DGyVnUFH.js   208.99 kB │ gzip: 65.75 kB
  built in 1.11s
```

### Vitest

```
npx vitest run → 10 test files, 153 tests, ALL PASS ✅
  Duration: 4.89s
```

Nouveaux tests :
- `VOICE_DURATION_MS constant > is set to 7000ms (not the old 4000ms)` ✅
- `VOICE_DURATION_MS constant > recordAudio with 7000ms produces ~7s buffer at 16kHz` ✅
  - Vérifie : 28 frames × 4096 = 114 688 samples (= 7.168s à 16kHz)
  - Vérifie : > 100 000 samples (bien au-dessus des 64 000 de l'ancien 4s)

---

## 4. ANALYSE — POURQUOI 7000ms DEVRAIT AMÉLIORER LA CONFIDENCE

### Impact attendu sur les scores composite

D'après l'analyse VOCAL_LIVENESS_COMPARE_01.md, le score composite pour 4s était :

| Dimension | Score (4s) | Score attendu (7s) | Raison |
|---|---|---|---|
| `formantNaturalness` (×0.25) | ~1.0 | ~1.0 | Inchangé |
| `microVariationScore` (×0.30) | ~1.0 | ~1.0 | Inchangé |
| `harmonicBalance` (×0.20) | ~1.0 | ~1.0 | Inchangé |
| `breathingPresence` (×0.15) | **~0.8** (0 breaths) | **~1.0** (1+ breaths probables) | 7s donne assez de temps pour détecter ≥1 respiration |
| `pitchDynamics` (×0.10) | **~0.4-0.6** | **~0.7-0.9** | Plus de variation de pitch sur phrase plus longue |
| **Total** | **~0.71** | **~0.78-0.82** | **≥ 0.75 → isHuman=true → passed** |

### Seuils backend (rappel)

- `isHuman = confidence >= 0.75` (`liveness-detection.ts:293`)
- `passed = isHuman && confidence >= 0.70` (`demoguard-voice-analysis.routes.ts:339`)
- `review = isHuman && confidence < 0.70` ou `!isHuman && 0-1 replay flag`

Avec ~0.78-0.82 : `isHuman=true` (≥0.75) + `confidence >= 0.70` → **passed** ✅

---

## 5. VALIDATION EMPIRIQUE — EN ATTENTE

### Procédure de test mobile

1. **Build & deploy** DemoGuard sur téléphone de test
2. **Run** : voix normale, parler pendant toute la durée (7s — ne pas s'arrêter avant)
3. **Vérifier** E2E Trace admin : comparer confidence vs runs précédents (69-72%)
4. **Si toujours < 0.75** : augmenter à 9000-10000ms et retester
5. **Confirmer** zéro régression sur cognitive/behavior/completeness

### Métriques à comparer

| Métrique | Avant (4s) | Après (7s) | Objectif |
|---|---|---|---|
| `confidence` | 0.69-0.72 | ? | ≥ 0.75 |
| `status` | review | ? | passed |
| `reasonSafe` | `voice_liveness_low_confidence` | ? | `voice_checked` |
| `livenessStatus` | review | ? | present |
| `breathingPresence` score | ~0.8 | ? | ~1.0 |
| `pitchDynamics` score | ~0.4-0.6 | ? | ~0.7-0.9 |

### Trace ID de référence (avant)

_À compléter après run mobile_

### Trace ID après changement

_À compléter après run mobile_

---

## 6. FICHIER MODIFIÉ

| Fichier | Changement |
|---|---|
| `src/demoguard/collectors/audioCollector.ts` | `VOICE_DURATION_MS`: 4000 → 7000 |
| `tests/audio.test.ts` | +2 tests: constante = 7000, buffer ~7s à 16kHz |

**Aucun autre fichier modifié** — l'UI (`VoiceScreen.tsx`) utilise déjà la constante dynamiquement.

---

## 7. PROCHAINES ÉTAPES

- [ ] Run mobile avec 7000ms → vérifier confidence dans E2E Trace
- [ ] Si confidence ≥ 0.75 → ✅ terminé, comportement passed confirmé
- [ ] Si confidence < 0.75 → augmenter à 9000-10000ms, retester
- [ ] Documenter trace ID et confidence obtenue dans ce rapport

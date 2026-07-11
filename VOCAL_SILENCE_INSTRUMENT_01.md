# VOCAL-SILENCE-INSTRUMENT-01 — Logging réel + fix conditionnel

**Task** : Instrumenter le pipeline vocal pour diagnostiquer les `audio_too_silent` en production, et ajouter un guard AudioContext côté demoguard-app.
**Date** : 2026-07-12
**Statut** : ✅ Code terminé, en attente de run réel mobile pour validation empirique

---

## 1. INSTRUMENTATION CÔTÉ HV — Déjà en place ✅

### Découverte

L'instrumentation est **déjà complète** côté hybrid-vector-api. Aucune modification nécessaire.

#### Flow existant

```
runHybridVocalQuickGate()
  → VocalQuickGateResult.audioMetrics (rms, peak, silenceRatio, normalizedRms, etc.)
    → buildVoiceDiagnosticsSafe() [demoguardFusionTrigger.ts:657-730]
      → quickGate?.audioMetrics injecté dans VoiceDiagnosticsSafe.audioMetrics (lignes 684, 708)
        → recordDecisionToHCS() [envoyé au HCS backend monitoring]
        → return final [inclus dans la réponse API]
```

#### Type `VoiceDiagnosticsSafe` (HV-side)

```typescript
// hybrid-vector-api/src/types/demoguard.ts:263-294
export interface VoiceDiagnosticsSafe {
  // ... champs standards ...
  audioMetrics?: {
    decoded: boolean;
    sampleRate: number | null;
    sampleCount: number | null;
    durationMsDecoded: number | null;
    rms: number | null;           // ← RMS du signal mono (avant normalisation)
    peak: number | null;           // ← Peak amplitude
    zeroCrossingRate: number | null;
    silenceRatio: number | null;   // ← Ratio de frames silencieuses
    clippingRatio: number | null;
    normalizedRms: number | null;  // ← RMS après normalisation -20dB
    qualityReason: string | null;
  };
}
```

#### Schema Zod

```typescript
// hybrid-vector-api/src/routes/demoguard.ts:56-69
const voiceDiagnosticsSchema = z.object({
  // ... champs standards ...
}).passthrough().optional();  // ← .passthrough() accepte audioMetrics
```

Le schema utilise `.passthrough()` — les champs additionnels (`audioMetrics`, `quickGateStatus`, etc.) ne sont pas stripés par Zod.

### Conclusion HV

**Aucun changement nécessaire.** Les `audioMetrics.rms` et `audioMetrics.peak` sont déjà :
1. Calculés par `computeSafeAudioMetrics()` dans `decodeAudioSafe.ts`
2. Injectés dans `VoiceDiagnosticsSafe` par `buildVoiceDiagnosticsSafe()`
3. Envoyés au HCS backend monitoring via `recordDecisionToHCS()`
4. Inclus dans la réponse API finale

Ils devraient donc déjà apparaître dans l'E2E Trace admin **si le HCS backend les stocke et les affiche**. Si ce n'est pas le cas, le problème est côté HCS backend (stockage/affichage), pas côté HV.

---

## 2. CÔTÉ DEMOGUARD-APP — Guard AudioContext ✅

### Fichier modifié

`src/lib/audio.ts` — fonction `recordAudio()`

### Changements

#### a) Vérification `ctx.state` après création

```typescript
// audio.ts:222-233
if (ctx.state === 'suspended') {
  if (isDev) console.log('[audio] AudioContext suspended before recording, attempting resume()');
  try {
    await ctx.resume();
  } catch {
    // resume() can fail if not triggered by user gesture — non-fatal
  }
  if (isDev) console.log('[audio] AudioContext state after resume():', ctx.state);
  if (ctx.state as string !== 'running') {
    console.warn('[audio] AudioContext still not running after resume() — recording may produce silent buffers');
  }
}
```

- Détecte si l'AudioContext démarre en état `suspended` (problème connu iOS Safari)
- Tente `ctx.resume()` automatiquement
- Log dev-only avant/après `resume()`
- Warning explicite si le contexte reste suspended après resume

#### b) Guard zero-chunk (premier onaudioprocess)

```typescript
// audio.ts:253-263
if (chunks.length > 0) {
  const firstChunk = chunks[0]
  let allZeros = true
  for (let i = 0; i < Math.min(firstChunk.length, 256); i++) {
    if (firstChunk[i] !== 0) { allZeros = false; break }
  }
  if (allZeros) {
    console.warn('[audio] First audio chunk is all zeros — AudioContext may not have been active when recording started');
  }
}
```

- Détecte si le premier chunk capturé est composé exclusivement de zéros
- Signe révélateur d'un AudioContext pas encore actif au moment du start
- Warning en production (pas seulement dev) car c'est un signal critique de capture cassée

#### c) Log RMS dev-only

```typescript
// audio.ts:273-277
let sumSq = 0
for (let i = 0; i < mono.length; i++) sumSq += mono[i] * mono[i]
const rms = Math.sqrt(sumSq / (mono.length || 1))
if (isDev) console.log(`[audio] Recording RMS: ${rms.toFixed(4)}, peak: ${Math.max(...mono).toFixed(4)}, samples: ${mono.length}, chunks: ${chunks.length}`)
```

- Calcule le RMS réel du buffer capturé (avant resampling)
- Visible uniquement en dev (`import.meta.env.DEV`)
- Permet de comparer avec le seuil VAD côté HV

#### d) Variable `isDev`

```typescript
// audio.ts:212
const isDev = import.meta.env?.DEV ?? false;
```

- Utilise `import.meta.env.DEV` (Vite) pour détecter le mode dev
- Fallback `false` si non disponible (production)

### Tests

```
npx tsc --noEmit → ✅ 0 errors
npx vitest run → 153/153 pass
```

Les logs dev sont visibles dans les tests :
```
[audio] Recording RMS: 0.3000, peak: 0.3000, samples: 4096, chunks: 1
[audio] Recording RMS: 0.5000, peak: 0.5000, samples: 114688, chunks: 28
```

---

## 3. VALIDATION EMPIRIQUE — En attente

### Procédure

1. **Deploy** les deux repos (demoguard-app + hybrid-vector-api)
2. **Run réel mobile** sur le téléphone qui a produit `audio_too_silent`
3. **Observer dans l'E2E Trace admin** :
   - `voiceDiagnostics.audioMetrics.rms` — valeur RMS réelle du run
   - `voiceDiagnostics.audioMetrics.peak` — valeur peak réelle
   - `voiceDiagnostics.audioMetrics.silenceRatio` — ratio de silence
   - `voiceDiagnostics.audioMetrics.normalizedRms` — RMS après normalisation
4. **Côté mobile (dev mode)** : regarder les console logs :
   - `[audio] AudioContext suspended before recording` → confirme problème iOS Safari
   - `[audio] AudioContext state after resume(): running` → confirme fix appliqué
   - `[audio] First audio chunk is all zeros` → confirme capture cassée
   - `[audio] Recording RMS: X.XXXX` → amplitude réelle du buffer

### Arbre de décision

```
rms ≈ 0 (< 0.001)
  → Cause confirmée : AudioContext suspendu ou capture cassée
  → Le fix resume() doit corriger
  → Si persiste après fix : problème permission micro ou hardware

rms > 0 mais audio_too_silent côté HV
  → Le VAD a un souci sur ce pattern spécifique
  → Investiguer avec les vraies valeurs :
    - silenceRatio élevé ? (> 0.8 → VAD voit trop de silence)
    - normalizedRms ? (devrait être ~0.1 après normalisation -20dB)
    - qualityReason ? ("no_segments" → VAD n'a pas trouvé de segment ≥ 500ms)
  → Possible ajustement : baisser minSegmentDuration ou energyThreshold

rms > 0.01 et audio_too_silent
  → Anomalie : voix normale mais VAD ne détecte rien
  → Bug VAD à investiguer avec le WAV réel
```

---

## 4. FICHIERS MODIFIÉS

| Repo | Fichier | Changement |
|---|---|---|
| demoguard-app | `src/lib/audio.ts` | + AudioContext state guard, resume(), zero-chunk guard, RMS log dev-only |
| hybrid-vector-api | — | Aucun (déjà instrumenté) |

**Total** : 1 fichier modifié, 0 fichier créé.

# VOCAL-SILENCE-FIX-01 — Remplacer MediaRecorder par ScriptProcessorNode

**Task** : Fix `audio_too_silent` récurrent — remplacer MediaRecorder par ScriptProcessorNode
**Repo** : `demoguard-app`
**Référence** : `VOCAL_SILENCE_DIAG_01.md`
**Date** : 2026-07-11
**Statut** : Fix appliqué, tests verts, build OK

---

## 1. DIFF APPLIQUÉ

### Fichier : `src/lib/audio.ts` — fonction `recordAudio`

**Avant (MediaRecorder + codec Opus)** :
```typescript
export async function recordAudio(durationMs: number): Promise<AudioRecordingResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'

  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.start()
  await new Promise<void>(resolve => setTimeout(resolve, durationMs))
  recorder.stop()
  const blob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })
  stream.getTracks().forEach(t => t.stop())
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0))
  await audioCtx.close()
  const mono = toMonoFloat32(audioBuffer)
  const resampled = resampleLinear(mono, audioBuffer.sampleRate, TARGET_SR)
  return { samples: [resampled], recorderState: 'inactive', chunksCount: chunks.length }
}
```

**Après (ScriptProcessorNode — PCM direct, zéro codec)** :
```typescript
export async function recordAudio(durationMs: number): Promise<AudioRecordingResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  const source = ctx.createMediaStreamSource(stream)
  const processor = ctx.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []

  source.connect(processor)
  processor.connect(ctx.destination)
  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  }

  await new Promise<void>(resolve => setTimeout(resolve, durationMs))

  processor.disconnect()
  source.disconnect()
  stream.getTracks().forEach(t => t.stop())
  await ctx.close()

  const totalLen = chunks.reduce((s, c) => s + c.length, 0)
  const mono = new Float32Array(totalLen)
  let off = 0
  for (const c of chunks) { mono.set(c, off); off += c.length }

  const resampled = resampleLinear(mono, ctx.sampleRate, TARGET_SR)
  return { samples: [resampled], recorderState: 'inactive', chunksCount: chunks.length }
}
```

### Autres changements dans `src/lib/audio.ts`

- **Supprimé** : `toMonoFloat32()` (fonction inutilisée — `ScriptProcessorNode` capture mono directement via `getChannelData(0)`)
- **Inchangé** : `encodeWav()`, `computeVocalEmbedding()`, `resampleLinear()`, toutes les fonctions DSP

### Fichier : `tests/audio.test.ts` — 8 nouveaux tests

**`recordAudio (ScriptProcessorNode)` (5 tests)** :
1. `returns correct AudioRecordingResult shape` — vérifie le contrat de sortie
2. `produces PCM samples directly (no codec round-trip)` — vérifie que l'amplitude est préservée (0.7 → 0.7, pas de dégradation codec)
3. `does not use MediaRecorder` — vérifie que `MediaRecorder` n'est jamais appelé
4. `resamples from context sample rate to 16kHz target` — vérifie le resampling 48kHz → 16kHz
5. `cleans up resources after recording` — vérifie `stream.getTracks().stop()` et `ctx.close()`

**`encodeWav (PCM output)` (3 tests)** :
1. `produces valid WAV header with PCM format` — vérifie RIFF/WAVE/PCM=1/mono/16-bit
2. `preserves amplitude in PCM encoding` — vérifie que 0.8 → ~26214 en 16-bit (pas de dégradation)
3. `output size matches expected PCM size` — vérifie 44 + numSamples * 2

---

## 2. CONTRAT DE SORTIE PRÉSERVÉ

L'interface `AudioRecordingResult` est identique :
```typescript
export interface AudioRecordingResult {
  samples: Float32Array[];      // [resampled Float32Array at 16kHz]
  recorderState: 'inactive' | 'recording' | 'paused' | 'unknown';
  chunksCount: number;           // nombre de chunks audio
}
```

`audioCollector.ts`, `VoiceScreen.tsx`, `buildDemoGuardPayload` — **aucun changement nécessaire**. Le contrat de sortie (safe metadata + sensitive `voice_b64` + `mfcc_summary`) est préservé.

---

## 3. RÉSULTATS TESTS

```
npx tsc --noEmit → exit code 0 (no errors)

npm run build → exit code 0
  dist/assets/index-BIFJmfSD.js   208.99 kB │ gzip: 65.75 kB
  built in 1.10s

npx vitest run → 10 files, 151 tests, 0 failures
  tests/audio.test.ts (8)              ← NEW
  tests/buildDemoGuardPayload.test.ts (19)
  tests/cognitiveBattery.test.ts (30)
  tests/continuousSignals.test.ts (25)
  tests/qualityAssessors.test.ts (24)
  tests/behaviorIntegratedTouch.test.ts (18)
  tests/demoguardReducer.test.ts (14)
  tests/nbackUx.test.ts (9)
  tests/empirical-payload.test.ts (1)
  tests/idleScreen.test.tsx (3)
```

---

## 4. FICHIERS MODIFIÉS

| Fichier | Changement |
|---|---|
| `src/lib/audio.ts` | `recordAudio()` : MediaRecorder → ScriptProcessorNode ; `toMonoFloat32()` supprimé |
| `tests/audio.test.ts` | 8 nouveaux tests (5 recordAudio + 3 encodeWav) |

---

## 5. RUN DE VALIDATION MOBILE

**Statut** : En attente — nécessite un run réel sur mobile.

Le run doit confirmer :
- **Voix normale** (pas fort, pas collé au micro) : `vocal status != audio_too_silent`
- Idéalement `passed` ou `review` pour une autre raison que le silence
- Cognitive/behavior/completeness : pas de régression (identiques au dernier run validé)

**Procédure** :
1. Déployer sur staging
2. Lancer une session complète sur mobile en **voix normale** (conditions qui échouaient avant)
3. Vérifier l'E2E Trace admin : vocal status ≠ `audio_too_silent`
4. Confirmer completeness ~0.85-0.92 (pas de régression)
5. Noter le trace ID

---

## 6. POURQUOI ScriptProcessorNode ET PAS AudioWorklet

`ScriptProcessorNode` est deprecated côté spec web mais :
- **PayGuard l'utilise en production** depuis des mois sans problème
- **Tous les navigateurs le supportent** (iOS Safari, Chrome, Firefox, Samsung Internet)
- `AudioWorklet` nécessite un fichier séparé + `audioWorklet.addModule()` — complexité non justifiée pour un fix
- La cohérence avec PayGuard est voulue (même comportement, même capture PCM directe)

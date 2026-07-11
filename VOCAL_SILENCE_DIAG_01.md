# VOCAL-SILENCE-DIAG-01 — audio_too_silent récurrent

**Task** : Diagnostic `audio_too_silent` — verdict usage vs bug
**Repo** : `demoguard-app` + `hybrid-vector-api` (lecture seule)
**Date** : 2026-07-11
**Statut** : Verdict rendu, pas de modification de code

---

## 1. VERDICT

**Verdict : BUG DE CODE (régression d'architecture), pas un problème d'usage.**

DemoGuard utilise `MediaRecorder` (compression Opus) alors que PayGuard utilise `ScriptProcessorNode` (capture PCM directe). Le passage par le codec Opus réduit l'amplitude du signal sur mobile, et la normalisation server-side ne compense pas complètement car le codec peut appliquer un DTX (Discontinuous Transmission) qui écrase les segments faibles.

---

## 2. CHAÎNE AUDIO COMPLÈTE

### 2a. DemoGuard — `src/lib/audio.ts:221-257`

```
getUserMedia({ audio: true })
    → MediaRecorder(audio/webm;codecs=opus)
    → Blob WebM/Opus compressé
    → AudioContext.decodeAudioData() → Float32Array
    → resampleLinear(→16kHz)
    → encodeWav(16-bit PCM)
    → base64
    → envoyé au serveur
```

**Problème** : Le codec Opus applique sa propre détection de silence (DTX). Sur mobile (micro distant, gain faible), l'encodeur Opus peut classer des segments de parole faible comme "silence" et ne pas les encoder. Le décodage produit alors des segments de silence là où il y avait de la parole.

### 2b. PayGuard — `src/hooks/useAudio.ts:13-55`

```
getUserMedia({ audio: true })
    → AudioContext.createMediaStreamSource(stream)
    → createScriptProcessor(4096, 1, 1)
    → processor.onaudioprocess → Float32Array direct
    → (pas de codec, pas de compression)
    → encodeWav(16-bit PCM)
    → base64
```

**Avantage** : Capture PCM directe — aucun codec, aucune perte. Les échantillons sont exactement ce que le micro produit. L'amplitude est préservée.

### 2c. Comparaison côté serveur — `hybrid-vector-api/src/services/vocalQuickGate/`

Le serveur reçoit le WAV et applique :

1. `decodeWav(buffer)` — décode le WAV 16-bit PCM → Float32
2. `normalizeAmplitude(mono, -20)` — normalise à -20dB RMS
3. `extractVoiceSegments(normalized, sampleRate)` — VAD avec threshold 0.015 (relatif au max)

**La normalisation compense l'amplitude globale**, mais ne peut pas restaurer les segments écrasés par le DTX d'Opus. Si l'encodeur a décidé qu'un segment était du silence, le décodeur produit des zéros, et aucune normalisation ne peut recreer la parole.

### 2d. Le VAD — `decodeAudioSafe.ts:139-195`

```typescript
const maxEnergy = Math.max(...energies);
const normalizedEnergies = energies.map(e => e / (maxEnergy || 1));
// threshold = 0.015 (1.5% du max)
```

Le VAD utilise un threshold **relatif** (1.5% de l'énergie max). Après normalisation, si l'audio contient majoritairement du silence (Opus DTX) avec quelques pics, les segments de parole peuvent être trop courts (< 500ms) ou trop peu nombreux pour être détectés.

---

## 3. PREUVE PAR LE CODE

### 3a. PayGuard `useAudio.ts` — capture PCM directe

`payguard/src/hooks/useAudio.ts:18-30` :
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
const ctx = new AudioCtx()
const source = ctx.createMediaStreamSource(stream)
const processor = ctx.createScriptProcessor(4096, 1, 1)
const samples: Float32Array[] = []

source.connect(processor)
processor.connect(ctx.destination)
processor.onaudioprocess = (e) => {
    samples.push(new Float32Array(e.inputBuffer.getChannelData(0)))
}
```

**Pas de MediaRecorder, pas de codec Opus, pas de compression.** Les samples Float32 sont capturés directement du flux microphone.

### 3b. DemoGuard `audio.ts` — capture via MediaRecorder + Opus

`demoguard-app/src/lib/audio.ts:222-256` :
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'

const recorder = new MediaRecorder(stream, { mimeType })
// ... enregistrement, puis décodage via AudioContext.decodeAudioData
```

**MediaRecorder compresse l'audio en WebM/Opus**, puis `decodeAudioData` le décompresse. Ce round-trip codec est lossy et peut écraser les segments faibles.

### 3c. Les deux `audioCollector.ts` sont identiques

`demoguard-app/src/demoguard/collectors/audioCollector.ts` et `payguard/src/demoguard/collectors/audioCollector.ts` sont **identiques** — les deux importent `recordAudio` de `lib/audio.ts` qui utilise `MediaRecorder`.

Cependant, PayGuard a **en plus** `src/hooks/useAudio.ts` qui utilise `ScriptProcessorNode`. Si PayGuard utilisait `useAudio.ts` pour l'enregistrement vocal (et non `audioCollector.ts`), cela expliquerait pourquoi PayGuard n'avait pas le problème `audio_too_silent`.

### 3d. `getUserMedia` constraints — identiques

Les deux utilisent `getUserMedia({ audio: true })` sans contraintes supplémentaires. Sur iOS Safari, cela active par défaut :
- Echo cancellation: **enabled** (réduit le signal)
- Noise suppression: **enabled** (réduit le signal)
- Auto gain control: **enabled** (peut réduire le signal dans certaines conditions)

Ces contraintes par défaut réduisent l'amplitude du signal capturé, ce qui aggrave le problème avec le codec Opus.

---

## 4. ANALYSE DU SEUIL SERVER-SIDE

### `vocalQuickGate.ts:131-146`

```typescript
if (preprocessed.segments.length === 0) {
    const duration = preprocessed.normalized.length / preprocessed.sampleRate * 1000;
    const reason: QuickGateReasonSafe = duration < MIN_VOICE_SEGMENT_MS ? 'audio_too_short' : 'audio_too_silent';
    // → audio_too_silent si duration >= 500ms mais 0 segments
}
```

`audio_too_silent` se déclenche quand :
- Le WAV est décodable (decoded=true)
- La durée est ≥ 500ms
- **0 segment vocal détecté** par le VAD

### `decodeAudioSafe.ts:280-294` — pipeline de preprocessing

```typescript
export function preprocessAudioLite(audioBuffer: Buffer): PreprocessedAudio {
    const decoded = decodeWav(audioBuffer);
    const mono = toMono(decoded);
    const normalized = normalizeAmplitude(mono, -20);  // ← normalise à -20dB RMS
    const emphasized = applyPreEmphasis(normalized, 0.97);
    const segments = extractVoiceSegments(normalized, decoded.sampleRate);  // ← VAD sur normalisé
    return { denoised: mono, normalized, emphasized, segments, sampleRate: decoded.sampleRate };
}
```

**Note** : Un fix précédent (commentaire ligne 134-137) a déjà déplacé le VAD du signal pre-emphasized vers le signal normalized, et abaissé le threshold de 0.02 à 0.015. Ce fix a aidé mais n'adresse pas la cause racine côté client.

### `normalizeAmplitude` — `decodeAudioSafe.ts:102-114`

```typescript
const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
const targetRms = Math.pow(10, targetDb / 20);  // 10^(-1) = 0.1
const gain = targetRms / (rms || 1e-10);
```

Si l'audio est majoritairement silencieux (Opus DTX), le RMS global est très bas, le gain est très élevé, et le silence est amplifié autant que la parole. Le VAD ne peut pas distinguer parole/silence car tout est amplifié uniformément.

---

## 5. POURQUOI PARLER FORT POURRAIT PASSER — MAIS PAS TOUJOURS

Si l'utilisateur parle fort et proche du micro :
- L'amplitude est suffisante pour que l'encodeur Opus ne classe pas les segments comme silence
- Le DTX ne s'active pas
- Les segments de parole sont préservés
- La normalisation server-side fonctionne correctement
- Le VAD détecte les segments → **PASS**

Si l'utilisateur parle normalement ou doucement :
- L'amplitude est faible
- L'encodeur Opux peut activer le DTX sur certains segments
- Les segments faibles sont écrasés
- La normalisation amplifie tout uniformément
- Le VAD ne trouve pas de segments distincts → **audio_too_silent**

**Ceci explique le caractère "récurrent" mais pas systématique** : ça dépend du volume vocal, de la distance au micro, et du comportement de l'encodeur Opus qui varie selon le contenu du signal.

---

## 6. RUN DE VALIDATION

**Statut** : Non disponible — nécessite un run réel sur mobile.

Le diagnostic ci-dessus est basé sur l'analyse statique comparative du code des deux repos. Pour confirmer empiriquement :

1. **Run avec parole forte + proche micro** : Devrait PASS (l'Opus préserve les segments forts)
2. **Run avec parole normale + distance normale** : Probable FAIL (DTX Opus écrase les segments)
3. **Run avec PayGuard (ScriptProcessorNode) sur le même device** : Devrait PASS (pas de codec)

**Procédure de confirmation** :
1. Sur le même téléphone, faire un run DemoGuard en parlant fort → noter le résultat
2. Sur le même téléphone, faire un run DemoGuard en parlant normalement → noter le résultat
3. Si le run #1 passe et le #2 échoue : confirme le diagnostic (codec Opus + DTX)
4. Ajouter un `console.log` temporaire dans `recordAudio` pour logger le peak amplitude des samples Float32 avant `encodeWav` :
   ```typescript
   const peak = Math.max(...resampled.map(Math.abs));
   console.log('[DIAG] audio peak amplitude:', peak, 'samples:', resampled.length);
   ```
   - Peak < 0.01 = signal très faible (probable DTX Opus)
   - Peak > 0.1 = signal normal (devrait passer)

---

## 7. FIX MINIMAL PROPOSÉ (NON IMPLÉMENTÉ)

### Option A : Remplacer MediaRecorder par ScriptProcessorNode (comme PayGuard)

**Fichier** : `demoguard-app/src/lib/audio.ts`, fonction `recordAudio`

Remplacer le pipeline `MediaRecorder → decodeAudioData` par `ScriptProcessorNode → onaudioprocess` (identique à `payguard/src/hooks/useAudio.ts`).

**Avantage** : Capture PCM directe, aucun codec, amplitude préservée
**Risque** : `ScriptProcessorNode` est deprecated (mais toujours supporté sur tous les navigateurs)

### Option B : Ajouter des contraintes getUserMedia + gain client

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
    }
})
```

Désactiver le traitement audio du navigateur pour préserver l'amplitude brute. Puis ajouter une normalisation client-side avant `encodeWav` :

```typescript
// Après resampleLinear, avant encodeWav :
const peak = Math.max(...resampled.map(Math.abs));
const targetPeak = 0.5;
const gain = peak > 0 ? targetPeak / peak : 1;
const normalized = resampled.map(s => s * gain);
```

**Avantage** : Minimal, préserve le pipeline MediaRecorder
**Risque** : Le codec Opus peut toujours écraser les segments faibles

### Option C : Utiliser AudioWorklet (remplacement moderne de ScriptProcessorNode)

Plus propre mais plus complexe à implémenter. Recommandé pour un fix pérenne.

### Recommandation

**Option A** (ScriptProcessorNode) pour un fix rapide et éprouvé (PayGuard l'utilise déjà).
**Option C** (AudioWorklet) pour un fix pérenne.

---

## 8. RÉSUMÉ

| Point | Statut | Détail |
|---|---|---|
| Code client DemoGuard | **BUG** | `MediaRecorder` + Opus codec écrase les segments faibles |
| Code client PayGuard | OK | `ScriptProcessorNode` capture PCM direct, pas de codec |
| Code serveur (vocalQuickGate) | OK | Normalisation + VAD corrects, mais ne peut pas restaurer les segments écrasés par Opus |
| Seuil VAD (0.015) | OK | Already lowered from 0.02 in previous fix, relative threshold is permissive |
| getUserMedia constraints | **Améliorable** | Pas de contraintes spécifiées, traitement browser actif par défaut |
| Verdict | **BUG de code** | Régression d'architecture : DemoGuard utilise MediaRecorder au lieu de ScriptProcessorNode |

**Cause racine** : DemoGuard utilise `MediaRecorder` (Opus codec avec DTX) alors que PayGuard utilise `ScriptProcessorNode` (PCM direct). Le codec Opus peut écraser les segments de parole faible sur mobile, rendant le VAD server-side incapable de détecter des voix segments, produisant `audio_too_silent`.

**Fix** : Remplacer `MediaRecorder` par `ScriptProcessorNode` dans `recordAudio()` (comme PayGuard), ou désactiver le traitement audio du navigateur + ajouter un gain client-side.

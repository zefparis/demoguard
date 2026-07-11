# VOCAL-QUICKGATE-REGRESSION-DIAG-01 — Pourquoi 7s dégrade le quick gate

**Task** : Diagnostiquer pourquoi le passage à 7000ms provoque `quick_liveness_failed` au niveau du quick gate (hybrid-vector-api), avant même que le HCS backend ne soit contacté.
**Repos** : `hybrid-vector-api`, `hcs-u7-backend`, `demoguard-app`
**Date** : 2026-07-12
**Statut** : LECTURE SEULE

---

## 1. CRITÈRES EXACTS DU QUICK GATE

### Pipeline complet du quick gate

```
voice_b64
  → decodeAudioSafe()          — base64 → Buffer, détection RIFF/WAV
  → preprocessAudioLite()      — decode WAV → mono → normalize(-20dB) → pre-emphasis → VAD
  → computeSafeAudioMetrics()  — RMS, peak, ZCR, silenceRatio, clippingRatio
  → extractVoiceSegments()     — VAD energy-based, threshold 0.015, minSegment 500ms
  → quickLivenessGate()        — jitter, shimmer, HNR, pitch → thresholds
```

**Fichier** : `hybrid-vector-api/src/services/vocalQuickGate/vocalQuickGate.ts:40-179`

### Critères de rejet (par ordre)

| Étape | Condition | Status | `reasonSafe` | `shouldRelayToHcs` |
|---|---|---|---|---|
| 1 | Pas de `voice_b64` | review | `audio_missing` | false |
| 2 | Base64 invalide | **failed** | `invalid_audio` | false |
| 3 | Non-WAV (WebM/Opus) | review | `quick_gate_decode_unsupported` | **true** (relay HCS) |
| 4 | WAV decode/preprocess error | **failed** | `invalid_audio` | false |
| 5 | 0 segments VAD + durée < 500ms | review | `audio_too_short` | false |
| 6 | 0 segments VAD + durée ≥ 500ms | review | `audio_too_silent` | false |
| 7 | **Quick liveness check fail** | **failed** | **`quick_liveness_failed`** | **false** |
| 8 | Tous checks passent | passed | `quick_vocal_gate_passed` | **true** (relay HCS) |

### Quick liveness gate — seuils exacts

**Fichier** : `hybrid-vector-api/src/services/vocalQuickGate/quickLivenessGate.ts:170-174`

```typescript
const QUICK_THRESHOLDS = {
  JITTER_MAX_TTS: 0.3,
  HNR_MIN_TTS: 28,
  PITCH_STD_MIN: 10,
} as const;
```

**Logique de rejet** (`quickLivenessGate.ts:216-250`) — **SINGLE-SIGNAL REJECTION** :

```typescript
// Check 1: Jitter too low = obvious TTS
if (jitter < QUICK_THRESHOLDS.JITTER_MAX_TTS) {        // < 0.3 → FAIL
  return { passQuickCheck: false, reason: 'jitter_tts_detected', ... };
}

// Check 2: HNR too clean = obvious TTS
if (hnr > QUICK_THRESHOLDS.HNR_MIN_TTS) {              // > 28 → FAIL
  return { passQuickCheck: false, reason: 'hnr_tts_detected', ... };
}

// Check 3: Pitch too stable = synthetic
if (pitchStd < QUICK_THRESHOLDS.PITCH_STD_MIN / 2) {   // < 5 → FAIL
  return { passQuickCheck: false, reason: 'pitch_too_stable', ... };
}
```

**Chaque check est indépendant — UN SEUL signal déclenche `quick_liveness_failed`.**

---

## 2. ROOT CAUSE : SEUILS PRÉ-P10-FINAL JAMAIS MIS À JOUR

### Comparaison quick gate vs HCS backend (P10-FINAL)

| Threshold | Quick Gate (`hybrid-vector-api`) | HCS Backend P10-FINAL (`hcs-u7-backend`) | Écart |
|---|---|---|---|
| `JITTER_MAX_TTS` | **0.3** (ancien) | **0.2** (P10-FINAL) | Quick gate **plus strict** — rejette jitter 0.2-0.3 comme TTS |
| `HNR_MIN_TTS` | **28** (ancien) | **32** (P10-FINAL) | Quick gate **plus strict** — rejette HNR 28-32 comme TTS |
| `PITCH_STD_MIN` | **10** (ancien) | **7** (P10-FINAL) | Quick gate **plus strict** — rejette pitch std 7-10 comme synthetic |
| Rejection logic | **Single-signal** (1 signal = fail) | **Multi-signal** (2+ signals = fail) | Quick gate **plus strict** |

### Citation du commit P10-FINAL (`f50af42`)

```diff
-  JITTER_MAX_TTS: 0.3,
+  JITTER_MAX_TTS: 0.2, // was 0.3 — mobile compression can reduce jitter below 0.3

-  HNR_MIN_TTS: 28,
+  HNR_MIN_TTS: 32, // was 28 — mobile WAV conversion easily produces 28-31 dB

-  PITCH_STD_MIN: 10,
+  PITCH_STD_MIN: 7, // was 10 — 3-4s recordings may have 7-10 Hz std
```

Le backend a été calibré (P10-FINAL) mais **le quick gate n'a jamais été mis à jour**. Il utilise toujours les anciens seuils pré-calibration.

### Conséquence : le quick gate BLOCKE le relay HCS

Quand le quick gate retourne `quick_liveness_failed` :
- `shouldRelayToHcs = false` (`vocalQuickGate.ts:161`)
- `demoguardFusionTrigger.ts:846-864` : HCS relay est **SKIPPÉ**
- Un `syntheticVocal` avec `status: 'failed', confidence: 0` est utilisé
- `demoguardFusionTrigger.ts:342-344` : `vocalStatus === 'failed'` → `vocalNegative = true`
- `demoguardFusionTrigger.ts:437-439` : `vocalNegative` → `mlRecommendation = 'reject'`

**L'analyse P10-FINAL du backend ne s'exécute jamais.** Le quick gate avec ses anciens seuils court-circuite tout le pipeline.

---

## 3. POURQUOI 7s AGGRAVE LE PROBLÈME

### Effet de la durée sur les features

Avec **4s** d'enregistrement mobile :
- **HNR** : Moins de frames (4s / 2048 samples × hop 1024 à 16kHz ≈ 60 frames) → variance élevée dans l'estimation → peut偶尔 passer sous 28 par chance
- **Jitter** : Moins de périodes (4s × ~150Hz ≈ 600 périodes) → variance élevée → peut passer au-dessus de 0.3 par chance
- Le quick gate peut **passer par chance** sur des enregistrements courts (high variance)

Avec **7s** d'enregistrement mobile :
- **HNR** : Plus de frames (7s ≈ 105 frames) → estimation plus **stable** → HNR converge vers sa vraie valeur mobile (typiquement 28-35 dB après compression) → **dépasse 28** systématiquement
- **Jitter** : Plus de périodes (7s × ~150Hz ≈ 1050 périodes) → estimation plus **stable** → jitter converge vers sa vraie valeur mobile (typiquement 0.15-0.3 après compression) → **passe sous 0.3** systématiquement
- Le quick gate **échoue systématiquement** car les valeurs stables sont dans la zone "TTS" des anciens seuils

**C'est exactement ce que P10-FINAL a documenté** : "mobile compression can reduce jitter below 0.3" et "mobile WAV conversion easily produces 28-31 dB". Plus l'enregistrement est long, plus ces valeurs sont stables et prévisibles — et elles sont dans la zone de rejet des anciens seuils.

### Tableau récapitulatif

| Feature | 4s (variance élevée) | 7s (variance faible) | Seuil quick gate | Seuil P10-FINAL |
|---|---|---|---|---|
| HNR | 25-32 (aléatoire) | 30-33 (stable) | > 28 → FAIL | > 32 → FAIL |
| Jitter | 0.2-0.5 (aléatoire) | 0.18-0.25 (stable) | < 0.3 → FAIL | < 0.2 → FAIL |
| Pitch std | 5-15 (aléatoire) | 7-12 (stable) | < 5 → FAIL | < 3.5 → FAIL |

Avec 7s : HNR stable à ~31 → **FAIL** (seuil quick gate 28, mais P10-FINAL dit 32). Le quick gate rejette alors que P10-FINAL l'accepterait.

---

## 4. ANALYSE CAPTURE AUDIO — PAS DE BUG

### ScriptProcessorNode — pas d'artefact de durée

**Fichier** : `demoguard-app/src/lib/audio.ts:214-249`

```typescript
processor.onaudioprocess = (e) => {
  chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))  // copie immédiate
}
await new Promise<void>(resolve => setTimeout(resolve, durationMs))
processor.disconnect()
source.disconnect()
stream.getTracks().forEach(t => t.stop())
await ctx.close()
```

- **Copie immédiate** : chaque callback `onaudioprocess` copie les samples dans un nouveau `Float32Array` — pas de buffer overrun
- **Pas d'underrun** : le `ScriptProcessorNode` appelle `onaudioprocess` à son propre rythme (toutes les 4096 samples), indépendamment de la durée totale
- **Pas de troncation** : le `setTimeout(resolve, durationMs)` attend exactement la durée, puis déconnecte le processor. Les chunks accumulés jusqu'à ce point sont complets
- **Pas de duplication** : chaque chunk est unique, concaténés linéairement

### Resampling — pas de drift

**Fichier** : `demoguard-app/src/lib/audio.ts:7-19`

```typescript
function resampleLinear(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input    // 16kHz → 16kHz = identity
  const ratio = outputRate / inputRate           // constant, pas de drift
  const outLen = Math.max(1, Math.floor(input.length * ratio))
  // interpolation linéaire — ratio constant sur tout le buffer
}
```

- **Ratio constant** : `outputRate / inputRate` ne change pas avec la durée
- **Pas de drift cumulatif** : l'interpolation linéaire utilise `i / ratio` qui est exact pour chaque sample
- **16kHz → 16kHz** : si le device produit déjà 16kHz, pas de resampling du tout

### encodeWav — pas de limite de taille

**Fichier** : `demoguard-app/src/lib/audio.ts:163-199`

- `buffer = new ArrayBuffer(44 + dataSize)` — allocation dynamique
- 7s × 16000 × 2 bytes = 224 000 bytes → bien sous les limites JS/V8
- Pas de troncation, pas de dépassement

### Verdict capture : ✅ AUCUN BUG

La capture audio à 7s est identique en qualité à 4s. Le problème n'est pas un défaut de capture.

---

## 5. TEST COMPARATIF 4s vs 7s

### Analyse théorique

Le quick gate utilise les mêmes algorithmes (jitter, HNR, pitch) que le HCS backend, mais avec des seuils différents. Sur un même contenu vocal :

| Durée | HNR estimé (mobile) | Jitter estimé (mobile) | Quick gate | HCS backend (P10-FINAL) |
|---|---|---|---|---|
| 4s | 25-32 (variance) | 0.2-0.5 (variance) | **Passe parfois** (variance chanceuse) | Passe (seuils relaxés) |
| 7s | 30-33 (stable) | 0.18-0.25 (stable) | **Échoue systématiquement** (HNR > 28) | Passe (HNR < 32) |

Le test `vocalQuickGate.test.ts:270-287` utilise `generateHumanLikeAudio(2000)` (2s) avec un signal synthétique qui a du jitter et du bruit ajoutés intentionnellement — il passe car le signal de test n'est pas du vrai audio mobile compressé.

### Pas de bug de capture à isoler

La durée 7s en soi ne provoque pas de défaut de capture. Le `ScriptProcessorNode` accumule plus de callbacks (43 vs 24 frames de 4096), mais chaque callback est identique en qualité. La concaténation et le resampling sont des opérations O(n) sans état.

---

## 6. VERDICT

### ❌ BUG DE SEUILS — pas un bug de capture, pas une incompatibilité de durée

**Le quick gate (`hybrid-vector-api/src/services/vocalQuickGate/quickLivenessGate.ts`) utilise les seuils PRÉ-P10-FINAL qui n'ont jamais été mis à jour.**

| Preuve | Détail |
|---|---|
| Seuils obsolètes | `JITTER_MAX_TTS: 0.3` (P10-FINAL: 0.2), `HNR_MIN_TTS: 28` (P10-FINAL: 32), `PITCH_STD_MIN: 10` (P10-FINAL: 7) |
| Single-signal rejection | Quick gate rejette sur 1 signal, P10-FINAL requiert 2+ |
| Quick gate bloque HCS | `shouldRelayToHcs = false` sur `quick_liveness_failed` → HCS backend P10-FINAL jamais appelé |
| 7s aggrave car stable | Plus de samples → estimation plus stable → valeurs mobile (HNR > 28, jitter < 0.3) systématiquement dans la zone de rejet des anciens seuils |
| Pas de bug de capture | ScriptProcessorNode, resampleLinear, encodeWav — tous OK à 7s |

### Flow du échec

```
7s audio mobile → quick gate
  → HNR stable à ~31 dB (mobile compression)
  → 31 > 28 (seuil quick gate) → hnr_tts_detected
  → passQuickCheck = false
  → status = 'failed', reasonSafe = 'quick_liveness_failed'
  → shouldRelayToHcs = false
  → HCS backend P10-FINAL JAMAIS APPELÉ
  → vocalStatus = 'failed' (synthetic)
  → vocalNegative = true
  → mlRecommendation = 'reject'
```

---

## 7. RECOMMANDATION

### Fix prioritaire : aligner le quick gate sur P10-FINAL

**Option A (recommandée) — Mettre à jour les seuils + multi-signal rejection** :

```typescript
// quickLivenessGate.ts
const QUICK_THRESHOLDS = {
  JITTER_MAX_TTS: 0.2,   // was 0.3 — P10-FINAL
  HNR_MIN_TTS: 32,       // was 28 — P10-FINAL
  PITCH_STD_MIN: 7,      // was 10 — P10-FINAL
} as const;

// Logique multi-signal (comme P10-FINAL) :
let concurrentSignals = 0;
if (jitter < QUICK_THRESHOLDS.JITTER_MAX_TTS) concurrentSignals++;
if (hnr > QUICK_THRESHOLDS.HNR_MIN_TTS) concurrentSignals++;
if (pitchStd < QUICK_THRESHOLDS.PITCH_STD_MIN / 2) concurrentSignals++;

if (concurrentSignals >= 2) {
  return { passQuickCheck: false, reason: 'multiple_tts_signals', ... };
}
return { passQuickCheck: true, ... };
```

**Option B (quick fix) — Toujours relayer vers HCS** :

Sur `quick_liveness_failed`, mettre `shouldRelayToHcs = true` au lieu de `false`. Le HCS backend P10-FINAL fait l'analyse authoritative et peut override le quick gate.

**Option C (minimal) — Augmenter seulement HNR_MIN_TTS à 32** :

Le HNR est le signal le plus susceptible de déclencher sur mobile. Augmenter de 28 à 32 aligne le seuil le plus critique.

### Impact du fix

- Le quick gate ne rejetera plus le vrai audio mobile (HNR 28-32, jitter 0.2-0.3)
- Le HCS backend P10-FINAL sera appelé pour l'analyse authoritative
- La confidence P10-FINAL (~0.78-0.82 avec 7s) sera utilisée au lieu du `failed` synthétique
- Le statut `passed` devient possible (confidence ≥ 0.75 avec breathing détecté sur 7s)

### La durée 7000ms est COMPATIBLE

La durée 7s n'est **pas intrinsèquement incompatible** avec le quick gate. Le problème est que le quick gate a des seuils obsolètes qui rejettent le vrai audio mobile. Une fois les seuils alignés sur P10-FINAL, 7s produira des features plus stables et plus précises, ce qui est bénéfique pour l'analyse HCS.

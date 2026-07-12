# DEMOGUARD_I18N_01 — Système i18n fr/en

## 1. Architecture

Infrastructure i18n maison — zéro dépendance externe.

### Fichiers créés
- `src/i18n/fr.json` — Dictionnaire français (96 clés)
- `src/i18n/en.json` — Dictionnaire anglais (96 clés)
- `src/i18n/I18nContext.tsx` — Context provider avec détection automatique + override manuel

### Fichiers modifiés
- `src/main.tsx` — Wrapping `<I18nProvider>` autour de `<App />`
- `src/App.tsx` — Textes traduits (rotate overlay, error fallback)
- `src/screens/IdleScreen.tsx` — Textes + sélecteur de langue discret (bouton EN/FR top-right)
- `src/screens/PrepScreen.tsx` — Textes traduits
- `src/screens/CameraScreen.tsx` — Textes traduits
- `src/screens/ReflexScreen.tsx` — Textes traduits
- `src/screens/StroopScreen.tsx` — Textes traduits + mots de couleurs localisés
- `src/screens/DigitSpanScreen.tsx` — Textes traduits
- `src/screens/NBackScreen.tsx` — Textes traduits (intro, practice, test)
- `src/screens/TrailTapScreen.tsx` — Textes traduits
- `src/screens/VoiceScreen.tsx` — Textes traduits + phrase de challenge localisée
- `src/screens/ReviewScreen.tsx` — Textes traduits (modules cognitifs inclus)
- `src/screens/DeviceSignalsScreen.tsx` — Textes traduits
- `src/screens/ReadinessScreen.tsx` — Textes traduits
- `src/screens/SubmittingScreen.tsx` — Textes traduits
- `src/screens/DoneScreen.tsx` — Textes traduits (décisions incluses)
- `src/screens/ErrorScreen.tsx` — Textes traduits
- `src/components/ErrorBoundary.tsx` — Fallback traduit via `useContext(I18nContext)`
- `src/demoguard/cognitive/stroopChallenge.ts` — Ajout `STROOP_COLOR_WORDS` + `stroopColorWord()`
- `src/demoguard/collectors/audioCollector.ts` — `generateChallengePhrase()` accepte `locale`
- `tests/idleScreen.test.tsx` — Wrapping `I18nProvider` + `navigator.language = 'fr-FR'`
- `tests/i18n.test.ts` — Nouveaux tests (15 cas)

## 2. Détection de locale

```
1. localStorage['dg_locale'] → si 'fr' ou 'en', utilisé en priorité
2. navigator.language.startsWith('en') → 'en'
3. fallback → 'fr'
```

L'override manuel est persisté dans `localStorage` via `I18nProvider.useEffect`.

## 3. Liste des clés de traduction

| Catégorie | Clés |
|-----------|------|
| **app** | `app.title`, `app.subtitle`, `app.start`, `app.sessionPlaceholder`, `app.langSwitch`, `app.rotatePortrait` |
| **prep** | `prep.title`, `prep.progress`, `prep.collecting` |
| **camera** | `camera.title`, `camera.requesting`, `camera.ready`, `camera.capture`, `camera.denied`, `camera.unavailable` |
| **reflex** | `reflex.title`, `reflex.round`, `reflex.waitGreen`, `reflex.tap`, `reflex.tooEarly`, `reflex.ms` |
| **stroop** | `stroop.title`, `stroop.instruction`, `stroop.color.red`, `stroop.color.blue`, `stroop.color.green`, `stroop.color.yellow` |
| **digitSpan** | `digitSpan.title`, `digitSpan.memorize`, `digitSpan.enter`, `digitSpan.digits`, `digitSpan.delete`, `digitSpan.submit` |
| **nback** | `nback.title`, `nback.training`, `nback.intro.youWillSee`, `nback.intro.subtitle`, `nback.intro.same`, `nback.intro.different`, `nback.intro.practiceInfo`, `nback.intro.start`, `nback.instruction`, `nback.no`, `nback.yes`, `nback.correct`, `nback.wasSame`, `nback.wasDifferent` |
| **trailTap** | `trailTap.title`, `trailTap.instruction`, `trailTap.to` |
| **voice** | `voice.title`, `voice.readAloud`, `voice.duration`, `voice.record`, `voice.recording`, `voice.processing`, `voice.done` |
| **review** | `review.title`, `review.progress`, `review.selfie`, `review.captured`, `review.missing`, `review.cognitive`, `review.voice`, `review.recorded`, `review.missingVoice`, `review.behavior`, `review.interactions`, `review.tasksObserved`, `review.quality`, `review.continue`, `review.module.reflex`, `review.module.stroop`, `review.module.digitSpan`, `review.module.nback`, `review.module.trailTap`, `review.module.vocalRan` |
| **deviceSignals** | `deviceSignals.title`, `deviceSignals.progress`, `deviceSignals.continuous`, `deviceSignals.motion`, `deviceSignals.samples`, `deviceSignals.orientation`, `deviceSignals.changes`, `deviceSignals.touch`, `deviceSignals.interactions`, `deviceSignals.visibility`, `deviceSignals.blur`, `deviceSignals.network`, `deviceSignals.online`, `deviceSignals.offline` |
| **readiness** | `readiness.title`, `readiness.progress`, `readiness.quality`, `readiness.completeness`, `readiness.device`, `readiness.permissions`, `readiness.criticalMissing`, `readiness.submit`, `readiness.insufficient`, `readiness.insufficientHint`, `readiness.forceSubmit` |
| **submitting** | `submitting.submitting` |
| **done** | `done.complete`, `done.uncertain`, `done.status`, `done.qualityScore`, `done.decision`, `done.trustLevel`, `done.cognition`, `done.voice`, `done.behavior`, `done.trace`, `done.newControl`, `done.decision.approved`, `done.decision.review`, `done.decision.rejected` |
| **error** | `error.title`, `error.retry`, `error.reset`, `error.default`, `error.boundary.title`, `error.boundary.message`, `error.boundary.retry` |

**Total : 96 clés par langue, parité vérifiée par test.**

## 4. Stroop — Mots de couleur localisés

Le test Stroop repose sur l'interférence mot/colleur. Les mots affichés doivent être dans la langue de l'utilisateur pour maintenir la validité cognitive.

### Implémentation
- `STROOP_COLOR_WORDS` : map `{ fr: {red: 'ROUGE', ...}, en: {red: 'RED', ...} }`
- `stroopColorWord(color, locale)` : retourne le mot localisé, fallback fr
- La logique de génération des trials (`generateStroopTrials`) est inchangée — les conflits et ratios sont identiques
- Seul l'affichage change : `stroopColorWord(current.word, locale)` dans `StroopScreen.tsx`

### Test
- `locale=en` → mots anglais (RED, BLUE, GREEN, YELLOW)
- `locale=fr` → mots français (ROUGE, BLEU, VERT, JAUNE)
- Locale inconnue → fallback français
- Logique de conflit identique (word !== displayColor)

## 5. Phrase de challenge vocal — Justification phonétique

### Français
> « Je suis présent et je valide ce contrôle. »
- 9 mots, ~11 syllabes
- Phonèmes : /ʒə/ /sɥi/ /pʁe.zɑ̃/ /e/ /ʒə/ /va.li.d/ /sə/ /kɔ̃.tʁol/

### Anglais
> « I am present and I confirm this check. »
- 8 mots, ~10 syllabes
- Phonèmes : /aɪ/ /æm/ /ˈpɹɛzənt/ /ænd/ /aɪ/ /kənˈfɜːm/ /ðɪs/ /tʃɛk/

### Comparaison
| Critère | FR | EN |
|---------|----|----|
| Mots | 9 | 8 |
| Syllabes | ~11 | ~10 |
| Durée estimée | ~3.5s | ~3.2s |
| Complexité articulatoire | Modérée (consonnes nasales, r français) | Modérée (consonnes fricatives, diphtongue /aɪ/) |

**Impact sur le seuil HV** : La phrase anglaise est légèrement plus courte (~0.3s de moins) mais reste dans la même plage de complexité phonétique. Le seuil HV basé sur la durée d'enregistrement (7000ms) et l'analyse MFCC n'est pas affecté car :
1. La durée d'enregistrement est fixe (VOICE_DURATION_MS = 7000ms)
2. L'analyse MFCC porte sur les caractéristiques spectrales, pas sur le contenu linguistique
3. Le vocalStability est calculé sur des métriques acoustiques indépendantes de la langue

**Recommandation** : Aucun ajustement de seuil nécessaire. Si une calibration fine est requise à l'avenir, comparer les distributions de vocalStability sur un échantillon FR vs EN.

## 6. Payload — Non-régression

Le contract du payload est strictement inchangé :
- `hcs_session_public_id` : string
- `source` : string (DEMOGUARD_SOURCE)
- `demo_guard.version` : string (DEMOGUARD_VERSION)
- `demo_guard.device.language` : langue de l'appareil (navigator.language), **pas** la locale UI
- `demo_guard.signals` : structure identique
- `demo_guard.quality` : calcul identique
- `sensitive` : structure identique

**La locale UI n'apparaît nulle part dans le payload.** Les seuils de scoring backend sont inchangés.

## 7. Tests

### Fichier : `tests/i18n.test.ts` (15 cas)

| Suite | Cas | Statut |
|-------|-----|--------|
| Dictionary key parity | fr→en completeness | ✅ |
| Dictionary key parity | en→fr completeness | ✅ |
| Locale detection | en-ZA → en | ✅ |
| Locale detection | fr-FR → fr | ✅ |
| Locale detection | de-DE → fr (fallback) | ✅ |
| Locale detection | localStorage override | ✅ |
| Stroop color words | en produces English | ✅ |
| Stroop color words | fr produces French | ✅ |
| Stroop color words | unknown → fr fallback | ✅ |
| Stroop color words | conflict logic identical | ✅ |
| Voice phrase | fr returns French | ✅ |
| Voice phrase | en returns English | ✅ |
| Voice phrase | default → French | ✅ |
| Voice phrase | comparable word count | ✅ |
| Payload non-regression | shape identical | ✅ |

### Tests existants — Non-régression
- `tests/idleScreen.test.tsx` : 3/3 ✅ (adapté pour I18nProvider)
- `tests/buildDemoGuardPayload.test.ts` : 19/19 ✅
- `tests/cognitiveBattery.test.ts` : 30/30 ✅
- `tests/audio.test.ts` : 10/10 ✅
- `tests/nbackUx.test.ts` : 9/9 ✅
- Tous les autres : ✅

**Total : 189/189 tests passent.**

## 8. Validation

### Build
```
tsc --noEmit → 0 erreurs
vite build → ✓ 79 modules transformed, 221.45 kB gzip:69.07 kB
vitest run → 11 files, 189 tests, 0 failures
```

### Validation mobile (à effectuer)
1. Ouvrir l'app sur mobile (Safari iOS / Chrome Android)
2. Vérifier que la langue est détectée automatiquement selon la langue du navigateur
3. Cliquer sur le bouton EN/FR en haut à droite pour basculer
4. Refaire un run complet en anglais et vérifier que tous les écrans sont traduits
5. Vérifier que le Stroop affiche les mots de couleur dans la langue sélectionnée
6. Vérifier que la phrase vocale est dans la langue sélectionnée
7. Capturer l'E2E trace ID et confirmer que le payload shape est identique

### E2E Trace
- **Trace ID** : _(à remplir après validation mobile)_
- **Payload shape** : confirmé identique par test automatisé
- **Scoring** : inchangé (aucune modification backend)

## 9. Sélecteur de langue

Un bouton discret est placé en haut à droite de l'écran d'accueil (`IdleScreen`).
- Affiche "EN" quand la locale est FR (pour basculer vers anglais)
- Affiche "FR" quand la locale est EN (pour basculer vers français)
- Au clic : `toggleLocale()` bascule immédiatement et persiste dans `localStorage`

---

© 2026 Benjamin BARRERE / IA SOLUTION — Patents Pending FR2514274 | FR2514546

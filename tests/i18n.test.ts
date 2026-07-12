/**
 * DemoGuard — i18n tests
 *
 * Tests:
 * 1. Every key in fr.json has a counterpart in en.json (and vice versa)
 * 2. detectLocale: navigator.language 'en-ZA' → 'en', 'fr-FR' → 'fr', other → 'fr'
 * 3. Stroop: locale=en generates English words, locale=fr generates French words,
 *    conflict logic identical
 * 4. Voice challenge phrase: locale-aware, comparable syllable count
 * 5. Payload non-regression: buildDemoGuardPayload produces same shape regardless of UI locale
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { detectLocale } from '../src/i18n/I18nContext';
import {
  STROOP_COLOR_WORDS,
  stroopColorWord,
  generateStroopTrials,
  STROOP_TRIALS,
  STROOP_MIN_CONFLICT,
  type StroopColor,
} from '../src/demoguard/cognitive/stroopChallenge';
import { generateChallengePhrase } from '../src/demoguard/collectors/audioCollector';
import { buildDemoGuardPayload } from '../src/payload/buildDemoGuardPayload';
import { initialState } from '../src/state/demoguardReducer';
import type { DemoGuardState } from '../src/state/demoguardReducer';

// ─── 1. Key parity ───────────────────────────────────────────────

describe('i18n — dictionary key parity', () => {
  it('every key in fr.json exists in en.json', () => {
    const frKeys = Object.keys(fr);
    const enKeys = new Set(Object.keys(en));
    const missing = frKeys.filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('every key in en.json exists in fr.json', () => {
    const enKeys = Object.keys(en);
    const frKeys = new Set(Object.keys(fr));
    const missing = enKeys.filter((k) => !frKeys.has(k));
    expect(missing).toEqual([]);
  });
});

// ─── 2. Locale detection ─────────────────────────────────────────

describe('i18n — locale detection', () => {
  const originalLanguage = navigator.language;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  function setNavigatorLanguage(lang: string) {
    Object.defineProperty(navigator, 'language', {
      value: lang,
      configurable: true,
    });
  }

  it('en-ZA → english', () => {
    setNavigatorLanguage('en-ZA');
    vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
    expect(detectLocale()).toBe('en');
  });

  it('fr-FR → french', () => {
    setNavigatorLanguage('fr-FR');
    vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
    expect(detectLocale()).toBe('fr');
  });

  it('other (de-DE) → fallback french', () => {
    setNavigatorLanguage('de-DE');
    vi.spyOn(localStorage, 'getItem').mockReturnValue(null);
    expect(detectLocale()).toBe('fr');
  });

  it('manual override in localStorage takes priority over navigator.language', () => {
    setNavigatorLanguage('fr-FR');
    const spy = vi.spyOn(Storage.prototype, 'getItem');
    spy.mockImplementation((key: string) =>
      key === 'dg_locale' ? 'en' : null,
    );
    expect(detectLocale()).toBe('en');
    spy.mockRestore();
  });
});

// ─── 3. Stroop locale-specific words ─────────────────────────────

describe('i18n — Stroop color words', () => {
  const colors: StroopColor[] = ['red', 'blue', 'green', 'yellow'];

  it('locale=en produces English words', () => {
    for (const c of colors) {
      expect(stroopColorWord(c, 'en')).toBe(STROOP_COLOR_WORDS.en[c]);
    }
    expect(stroopColorWord('red', 'en')).toBe('RED');
    expect(stroopColorWord('blue', 'en')).toBe('BLUE');
    expect(stroopColorWord('green', 'en')).toBe('GREEN');
    expect(stroopColorWord('yellow', 'en')).toBe('YELLOW');
  });

  it('locale=fr produces French words', () => {
    for (const c of colors) {
      expect(stroopColorWord(c, 'fr')).toBe(STROOP_COLOR_WORDS.fr[c]);
    }
    expect(stroopColorWord('red', 'fr')).toBe('ROUGE');
    expect(stroopColorWord('blue', 'fr')).toBe('BLEU');
    expect(stroopColorWord('green', 'fr')).toBe('VERT');
    expect(stroopColorWord('yellow', 'fr')).toBe('JAUNE');
  });

  it('unknown locale falls back to French', () => {
    expect(stroopColorWord('red', 'de')).toBe('ROUGE');
  });

  it('conflict logic is identical regardless of locale (words are display-only)', () => {
    const trials = generateStroopTrials(STROOP_TRIALS);
    const conflictTrials = trials.filter((t) => t.isConflict);
    expect(trials).toHaveLength(STROOP_TRIALS);
    expect(conflictTrials.length).toBeGreaterThanOrEqual(STROOP_MIN_CONFLICT);

    for (const t of trials) {
      expect(typeof t.word).toBe('string');
      expect(['red', 'blue', 'green', 'yellow']).toContain(t.word);
      expect(['red', 'blue', 'green', 'yellow']).toContain(t.displayColor);
      expect(t.isConflict).toBe(t.word !== t.displayColor);
    }
  });
});

// ─── 4. Voice challenge phrase ───────────────────────────────────

describe('i18n — voice challenge phrase', () => {
  it('locale=fr returns French phrase', () => {
    const phrase = generateChallengePhrase('test-id', 'fr');
    expect(phrase).toBe('Je suis présent et je valide ce contrôle.');
  });

  it('locale=en returns English phrase', () => {
    const phrase = generateChallengePhrase('test-id', 'en');
    expect(phrase).toBe('I am present and I confirm this check.');
  });

  it('default (no locale) returns French phrase', () => {
    const phrase = generateChallengePhrase('test-id');
    expect(phrase).toBe('Je suis présent et je valide ce contrôle.');
  });

  it('English phrase has comparable word count to French', () => {
    const frPhrase = generateChallengePhrase('test', 'fr');
    const enPhrase = generateChallengePhrase('test', 'en');
    const frWords = frPhrase.split(' ').length;
    const enWords = enPhrase.split(' ').length;
    expect(Math.abs(frWords - enWords)).toBeLessThanOrEqual(2);
  });
});

// ─── 5. Payload non-regression ───────────────────────────────────

describe('i18n — payload non-regression', () => {
  it('buildDemoGuardPayload produces same shape regardless of UI locale', () => {
    const mockState: DemoGuardState = {
      ...initialState,
      sessionPublicId: 'sess_test',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      device: {
        platform: 'iPhone',
        osVersion: '17.0',
        model: 'iPhone 15',
        manufacturer: 'Apple',
        screenWidth: 390,
        screenHeight: 844,
        pixelRatio: 3,
        language: 'en-US',
        timezone: 'America/New_York',
        online: true,
      },
      permissions: {
        camera: 'granted',
        microphone: 'granted',
        motion: 'granted',
        orientation: 'granted',
        notifications: 'unknown',
        location: 'granted',
      },
    };

    const sensitive = {
      selfie_b64: 'data:image/png;base64,abc',
      voice_b64: 'data:audio/wav;base64,def',
      mfcc_summary: [1, 2, 3],
    };

    const payload = buildDemoGuardPayload(mockState, null, null, sensitive);

    expect(payload).toHaveProperty('hcs_session_public_id');
    expect(payload).toHaveProperty('source');
    expect(payload).toHaveProperty('demo_guard');
    expect(payload.demo_guard).toHaveProperty('version');
    expect(payload.demo_guard).toHaveProperty('device');
    expect(payload.demo_guard).toHaveProperty('signals');
    expect(payload).toHaveProperty('sensitive');
  });
});

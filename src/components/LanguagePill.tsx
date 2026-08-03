/**
 * DemoGuard — LanguagePill (shared component)
 *
 * Two-button language selector: FR | EN
 * Active language: cyan background, dark text
 * Inactive: transparent background, muted text
 * Minimum 44px touch target per button.
 *
 * Replaces the old single-button toggleLocale switcher.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useI18n, type Locale } from '../i18n/I18nContext';

export function LanguagePill() {
  const { locale, setLocale } = useI18n();

  const btn = (l: Locale, label: string) => (
    <button
      className={`lang-pill-btn${locale === l ? ' lang-pill-btn-active' : ''}`}
      onClick={() => setLocale(l)}
      aria-pressed={locale === l}
      aria-label={l === 'fr' ? 'Français' : 'English'}
    >
      {label}
    </button>
  );

  return (
    <div className="lang-pill" role="group" aria-label="Language selector">
      {btn('fr', 'FR')}
      {btn('en', 'EN')}
    </div>
  );
}

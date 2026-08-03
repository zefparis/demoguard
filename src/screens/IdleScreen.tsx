/**
 * DemoGuard — IdleScreen (start screen — campaign UX)
 *
 * Public-facing entry screen aligned with the landing page:
 * fingerprint SVG motif, "Ton empreinte d'humanité" title, 3 content chips,
 * cyan CTA, "Aucune inscription" mention.
 *
 * The sessionPublicId input is hidden in public mode — it only appears
 * when ?debug=1 is in the URL. The ID resolution logic is unchanged:
 * if a valid hcs_sess_* ID arrives via ?sessionPublicId=..., it is used
 * silently; otherwise a fallback dg_* ID is generated on start.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onStart: (sessionPublicId: string, testScope?: string | null) => void;
}

/** Fingerprint motif: 7 concentric arcs, cyan→violet gradient,
 *  decreasing opacity outward. Inline SVG for visual continuity
 *  with the landing page. */
function FingerprintMotif() {
  const arcs = [12, 22, 32, 42, 52, 62, 72];
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      className="idle-fingerprint"
    >
      <defs>
        <linearGradient id="fp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4CF2E0" />
          <stop offset="100%" stopColor="#8A7CFF" />
        </linearGradient>
      </defs>
      {arcs.map((r, i) => {
        const opacity = 1 - i * 0.12;
        return (
          <circle
            key={r}
            cx="60"
            cy="60"
            r={r}
            stroke="url(#fp-grad)"
            strokeWidth="2"
            strokeOpacity={opacity}
            fill="none"
          />
        );
      })}
    </svg>
  );
}

export function IdleScreen({ onStart }: Props) {
  const { t, toggleLocale } = useI18n();
  const [sessionId, setSessionId] = useState('');
  const [testScope, setTestScope] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qs = params.get('sessionPublicId');
    if (qs && /^hcs_sess_[A-Za-z0-9_-]+$/.test(qs)) {
      setSessionId(qs);
    }
    // Use getAll() for robustness against duplicate query params — take first value
    const scopes = params.getAll('testScope');
    console.log('[IdleScreen] testScope from URL:', scopes.length > 0 ? scopes[0] : '(not present)', 'all values:', scopes);
    if (scopes.length > 0 && (scopes[0] === 'voice-only' || scopes[0] === 'cognitive-only')) {
      setTestScope(scopes[0]);
    }
    // Debug mode: show session ID input for admin/manual testing
    setDebugMode(params.get('debug') === '1');
  }, []);

  const handleStart = async () => {
    const id = sessionId.trim() || `dg_${Date.now().toString(36)}`;
    onStart(id, testScope);
  };

  return (
    <div className="idle-screen">
      <button onClick={toggleLocale} className="idle-lang-switch">
        {t('app.langSwitch')}
      </button>

      <FingerprintMotif />

      <h1 className="idle-title">{t('app.title')}</h1>
      <p className="idle-subtitle">{t('app.subtitle')}</p>

      <div className="idle-chips">
        <div className="idle-chip">
          <span className="idle-chip-icon" style={{ color: '#4CF2E0' }}>⚡</span>
          {t('app.chip.reflexes')}
        </div>
        <div className="idle-chip">
          <span className="idle-chip-icon" style={{ color: '#8A7CFF' }}>🧠</span>
          {t('app.chip.memory')}
        </div>
        <div className="idle-chip">
          <span className="idle-chip-icon" style={{ color: '#FF6B8B' }}>👆</span>
          {t('app.chip.gesture')}
        </div>
      </div>

      {debugMode && (
        <input
          type="text"
          className="idle-debug-input"
          placeholder={t('app.sessionPlaceholder')}
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
      )}

      <button className="idle-start-btn" onClick={handleStart}>
        {t('app.start')}
      </button>

      <p className="idle-no-signup">{t('app.noSignup')}</p>
    </div>
  );
}

/**
 * DemoGuard — IdleScreen (start screen — campaign UX)
 *
 * Public-facing entry screen aligned with the landing page:
 * fingerprint SVG motif, "Ton empreinte d'humanité" title, 3 content chips,
 * cyan CTA, "Aucune inscription" mention.
 *
 * DOMAIN-AWARE BEHAVIOR:
 *   - On the public campaign domain (cognitive-signature.com):
 *     * testScope is FORCED to 'cognitive-only' — any ?testScope= param is ignored
 *     * If no ?sessionPublicId= is present, a traced session is generated via
 *       POST /api/cognitive/brain-age/session (tenant: public_brainage_campaign).
 *       On failure (rate limit, network, backend down), falls back gracefully
 *       to the local dg_* ID — the app never blocks the user.
 *   - On all other hostnames (demoguard.vercel.app, localhost, Vercel previews):
 *     * All modes (voice-only, cognitive-only, full parcours) remain available
 *     * No backend session generation call is made
 *     * Behavior is strictly unchanged from before
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
import {
  isPublicCampaignDomain,
  BRAIN_AGE_SESSION_ENDPOINT,
} from '../demoguard/constants';
import { FingerprintMotif } from '../components/FingerprintMotif';
import { LanguagePill } from '../components/LanguagePill';

interface Props {
  onStart: (sessionPublicId: string, testScope?: string | null) => void;
}

// ─── Inline SVG icons for chips (no emoji — consistent across OS) ────────

function BoltIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2 L4 14 L11 14 L9 22 L20 9 L13 9 Z"
        fill={color}
      />
    </svg>
  );
}

function BrainIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3 C6.5 3 5 5 5 7 C5 7 3 7.5 3 10 C3 11.5 4 12.5 5 13 C5 13 4 14 4 16 C4 18 6 19.5 8 19 C8 19.5 8.5 20 9.5 20 M9 3 C9 3 10 2.5 12 2.5 C14 2.5 15 3 15 3 M9 3 L9 20 M15 3 C17.5 3 19 5 19 7 C19 7 21 7.5 21 10 C21 11.5 20 12.5 19 13 C19 13 20 14 20 16 C20 18 18 19.5 16 19 C16 19.5 15.5 20 14.5 20 M15 3 L15 20"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FingerIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 11 L9 6 C9 5 9.5 4 11 4 C12.5 4 13 5 13 6 L13 11 M13 11 L13 8 C13 7 13.5 6 15 6 C16.5 6 17 7 17 8 L17 12 M17 12 L17 10 C17 9 17.5 8 19 8 C20.5 8 21 9 21 10 L21 15 C21 19 18 21 14 21 C11 21 9 19.5 7.5 17 L5 13 C4.5 12 5 11 6 11 C7 11 8 12 8.5 12.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IdleScreen({ onStart }: Props) {
  const { t } = useI18n();
  const [sessionId, setSessionId] = useState('');
  const [testScope, setTestScope] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [isPublicDomain, setIsPublicDomain] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostname = window.location.hostname;
    const publicDomain = isPublicCampaignDomain(hostname);

    setIsPublicDomain(publicDomain);

    const qs = params.get('sessionPublicId');
    if (qs && /^hcs_sess_[A-Za-z0-9_-]+$/.test(qs)) {
      setSessionId(qs);
    }

    // Scope resolution:
    // - On public campaign domain: FORCE cognitive-only, ignore any ?testScope= param
    // - On other domains: respect ?testScope= as before (voice-only, cognitive-only)
    if (publicDomain) {
      setTestScope('cognitive-only');
      console.log('[IdleScreen] Public campaign domain detected — testScope forced to cognitive-only');
    } else {
      const scopes = params.getAll('testScope');
      console.log('[IdleScreen] testScope from URL:', scopes.length > 0 ? scopes[0] : '(not present)', 'all values:', scopes);
      if (scopes.length > 0 && (scopes[0] === 'voice-only' || scopes[0] === 'cognitive-only')) {
        setTestScope(scopes[0]);
      }
    }

    // Debug mode: show session ID input for admin/manual testing
    setDebugMode(params.get('debug') === '1');
  }, []);

  /**
   * On the public campaign domain, if no sessionPublicId was provided via URL,
   * generate a traced session via the backend. Falls back gracefully on any error.
   * On non-public domains, this is skipped entirely — no extra network call.
   */
  async function ensureCampaignSession(): Promise<string> {
    if (sessionId.trim()) return sessionId.trim();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(BRAIN_AGE_SESSION_ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.warn('[IdleScreen] Brain-age session API returned', res.status, '— using fallback');
        return '';
      }
      const data = await res.json() as { sessionPublicId?: string };
      if (data.sessionPublicId && /^hcs_sess_[A-Za-z0-9_-]+$/.test(data.sessionPublicId)) {
        console.log('[IdleScreen] Campaign session generated:', data.sessionPublicId);
        return data.sessionPublicId;
      }
      return '';
    } catch (err) {
      console.warn('[IdleScreen] Brain-age session API failed:', err, '— using fallback');
      return '';
    }
  }

  const handleStart = async () => {
    let id = sessionId.trim();

    // On public domain: try to get a traced session from the backend
    if (isPublicDomain && !id) {
      setLoading(true);
      id = await ensureCampaignSession();
      setLoading(false);
    }

    // Fallback if no session was obtained (backend down, rate limited, non-public domain)
    if (!id) {
      id = `dg_${Date.now().toString(36)}`;
    }

    onStart(id, testScope);
  };

  return (
    <div className="idle-screen">
      <LanguagePill />

      <FingerprintMotif size={120} className="idle-fingerprint" />

      <h1 className="idle-title">{t('app.title')}</h1>
      <p className="idle-subtitle">{t('app.subtitle')}</p>

      <div className="idle-chips">
        <div className="idle-chip">
          <span className="idle-chip-icon"><BoltIcon color="#4CF2E0" /></span>
          {t('app.chip.reflexes')}
        </div>
        <div className="idle-chip">
          <span className="idle-chip-icon"><BrainIcon color="#8A7CFF" /></span>
          {t('app.chip.memory')}
        </div>
        <div className="idle-chip">
          <span className="idle-chip-icon"><FingerIcon color="#FF6B8B" /></span>
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

      <button className="idle-start-btn" onClick={handleStart} disabled={loading}>
        {loading ? '…' : t('app.start')}
      </button>

      <p className="idle-no-signup">{t('app.noSignup')}</p>
    </div>
  );
}

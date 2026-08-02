/**
 * DemoGuard — IdleScreen (start screen)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onStart: (sessionPublicId: string, testScope?: string | null) => void;
}

export function IdleScreen({ onStart }: Props) {
  const { t, toggleLocale } = useI18n();
  const [sessionId, setSessionId] = useState('');
  const [testScope, setTestScope] = useState<string | null>(null);

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
  }, []);

  const handleStart = async () => {
    const id = sessionId.trim() || `dg_${Date.now().toString(36)}`;

    // FIX: In cognitive-only mode, the camera screen (which normally primes
    // getUserMedia permission) is skipped. On iOS, the first getUserMedia call
    // shows a permission prompt, and by the time the user taps "Allow", the
    // user gesture context is lost — causing AudioContext.resume() to fail
    // silently on the VoiceScreen, producing empty audio (invalid_audio).
    //
    // Fix: request mic permission here within the click handler (valid user
    // gesture), then stop the stream immediately. By the time VoiceScreen
    // runs, permission is already granted and AudioContext.resume() works
    // synchronously. Default flow (with camera) is unaffected.
    if (testScope === 'cognitive-only') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied or unavailable — VoiceScreen will handle the error
      }
    }

    onStart(id, testScope);
  };

  return (
    <div className="screen-center">
      <div style={{ fontSize: 48 }}>🧠</div>
      <h1>{t('app.title')}</h1>
      <p className="muted">{t('app.subtitle')}</p>
      <input
        type="text"
        placeholder={t('app.sessionPlaceholder')}
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--surface-2)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: '16px',
          minHeight: '48px',
        }}
      />
      <button className="btn" onClick={handleStart}>
        {t('app.start')}
      </button>
      <button
        onClick={toggleLocale}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'var(--surface)',
          border: '1px solid var(--surface-2)',
          borderRadius: 'var(--radius)',
          padding: '4px 12px',
          fontSize: 13,
          color: 'var(--text)',
          cursor: 'pointer',
          minHeight: 32,
        }}
      >
        {t('app.langSwitch')}
      </button>
    </div>
  );
}

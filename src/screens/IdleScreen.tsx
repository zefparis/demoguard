/**
 * DemoGuard — IdleScreen (start screen)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useEffect } from 'react';

interface Props {
  onStart: (sessionPublicId: string) => void;
}

export function IdleScreen({ onStart }: Props) {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qs = params.get('sessionPublicId');
    if (qs && /^hcs_sess_[A-Za-z0-9_-]+$/.test(qs)) {
      setSessionId(qs);
    }
  }, []);

  const handleStart = () => {
    const id = sessionId.trim() || `dg_${Date.now().toString(36)}`;
    onStart(id);
  };

  return (
    <div className="screen-center">
      <div style={{ fontSize: 48 }}>🧠</div>
      <h1>DemoGuard</h1>
      <p className="muted">Contrôle cognitif mobile</p>
      <input
        type="text"
        placeholder="Session ID (auto si vide)"
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
        Démarrer le contrôle
      </button>
    </div>
  );
}

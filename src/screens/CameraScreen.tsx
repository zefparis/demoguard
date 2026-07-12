/**
 * DemoGuard — CameraScreen (selfie capture)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useRef, useState } from 'react';
import { requestCamera, stopCamera, captureSelfieFromVideo } from '../demoguard/collectors/cameraCollector';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  onCaptured: (selfie: import('../demoguard/types').DemoGuardSelfieSignal, selfieB64: string) => void;
  onError: (reason: string) => void;
}

export function CameraScreen({ onCaptured, onError }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState(t('camera.requesting'));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await requestCamera();
        if (cancelled) { stopCamera(stream); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!cancelled) {
          setStatus(t('camera.ready'));
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Camera failed');
      }
    })();
    return () => {
      cancelled = true;
      stopCamera(streamRef.current);
    };
  }, []);

  const handleCapture = async () => {
    try {
      const result = await captureSelfieFromVideo(videoRef.current!, streamRef.current);
      if (result.error) {
        onError(result.error.kind === 'permission-denied' ? t('camera.denied') : result.error.kind === 'unavailable' ? t('camera.unavailable') : result.error.message);
        return;
      }
      if (result.sensitive && result.safe) {
        onCaptured(result.safe, result.sensitive.selfie_b64);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Capture failed');
    }
  };

  return (
    <div className="screen">
      <PhaseHeader title={t('camera.title')} progress="1/7" progressPct={14} />
      <ErrorBoundary>
        <div className="screen-center">
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              maxWidth: 320,
              borderRadius: 'var(--radius)',
              transform: 'scaleX(-1)',
              minHeight: 240,
              background: 'var(--surface)',
            }}
          />
          <p className="muted">{status}</p>
          <button className="btn" onClick={handleCapture} disabled={!ready}>
            {t('camera.capture')}
          </button>
        </div>
      </ErrorBoundary>
    </div>
  );
}

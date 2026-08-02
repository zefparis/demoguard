/**
 * DemoGuard — DoneScreen (result display)
 *
 * "Ton empreinte d'humanité" — two-layer public display:
 *   - Cognitive layer ("Ce que tu fais"): reflex, memory, attention
 *   - Behavioral layer ("Comment tu le fais"): rhythm, confidence, consistency
 *
 * Technical details (status, decision, trust level, brain age breakdown) remain
 * available for admin/debug via a collapsible section, closed by default.
 *
 * INVARIANTS:
 *   - No auth vocabulary ("Accepté", "Statut: submitted") in the public view.
 *   - Technical details preserved intact behind the collapsible.
 *   - computeBrainAge is NOT called here anymore (brainAge.ts kept for reuse).
 *   - Pure display change — no modification to decision logic, pipeline, or payload.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useCallback } from 'react';
import type { DemoGuardSafeResponse } from '../demoguard/types';
import type { CognitiveSignals } from '../demoguard/cognitive/cognitiveTypes';
import { computeBrainAge } from '../demoguard/cognitive/brainAge';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  response: DemoGuardSafeResponse | null;
  cognitiveSignals: CognitiveSignals | null;
  testScope: string | null;
  onReset: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Format a numeric metric, or "—" if null/undefined/NaN */
function fmtMs(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${Math.round(v)} ms`;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return String(Math.round(v));
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

// ─── Metric row component ───────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 14, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// ─── Layer card component ───────────────────────────────────────────────────

function LayerCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ width: '100%', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function DoneScreen({ response, cognitiveSignals, testScope: _testScope, onReset }: Props) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const ok = response?.ok ?? false;
  const fusion = response?.hybridFusion;
  const decision = fusion?.globalDecision;
  const decisionLabel = decision === 'APPROVED' ? t('done.decision.approved')
    : decision === 'REVIEW' ? t('done.decision.review')
    : decision === 'REJECTED' ? t('done.decision.rejected')
    : null;

  // ── Cognitive layer metrics (from state local prop) ──────────────
  const reflex = cognitiveSignals?.reflex;
  const digitSpan = cognitiveSignals?.digit_span;
  const nBack = cognitiveSignals?.n_back;

  const reactionSpeed = reflex?.median_ms != null ? fmtMs(reflex.median_ms) : '—';
  const rangeMin = reflex?.min_ms;
  const rangeMax = reflex?.max_ms;
  const range = (rangeMin != null && rangeMax != null)
    ? `${Math.round(rangeMin)} – ${Math.round(rangeMax)} ms`
    : '—';
  const workingMemory = digitSpan?.max_span != null
    ? `${digitSpan.max_span} ${t('done.fingerprint.digits')}`
    : '—';
  const attentionHolding = nBack?.avg_response_ms != null ? fmtMs(nBack.avg_response_ms) : '—';

  // ── Behavioral layer metrics (from backend response) ─────────────
  const behaviorSummary = fusion?.behaviorSummary;

  const motorRhythm = behaviorSummary?.avgRhythmMs != null ? fmtMs(behaviorSummary.avgRhythmMs) : '—';
  const motorConfidence = behaviorSummary?.motorConfidence != null ? fmtPct(behaviorSummary.motorConfidence) : '—';
  const consistency = behaviorSummary?.consistencyScore != null ? fmtPct(behaviorSummary.consistencyScore) : '—';
  const hesitations = behaviorSummary?.hesitationTotal != null ? fmtNum(behaviorSummary.hesitationTotal) : '—';

  // ── Brain age (kept for debug panel only — not displayed in public view) ──
  const brainAge = computeBrainAge(cognitiveSignals);

  // ── Share handler ─────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const shareData = {
      title: t('done.fingerprint.title'),
      text: t('done.fingerprint.conclusion'),
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2000);
      } else {
        setShareStatus('error');
        setTimeout(() => setShareStatus('idle'), 2000);
      }
    } catch {
      // User cancelled share or clipboard failed — silent
    }
  }, [t]);

  return (
    <div className="screen-scroll">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🖐️</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          {t('done.fingerprint.title')}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          {t('done.fingerprint.subtitle')}
        </p>
      </div>

      {/* ── Cognitive layer ────────────────────────────────────────── */}
      <LayerCard title={t('done.fingerprint.cognitiveLayer')} icon="🧠">
        <MetricRow label={t('done.fingerprint.reactionSpeed')} value={reactionSpeed} />
        <MetricRow label={t('done.fingerprint.range')} value={range} />
        <MetricRow label={t('done.fingerprint.workingMemory')} value={workingMemory} />
        <MetricRow label={t('done.fingerprint.attentionHolding')} value={attentionHolding} />
      </LayerCard>

      {/* ── Behavioral layer ───────────────────────────────────────── */}
      <LayerCard title={t('done.fingerprint.behaviorLayer')} icon="✋">
        <MetricRow label={t('done.fingerprint.motorRhythm')} value={motorRhythm} />
        <MetricRow label={t('done.fingerprint.motorConfidence')} value={motorConfidence} />
        <MetricRow label={t('done.fingerprint.consistency')} value={consistency} />
        <MetricRow label={t('done.fingerprint.hesitations')} value={hesitations} />
      </LayerCard>

      {/* ── Conclusion ─────────────────────────────────────────────── */}
      <p style={{
        fontSize: 14,
        color: 'var(--muted)',
        textAlign: 'center',
        lineHeight: 1.5,
        marginBottom: 20,
        fontStyle: 'italic',
      }}>
        {t('done.fingerprint.conclusion')}
      </p>

      {/* ── Buttons ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <button className="btn" onClick={handleShare}>
          {shareStatus === 'copied'
            ? t('done.fingerprint.shareFallback')
            : shareStatus === 'error'
            ? t('done.fingerprint.shareError')
            : t('done.fingerprint.share')}
        </button>
        <button className="btn" onClick={onReset} style={{ marginTop: 0 }}>
          {t('done.newControl')}
        </button>
      </div>

      {/* ── Technical details (collapsible, closed by default) ─────── */}
      {response && (
        <div style={{ width: '100%', marginTop: 16 }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 13,
              cursor: 'pointer',
              padding: '8px 0',
              textAlign: 'center',
            }}
          >
            {showDetails ? '▼' : '▶'} {t('done.technicalDetails')}
          </button>
          {showDetails && (
            <div className="card" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{t('done.status')}</span>
                <span className="muted">{response.status}</span>
              </div>
              {response.quality_score !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.qualityScore')}</span>
                  <span className="muted">{response.quality_score}</span>
                </div>
              )}
              {decisionLabel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.decision')}</span>
                  <span className="muted">{decisionLabel}</span>
                </div>
              )}
              {fusion?.trustLevel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.trustLevel')}</span>
                  <span className="muted">{fusion.trustLevel}</span>
                </div>
              )}
              {fusion?.cognitiveStatus && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.cognition')}</span>
                  <span className="muted">{fusion.cognitiveStatus}</span>
                </div>
              )}
              {fusion?.vocalStatus && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.voice')}</span>
                  <span className="muted">{fusion.vocalStatus}</span>
                </div>
              )}
              {fusion?.behaviorStatus && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.behavior')}</span>
                  <span className="muted">{fusion.behaviorStatus}</span>
                </div>
              )}
              {response.traceId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{t('done.trace')}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{response.traceId}</span>
                </div>
              )}
              {response.message && (
                <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{response.message}</p>
              )}
              {/* Brain age breakdown for debug */}
              {brainAge && (
                <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Brain Age Breakdown:</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Reflex: {brainAge.breakdown.reflexDelta >= 0 ? '+' : ''}{brainAge.breakdown.reflexDelta}y ·
                    Stroop: {brainAge.breakdown.stroopDelta >= 0 ? '+' : ''}{brainAge.breakdown.stroopDelta}y ·
                    Memory: {brainAge.breakdown.memoryDelta >= 0 ? '+' : ''}{brainAge.breakdown.memoryDelta}y
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fallback when no response at all */}
      {!response && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <div className="result-icon">{ok ? '✅' : '⚠️'}</div>
          <h2>{ok ? t('done.complete') : t('done.uncertain')}</h2>
        </div>
      )}
    </div>
  );
}

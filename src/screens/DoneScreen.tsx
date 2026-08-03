/**
 * DemoGuard — DoneScreen (result display) — campaign UX
 *
 * "Ton empreinte d'humanité" — two-layer public display:
 *   - Cognitive layer ("Ce que tu fais"): reflex, memory, attention
 *   - Behavioral layer ("Comment tu le fais"): rhythm, confidence, consistency
 *
 * Campaign palette applied (--camp-*), fingerprint SVG motif reused from
 * IdleScreen. Inline styles migrated to CSS classes. Pedagogical block
 * "Pourquoi c'est dur à imiter" with real session data in formula displays.
 * Technical details (debug) preserved intact, very discreet at bottom.
 *
 * INVARIANTS:
 *   - No auth vocabulary ("Accepté", "Statut: submitted") in the public view.
 *   - Technical details preserved intact behind the collapsible.
 *   - computeBrainAge is NOT called here anymore (brainAge.ts kept for reuse).
 *   - Pure display change — no modification to decision logic, pipeline, or payload.
 *   - fmtMs/fmtNum/fmtPct helpers and "—" fallback preserved.
 *   - navigator.share + clipboard fallback unchanged.
 *   - Formulas shown are from public scientific literature only (CV, Stroop, std).
 *     No proprietary formulas exposed.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useCallback } from 'react';
import type { DemoGuardSafeResponse, DemoGuardMotionSignal, DemoGuardOrientationSignal } from '../demoguard/types';
import type { CognitiveSignals } from '../demoguard/cognitive/cognitiveTypes';
import { computeBrainAge } from '../demoguard/cognitive/brainAge';
import { useI18n } from '../i18n/I18nContext';
import { FingerprintMotif } from '../components/FingerprintMotif';

interface Props {
  response: DemoGuardSafeResponse | null;
  cognitiveSignals: CognitiveSignals | null;
  testScope: string | null;
  motionSignal: DemoGuardMotionSignal | null | undefined;
  orientationSignal: DemoGuardOrientationSignal | null | undefined;
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
    <div className="done-metric-row">
      <span className="done-metric-label">{label}</span>
      <span className="done-metric-value">{value}</span>
    </div>
  );
}

// ─── Layer card component ───────────────────────────────────────────────────

function LayerCard({
  title,
  icon,
  variant,
  children,
}: {
  title: string;
  icon: string;
  variant: 'cognitive' | 'behavior';
  children: React.ReactNode;
}) {
  return (
    <div className={`done-layer-card done-layer-card-${variant}`}>
      <div className="done-layer-header">
        <i className={`done-layer-icon ti ${icon} done-layer-icon-${variant}`} />
        <h3 className={`done-layer-title done-layer-title-${variant}`}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Pedagogical item component ─────────────────────────────────────────────

function PedagogyItem({
  iconClass,
  iconColor,
  title,
  text,
  formulaLabel,
  formulaValue,
}: {
  iconClass: string;
  iconColor: string;
  title: string;
  text: string;
  formulaLabel?: string;
  formulaValue?: string;
}) {
  return (
    <div className="done-pedagogy-item">
      <i className={`done-pedagogy-item-icon ti ${iconClass}`} style={{ color: iconColor }} />
      <div className="done-pedagogy-item-body">
        <p className="done-pedagogy-item-title">{title}</p>
        <p className="done-pedagogy-item-text">{text}</p>
        {formulaLabel && formulaValue && (
          <div className="done-pedagogy-formula">
            <span className="done-pedagogy-formula-label">{formulaLabel}</span>
            <code className="done-pedagogy-formula-value">{formulaValue}</code>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function DoneScreen({ response, cognitiveSignals, testScope: _testScope, motionSignal, orientationSignal: _orientationSignal, onReset }: Props) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const [showPedagogy, setShowPedagogy] = useState(false);
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
  const stroop = cognitiveSignals?.stroop;
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

  // ── Pedagogy: real session data for formula displays ─────────────
  // a) Motion sensor — only show if permission granted and samples captured
  const showMotionPedagogy = motionSignal?.permission === 'granted' && (motionSignal.sample_count ?? 0) > 0;
  const motionSampleCount = motionSignal?.sample_count ?? 0;
  const accelXStd = motionSignal?.accel_x_std;
  const accelYStd = motionSignal?.accel_y_std;
  const accelZStd = motionSignal?.accel_z_std;
  const accelXStr = accelXStd != null ? accelXStd.toFixed(3) : '—';
  const accelYStr = accelYStd != null ? accelYStd.toFixed(3) : '—';
  const accelZStr = accelZStd != null ? accelZStd.toFixed(3) : '—';

  // b) Reflex CV — coefficient of variation = σ / μ
  const reflexVarMs = reflex?.variance_ms;
  const reflexAvgMs = reflex?.avg_ms;
  const reflexMinMs = reflex?.min_ms;
  const reflexMaxMs = reflex?.max_ms;
  const hasReflexCV = reflexVarMs != null && reflexAvgMs != null && reflexAvgMs > 0;
  const reflexCV = hasReflexCV ? Math.sqrt(reflexVarMs!) / reflexAvgMs! : null;
  const reflexCvStr = reflexCV != null ? reflexCV.toFixed(2) : '—';

  // c) Stroop conflict cost
  const stroopConflictCost = stroop?.conflict_cost_ms;
  const hasStroopConflict = stroopConflictCost != null;
  const stroopConflictStr = stroopConflictCost != null ? `${Math.round(stroopConflictCost)} ms` : '—';

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
    <div className="done-screen screen-scroll">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="done-header">
        <FingerprintMotif size={52} className="done-fingerprint" />
        <h2 className="done-title">
          {t('done.fingerprint.title')}
        </h2>
        <p className="done-subtitle">
          {t('done.fingerprint.subtitle')}
        </p>
      </div>

      {/* ── Cognitive layer ────────────────────────────────────────── */}
      <LayerCard
        title={t('done.fingerprint.cognitiveLayer')}
        icon="ti-brain"
        variant="cognitive"
      >
        <MetricRow label={t('done.fingerprint.reactionSpeed')} value={reactionSpeed} />
        <MetricRow label={t('done.fingerprint.range')} value={range} />
        <MetricRow label={t('done.fingerprint.workingMemory')} value={workingMemory} />
        <MetricRow label={t('done.fingerprint.attentionHolding')} value={attentionHolding} />
      </LayerCard>

      {/* ── Behavioral layer ───────────────────────────────────────── */}
      <LayerCard
        title={t('done.fingerprint.behaviorLayer')}
        icon="ti-hand-finger"
        variant="behavior"
      >
        <MetricRow label={t('done.fingerprint.motorRhythm')} value={motorRhythm} />
        <MetricRow label={t('done.fingerprint.motorConfidence')} value={motorConfidence} />
        <MetricRow label={t('done.fingerprint.consistency')} value={consistency} />
        <MetricRow label={t('done.fingerprint.hesitations')} value={hesitations} />
      </LayerCard>

      {/* ── Conclusion ─────────────────────────────────────────────── */}
      <p className="done-conclusion">
        {t('done.fingerprint.conclusion')}
      </p>

      {/* ── Buttons ────────────────────────────────────────────────── */}
      <div className="done-buttons">
        <button className="done-btn-share" onClick={handleShare}>
          {shareStatus === 'copied'
            ? t('done.fingerprint.shareFallback')
            : shareStatus === 'error'
            ? t('done.fingerprint.shareError')
            : t('done.fingerprint.share')}
        </button>
        <button className="done-btn-reset" onClick={onReset}>
          {t('done.newControl')}
        </button>
      </div>

      {/* ── Pedagogical block (collapsible, closed by default) ─────── */}
      <div className="done-pedagogy-divider" />
      <button
        className="done-pedagogy-toggle"
        onClick={() => setShowPedagogy(!showPedagogy)}
      >
        <i className={`ti ${showPedagogy ? 'ti-chevron-down' : 'ti-chevron-right'}`} /> {t('done.pedagogy.title')}
      </button>
      {showPedagogy && (
        <div className="done-pedagogy-content">
          {showMotionPedagogy && (
            <PedagogyItem
              iconClass="ti-device-mobile-vibration"
              iconColor="#4CF2E0"
              title={t('done.pedagogy.motion.title')}
              text={t('done.pedagogy.motion.text', { count: motionSampleCount })}
              formulaLabel={t('done.pedagogy.motion.formulaLabel')}
              formulaValue={`x ${accelXStr} · y ${accelYStr} · z ${accelZStr}`}
            />
          )}
          <PedagogyItem
            iconClass="ti-wave-sine"
            iconColor="#8A7CFF"
            title={t('done.pedagogy.irregularity.title')}
            text={t('done.pedagogy.irregularity.text', {
              min: reflexMinMs != null ? Math.round(reflexMinMs) : '—',
              max: reflexMaxMs != null ? Math.round(reflexMaxMs) : '—',
            })}
            formulaLabel={t('done.pedagogy.irregularity.formulaLabel')}
            formulaValue={`CV = σ / μ = ${reflexCvStr}`}
          />
          {hasStroopConflict && (
            <PedagogyItem
              iconClass="ti-alert-triangle"
              iconColor="#FF6B8B"
              title={t('done.pedagogy.conflict.title')}
              text={t('done.pedagogy.conflict.text')}
              formulaLabel={t('done.pedagogy.conflict.formulaLabel')}
              formulaValue={`incongruent − congruent = ${stroopConflictStr}`}
            />
          )}
          <div className="done-pedagogy-conclusion">
            {t('done.pedagogy.conclusion')}
          </div>
          <div className="done-pedagogy-divider" />
          <p className="done-pedagogy-patent">{t('done.pedagogy.patent')}</p>
          <a
            className="done-pedagogy-link"
            href="https://www.ia-solution.fr"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="ti ti-external-link" /> IA Solution — Alès, France
          </a>
        </div>
      )}

      {/* ── Technical details (collapsible, closed by default, very discreet) ── */}
      {response && (
        <>
          <button
            className="done-tech-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            <i className={`ti ${showDetails ? 'ti-chevron-down' : 'ti-chevron-right'}`} /> {t('done.technicalDetails')}
          </button>
          {showDetails && (
            <div className="done-tech-card">
              <div className="done-tech-row">
                <span className="done-tech-label">{t('done.status')}</span>
                <span className="done-tech-value">{response.status}</span>
              </div>
              {response.quality_score !== undefined && (
                <div className="done-tech-row">
                  <span className="done-tech-label">{t('done.qualityScore')}</span>
                  <span className="done-tech-value">{response.quality_score}</span>
                </div>
              )}
              {decisionLabel && (
                <div className="done-tech-row">
                  <span className="done-tech-label">{t('done.decision')}</span>
                  <span className="done-tech-value">{decisionLabel}</span>
                </div>
              )}
              {fusion?.trustLevel && (
                <div className="done-tech-row">
                  <span className="done-tech-label">{t('done.trustLevel')}</span>
                  <span className="done-tech-value">{fusion.trustLevel}</span>
                </div>
              )}
              {fusion?.cognitiveStatus && (
                <div className="done-tech-row">
                  <span className="done-tech-label">{t('done.cognition')}</span>
                  <span className="done-tech-value">{fusion.cognitiveStatus}</span>
                </div>
              )}
              {fusion?.vocalStatus && (
                <div className="done-tech-row">
                  <span className="done-tech-label">{t('done.voice')}</span>
                  <span className="done-tech-value">{fusion.vocalStatus}</span>
                </div>
              )}
              {fusion?.behaviorStatus && (
                <div className="done-tech-row">
                  <span className="done-tech-label">{t('done.behavior')}</span>
                  <span className="done-tech-value">{fusion.behaviorStatus}</span>
                </div>
              )}
              {response.traceId && (
                <div className="done-tech-row">
                  <span className="done-tech-label">{t('done.trace')}</span>
                  <span className="done-tech-value done-tech-trace">{response.traceId}</span>
                </div>
              )}
              {response.message && (
                <p className="done-tech-message">{response.message}</p>
              )}
              {/* Brain age breakdown for debug */}
              {brainAge && (
                <div className="done-tech-brainage">
                  <p className="done-tech-brainage-title">Brain Age Breakdown:</p>
                  <p className="done-tech-brainage-detail">
                    Reflex: {brainAge.breakdown.reflexDelta >= 0 ? '+' : ''}{brainAge.breakdown.reflexDelta}y ·
                    Stroop: {brainAge.breakdown.stroopDelta >= 0 ? '+' : ''}{brainAge.breakdown.stroopDelta}y ·
                    Memory: {brainAge.breakdown.memoryDelta >= 0 ? '+' : ''}{brainAge.breakdown.memoryDelta}y
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Fallback when no response at all */}
      {!response && (
        <div className="done-fallback">
          <div className="result-icon">{ok ? '✅' : '⚠️'}</div>
          <h2>{ok ? t('done.complete') : t('done.uncertain')}</h2>
        </div>
      )}
    </div>
  );
}

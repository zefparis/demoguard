/**
 * DemoGuard — TrailTapScreen (sequential path tapping test) — campaign UX
 *
 * UX refactored: segmented progress (5 segments = nodes reached),
 * instruction card, campaign-colored nodes, decorative path trace SVG.
 *
 * CALIBRATION INVARIANTS (DO NOT CHANGE):
 *   - trailTapChallenge.ts untouched (5 nodes, hesitation 1500ms, positions)
 *   - AREA_W=300, AREA_H=320 (line 34-35) — NOT changed (zone R5)
 *   - Node positions computed from normalized points — NOT changed
 *   - startTimeRef.current = performance.now() (line 51) — unchanged
 *   - Per-tap timestamp: performance.now() (line 58) — unchanged
 *   - completion_ms: performance.now() - startTimeRef.current (line 71) — unchanged
 *   - recordTrailTap called before any visual update
 *   - Path trace SVG is purely decorative, computed from already-tapped
 *     nodes — does not influence any measurement
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useEffect, useState, useRef } from 'react';
import {
  TRAIL_TAP_MIN_NODES,
  generateNormalizedTrailPoints,
  computeTrailTapLayout,
  computeNodeRadius,
  computeTrailTapResult,
} from '../demoguard/cognitive/trailTapChallenge';
import type { TrailTapSignal } from '../demoguard/cognitive/cognitiveTypes';
import type { TrailTapNode, TrailTapEvent } from '../demoguard/cognitive/trailTapChallenge';
import { recordTaskStart, recordTrailTap } from '../demoguard/behavior/taskBehaviorRecorder';
import type { BehaviorSession } from '../demoguard/behavior/behaviorSession';
import { PhaseHeader } from '../components/PhaseHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useI18n } from '../i18n/I18nContext';

interface Props {
  session: BehaviorSession;
  onComplete: (signal: TrailTapSignal) => void;
  onError: (reason: string) => void;
}

const AREA_W = 300;
const AREA_H = 320;

export function TrailTapScreen({ session, onComplete }: Props) {
  const { t } = useI18n();
  const [nodes] = useState<TrailTapNode[]>(() => {
    const normalized = generateNormalizedTrailPoints(TRAIL_TAP_MIN_NODES);
    const radius = computeNodeRadius(AREA_W);
    return computeTrailTapLayout(AREA_W, AREA_H, normalized, radius);
  });
  const [events, setEvents] = useState<TrailTapEvent[]>([]);
  const [nextIdx, setNextIdx] = useState(0);
  const [wrongNodeId, setWrongNodeId] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(false);

  useEffect(() => {
    recordTaskStart(session, 'trail_tap');
    startTimeRef.current = performance.now();
  }, []);

  const handleTap = (node: TrailTapNode) => {
    if (completedRef.current) return;
    const expectedId = nextIdx + 1;
    const correct = node.id === expectedId;
    const event: TrailTapEvent = { nodeId: node.id, timestamp: performance.now(), correct };

    if (correct) {
      const prevNode = nextIdx > 0 ? nodes[nextIdx - 1] : null;
      const pathDist = prevNode ? Math.sqrt((node.x - prevNode.x) ** 2 + (node.y - prevNode.y) ** 2) : null;
      const optimalDist = prevNode ? pathDist : null;
      recordTrailTap(session, true, pathDist, optimalDist);
      const newEvents = [...events, event];
      setEvents(newEvents);
      setNextIdx(nextIdx + 1);

      if (nextIdx + 1 >= nodes.length) {
        completedRef.current = true;
        const completionMs = performance.now() - startTimeRef.current;
        const signal = computeTrailTapResult(nodes, newEvents, completionMs);
        onComplete(signal);
      }
    } else {
      recordTrailTap(session, false, null, null);
      setEvents([...events, event]);
      setWrongNodeId(node.id);
      setTimeout(() => setWrongNodeId(null), 500);
    }
  };

  // Decorative path trace — connects already-tapped correct nodes.
  // Purely visual, computed from events AFTER recording. No measurement impact.
  const correctEvents = events.filter((e) => e.correct);
  const pathPoints = correctEvents.map((e) => {
    const n = nodes[e.nodeId - 1];
    return n ? `${(n.x / AREA_W) * 100} ${(n.y / AREA_H) * 100}` : null;
  }).filter(Boolean);

  // Parse hint with |delimiters| for highlighted word
  const hintRaw = t('trailTap.hint');
  const hintParts = hintRaw.split('|');

  return (
    <div className="screen">
      <PhaseHeader
        title={t('trailTap.title')}
        progress={`6/7`}
        segments={{ current: nextIdx, total: nodes.length }}
      />
      <ErrorBoundary onRetry={() => { setEvents([]); setNextIdx(0); completedRef.current = false; startTimeRef.current = performance.now(); }}>
        {/* Persistent instruction card */}
        <div className="camp-instruction-card">
          {hintParts.length === 3 ? (
            <>{hintParts[0]}<strong>{hintParts[1]}</strong>{hintParts[2]}</>
          ) : (
            hintRaw
          )}
        </div>

        <div className="trail-area" style={{ width: '100%', maxWidth: AREA_W, margin: '0 auto' }}>
          {/* Decorative path trace SVG */}
          {pathPoints.length >= 2 && (
            <svg className="trail-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                points={pathPoints.join(' ')}
                fill="none"
                stroke="var(--camp-cyan)"
                strokeWidth="1.5"
                strokeOpacity="0.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {nodes.map((node) => {
            const tapped = node.id <= nextIdx;
            const isWrong = wrongNodeId === node.id;
            const radius = computeNodeRadius(AREA_W);
            return (
              <div
                key={node.id}
                className={`trail-node-campaign ${tapped ? 'tapped' : ''} ${isWrong ? 'wrong' : ''}`}
                style={{
                  left: `${(node.x / AREA_W) * 100}%`,
                  top: `${(node.y / AREA_H) * 100}%`,
                  width: `${radius * 2}px`,
                  height: `${radius * 2}px`,
                  zIndex: 1,
                }}
                onClick={() => handleTap(node)}
              >
                {node.id}
              </div>
            );
          })}
        </div>
      </ErrorBoundary>
    </div>
  );
}

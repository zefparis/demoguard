/**
 * DemoGuard — API client
 *
 * Calls the Vercel proxy at /api/demoguard/verify.
 * NEVER calls the upstream API directly.
 * NEVER sends API keys or PII.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { DEMOGUARD_API_PATH, DEMOGUARD_VOICE_CHALLENGE_API_PATH, DEMOGUARD_REQUEST_TIMEOUT_MS } from './constants';
import type { DemoGuardPayload, DemoGuardSafeResponse } from './types';

export class DemoGuardApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'DemoGuardApiError';
    this.status = status;
    this.code = code;
  }
}

export async function submitDemoGuard(
  payload: DemoGuardPayload,
): Promise<DemoGuardSafeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEMOGUARD_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(DEMOGUARD_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      let code = 'HTTP_ERROR';
      let message = `DemoGuard verify failed: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string; message?: string };
        if (body.error) code = body.error;
        if (body.message) message = body.message;
      } catch {
        // body not JSON
      }
      throw new DemoGuardApiError(res.status, code, message);
    }

    return res.json() as Promise<DemoGuardSafeResponse>;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Voice challenge (anti-replay nonce) ───────────────────────────

export interface VoiceChallengeResponse {
  ok: boolean;
  success: boolean;
  nonce?: string;
  challenge_id?: string;
  expires_at?: number;
  error?: string;
}

export async function requestVoiceChallenge(
  sessionPublicId: string,
): Promise<VoiceChallengeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEMOGUARD_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(DEMOGUARD_VOICE_CHALLENGE_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hcs_session_public_id: sessionPublicId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let code = 'HTTP_ERROR';
      let message = `Voice challenge failed: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string; message?: string };
        if (body.error) code = body.error;
        if (body.message) message = body.message;
      } catch {
        // body not JSON
      }
      throw new DemoGuardApiError(res.status, code, message);
    }

    return res.json() as Promise<VoiceChallengeResponse>;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * DemoGuard — Recursive response sanitizer
 *
 * Removes/masks sensitive fields from upstream responses before
 * returning to the mobile client. Ensures no PII, raw biometric data,
 * tokens, embeddings, or internal debug info leaks.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

const FORBIDDEN_KEYS = new Set([
  'selfie_b64',
  'voice_b64',
  'raw_audio',
  'raw_image',
  'raw_motion_trace',
  'raw_touch_trace',
  'face_embedding',
  'vocal_embedding',
  'mfcc',
  'mfcc_raw',
  'mfcc_summary',
  'voiceprint',
  'first_name',
  'last_name',
  'student_id',
  'email',
  'phone',
  'token',
  'jwt',
  'sessionToken',
  'hcsResultToken',
  'hcsCode',
  'components',
  'breakdown',
  'detail',
  'debug',
  'internal',
]);

export function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      result[key] = sanitizeValue(obj[key]);
    }
    return result;
  }
  return value;
}

export function sanitizeResponse(data: unknown): unknown {
  return sanitizeValue(data);
}

export function isKeyForbidden(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

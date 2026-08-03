/**
 * DemoGuard — Constants
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

export const DEMOGUARD_VERSION = '1.0.0';
export const DEMOGUARD_SOURCE = 'demoguard_mobile' as const;

export const DEMOGUARD_ENABLED =
  (import.meta.env.VITE_DEMOGUARD_ENABLED as string | undefined) === 'true';

export const DEMOGUARD_API_PATH = '/api/demoguard/verify';
export const DEMOGUARD_VOICE_CHALLENGE_API_PATH = '/api/demoguard/voice-challenge';

export const DEMOGUARD_REQUEST_TIMEOUT_MS = 10_000;

// ─── Public campaign domain ───────────────────────────────────────────────
// The custom domain for the public "empreinte d'humanité" campaign.
// When the app is served from this domain (or its www variant), the app
// forces testScope='cognitive-only' and generates a traced session via
// the backend brain-age/session endpoint. All other modes (voice-only,
// full parcours) are only accessible from demoguard.vercel.app, localhost,
// and Vercel preview URLs — never from the public domain.
export const PUBLIC_CAMPAIGN_DOMAIN = 'cognitive-signature.com';

// Backend endpoint for generating a traced public campaign session.
// Returns { sessionPublicId, createdAt, expiresAt, demoGuardUrl }.
// Rate-limited to 25 req/min per IP on the backend side.
export const BRAIN_AGE_SESSION_ENDPOINT =
  'https://hcs-u7-backend-kk0n.onrender.com/api/cognitive/brain-age/session';

/** Check if the current hostname is the public campaign domain. */
export function isPublicCampaignDomain(hostname: string | undefined): boolean {
  if (!hostname) return false;
  return hostname === PUBLIC_CAMPAIGN_DOMAIN || hostname === `www.${PUBLIC_CAMPAIGN_DOMAIN}`;
}

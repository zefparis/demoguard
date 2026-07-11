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

export const DEMOGUARD_REQUEST_TIMEOUT_MS = 10_000;

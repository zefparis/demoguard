/**
 * Meta Pixel (Facebook) — global type declaration.
 *
 * The fbq function is injected by the Meta Pixel base code loaded in index.html.
 * This declaration makes it visible to TypeScript without adding any runtime
 * dependency. No payload types are declared here on purpose: the only events
 * fired from this app are PageView and StartTrial, both binary (no payload).
 */

declare global {
  interface Window {
    fbq?: Fbq;
  }

  type FbqEvent =
    | 'PageView'
    | 'StartTrial';

  interface Fbq {
    (event: 'init', id: string): void;
    (event: 'track', eventName: FbqEvent, payload?: Record<string, unknown>): void;
    (event: 'trackCustom', eventName: string, payload?: Record<string, unknown>): void;
  }
}

export {};

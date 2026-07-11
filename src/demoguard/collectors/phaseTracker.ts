/**
 * DemoGuard — Phase tracker (lightweight singleton)
 *
 * Tracks the current phase and its start time so that streaming
 * collectors can tag samples with the active phase.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

export interface PhaseEntry {
  phase: string;
  startMs: number;
}

class PhaseTrackerImpl {
  private currentPhase: string = 'idle';
  private sessionStartMs: number = 0;
  private history: PhaseEntry[] = [];

  reset(): void {
    this.currentPhase = 'idle';
    this.sessionStartMs = 0;
    this.history = [];
  }

  startSession(): void {
    this.sessionStartMs = performance.now();
    this.currentPhase = 'prep';
    this.history = [{ phase: 'prep', startMs: 0 }];
  }

  setPhase(phase: string): void {
    if (phase === this.currentPhase) return;
    this.currentPhase = phase;
    if (this.sessionStartMs > 0) {
      this.history.push({ phase, startMs: performance.now() - this.sessionStartMs });
    }
  }

  getCurrentPhase(): string {
    return this.currentPhase;
  }

  getRelativeMs(): number {
    if (this.sessionStartMs === 0) return 0;
    return performance.now() - this.sessionStartMs;
  }

  getHistory(): PhaseEntry[] {
    return [...this.history];
  }
}

export const phaseTracker = new PhaseTrackerImpl();

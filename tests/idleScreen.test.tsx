/**
 * DemoGuard — IdleScreen tests (sessionPublicId query param)
 *
 * 3 cases:
 * 1. Valid ?sessionPublicId=hcs_sess_... → pre-filled
 * 2. Invalid ?sessionPublicId=garbage → ignored, field empty
 * 3. No param → field empty, fallback dg_ on start
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IdleScreen } from '../src/screens/IdleScreen';
import { I18nProvider } from '../src/i18n/I18nContext';

function mockLocation(search: string) {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true,
  });
}

describe('IdleScreen — sessionPublicId query param', () => {
  const originalLanguage = navigator.language;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'language', {
      value: 'fr-FR',
      configurable: true,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockLocation('');
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    });
  });

  it('valid ?sessionPublicId=hcs_sess_abc123 pre-fills the input', async () => {
    mockLocation('?sessionPublicId=hcs_sess_abc123DEF_-');
    render(<I18nProvider><IdleScreen onStart={() => {}} /></I18nProvider>);
    const input = screen.getByPlaceholderText('Session ID (auto si vide)') as HTMLInputElement;
    // useEffect runs after render — flush
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(input.value).toBe('hcs_sess_abc123DEF_-');
  });

  it('invalid ?sessionPublicId=garbage is ignored — field stays empty', async () => {
    mockLocation('?sessionPublicId=garbage');
    render(<I18nProvider><IdleScreen onStart={() => {}} /></I18nProvider>);
    const input = screen.getByPlaceholderText('Session ID (auto si vide)') as HTMLInputElement;
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(input.value).toBe('');
  });

  it('no param — field empty, fallback dg_ used on start', async () => {
    mockLocation('');
    const onStart = vi.fn();
    render(<I18nProvider><IdleScreen onStart={onStart} /></I18nProvider>);
    const input = screen.getByPlaceholderText('Session ID (auto si vide)') as HTMLInputElement;
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(input.value).toBe('');
    const btn = screen.getByText('Démarrer le contrôle');
    const fixedDate = new Date('2026-07-11T00:00:00Z').getTime();
    vi.setSystemTime(fixedDate);
    fireEvent.click(btn);
    expect(onStart).toHaveBeenCalledWith(`dg_${fixedDate.toString(36)}`);
  });
});

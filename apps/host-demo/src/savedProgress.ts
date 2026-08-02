import type { SurveyProgress } from '@kajay/core';

const KEY = 'kajay-demo-progress';

/**
 * Where a half-finished survey lives between visits — checklist E6.
 *
 * `sessionStorage` because the demo is a demo: a real host posts this to its own
 * backend from the same two events, and the seam is identical either way. Per tab
 * rather than per browser, so two tabs of the demo are two respondents.
 *
 * The snapshot is plain JSON on purpose, which is what makes the store interchangeable.
 */
export function saveProgress(progress: SurveyProgress): void {
  sessionStorage.setItem(KEY, JSON.stringify(progress));
}

export function clearProgress(): void {
  sessionStorage.removeItem(KEY);
}

/**
 * Reads a snapshot back, or nothing if there is none to read.
 *
 * A stored snapshot is untrusted input like any other: it may be from an older version
 * of the definition, or hand-edited. Anything unreadable is treated as no snapshot at
 * all — starting the survey over is a worse outcome than resuming, and a better one
 * than failing to load.
 */
export function readSavedProgress(): SurveyProgress | undefined {
  const stored = sessionStorage.getItem(KEY);
  if (stored === null) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    return isProgress(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isProgress(value: unknown): value is SurveyProgress {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<SurveyProgress>;
  return typeof candidate.pageName === 'string' && typeof candidate.data === 'object';
}

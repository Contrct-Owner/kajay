/**
 * What the survey is doing, as one value rather than a handful of flags.
 *
 * One value because these are mutually exclusive and a renderer has to pick exactly one
 * thing to draw. Two booleans would let it be asked to draw a completed page for a
 * survey that is still loading, and the answer to that question is not written down
 * anywhere — which is how a renderer ends up deciding policy.
 *
 * `preview` is one of them rather than a flag beside them, which is what keeps it
 * read-only by construction: the survey reports itself read-only while previewing, so
 * every question is already for reading and no renderer has to remember.
 */
export type SurveyState = 'loading' | 'empty' | 'running' | 'preview' | 'completed';

export interface SurveyStateInputs {
  /** The host is fetching the definition, the answers, or saving them. */
  readonly isLoading: boolean;
  readonly isCompleted: boolean;
  readonly isPreviewing: boolean;
  readonly hasVisiblePages: boolean;
}

/**
 * Which state wins.
 *
 * Loading first: while the host says the model is still arriving, everything else it
 * says is provisional, and an "empty survey" message for a definition that has not
 * loaded yet is simply wrong. Completed next, because reaching the end is a fact about
 * the respondent and outranks anything about the pages. Then preview, which is a place
 * they are standing rather than a property of the pages. Empty last before running — a
 * survey whose every page is hidden has nothing to show, and rendering navigation over
 * an empty form is worse than saying so.
 */
export function resolveSurveyState(inputs: SurveyStateInputs): SurveyState {
  if (inputs.isLoading) {
    return 'loading';
  }
  if (inputs.isCompleted) {
    return 'completed';
  }
  if (inputs.isPreviewing) {
    return 'preview';
  }
  return inputs.hasVisiblePages ? 'running' : 'empty';
}

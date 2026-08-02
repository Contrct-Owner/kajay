import type { Question, Survey } from '@kajay/core';

/** Everything a question renderer is given. Renderers hold no state of their own. */
export interface QuestionRendererProps {
  readonly survey: Survey;
  readonly question: Question;
}

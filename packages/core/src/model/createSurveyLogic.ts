import { clearHiddenAnswers } from './clearInvisibleAnswers.js';
import type { Survey } from './Survey.js';
import type { SurveyAnswers } from './SurveyAnswers.js';
import { SurveyLogicHost } from './SurveyLogicHost.js';
import type { SurveyOptions } from './SurveyOptions.js';

/** What the logic host needs back from the survey it is being built for. */
export interface LogicWiring {
  /** Called before anything is announced, while the survey is still consistent. */
  readonly clampPages: () => void;
  readonly writeValue: (name: string, value: unknown) => boolean;
}

/**
 * Builds the survey's logic host and wires it back to the survey.
 *
 * A factory because this is four decisions about *ordering* — when pages are clamped,
 * when values are announced, when hidden answers are cleared — and they read as
 * ordering rather than as a constructor once they are somewhere with room to say why.
 */
export function createSurveyLogic(
  survey: Survey,
  answers: SurveyAnswers,
  options: SurveyOptions,
  wiring: LogicWiring,
): SurveyLogicHost {
  const logic = new SurveyLogicHost(
    survey,
    answers,
    options,
    {
      // Logic may have hidden the page the respondent is standing on, and a listener
      // must never see a page that no longer exists.
      beforeAnnounce: wiring.clampPages,
      value: (event) => {
        survey.onValueChanged.emit(event);
      },
      elementState: (event) => {
        survey.onElementStateChanged.emit(event);
      },
    },
    wiring.writeValue,
  );
  // Inside the settle, so nobody ever sees the moment where the question has gone and
  // its answer has not — and recomputed against, because something may have been
  // reading the answer that just disappeared.
  logic.setAfterSettle(() => {
    clearHiddenAnswers(survey, (name) => {
      // The ordinary write path: nested inside the settle that hid the question, so it
      // buffers rather than announcing, and whatever read the answer recomputes.
      survey.setValue(name, undefined);
    });
  });
  return logic;
}

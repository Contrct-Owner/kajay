import type { Survey as SurveyModel } from '@kajay/core';
import type { FormEvent, ReactElement, RefObject } from 'react';
import { defaultQuestionRenderers } from './defaultQuestionRenderers.js';
import { HtmlSanitizerProvider } from './HtmlSanitizerContext.js';
import type { HtmlSanitizer } from './HtmlSanitizerContext.js';
import type { QuestionRendererRegistry } from './QuestionRendererRegistry.js';
import { SurveyNavigation } from './SurveyNavigation.js';
import { SurveyPage } from './SurveyPage.js';
import { SurveyPreview } from './SurveyPreview.js';
import { SurveyProgressBar } from './SurveyProgressBar.js';
import { SurveyToc } from './SurveyToc.js';
import { SurveyStatusPage } from './SurveyStatusPage.js';
import { useAutoFocus } from './useAutoFocus.js';
import { useErrorFocus } from './useErrorFocus.js';
import {
  useSurveyCurrentPageNo,
  useSurveyLogicState,
  useSurveyStatus,
} from './useSurveyState.js';

export interface SurveyProps {
  readonly model: SurveyModel;
  /** Defaults to the built-in renderers; pass a clone to add custom question types. */
  readonly renderers?: QuestionRendererRegistry;
  /**
   * Cleans author-supplied markup before an `html` element renders it.
   *
   * Required in spirit, optional in the type, for any host whose definitions come from
   * people it does not trust. Nothing ships here: a sanitizer that is nearly right is
   * more dangerous than none, so plug in one that is somebody's full-time job.
   */
  readonly sanitizeHtml?: HtmlSanitizer;
}

/** The survey's own title and description, above the first page. */
function SurveyHeader({ survey }: { readonly survey: SurveyModel }): ReactElement {
  return (
    <>
      {survey.title.length > 0 ? <h1 className="kajay-survey__title">{survey.title}</h1> : null}
      {survey.description.length > 0 ? (
        <p className="kajay-survey__description">{survey.description}</p>
      ) : null}
    </>
  );
}

/**
 * Mounts a survey model.
 *
 * The component holds no survey logic — it reads model state, renders, and pushes
 * every change back through the model's public API. That constraint is what keeps the
 * renderer portable to another framework by construction.
 */
export function Survey({
  model,
  renderers = defaultQuestionRenderers,
  sanitizeHtml,
}: SurveyProps): ReactElement {
  const state = useSurveyStatus(model);
  // Subscribed for the re-render: conditional logic can add, remove or disable
  // elements between renders, and validation errors ride the same channel.
  useSurveyLogicState(model);
  // And again for navigation, which moves for reasons logic knows nothing about.
  const currentPageNo = useSurveyCurrentPageNo(model);
  const { formRef, requestFocus } = useErrorFocus(model);
  useAutoFocus(model, formRef, currentPageNo);

  if (state !== 'running') {
    // Everything that is not the form still needs the sanitizer: the completed markup
    // is author-supplied, and a preview draws real questions.
    return (
      <HtmlSanitizerProvider sanitize={sanitizeHtml}>
        {state === 'preview' ? (
          <SurveyPreview survey={model} renderers={renderers} />
        ) : (
          <SurveyStatusPage survey={model} state={state} />
        )}
      </HtmlSanitizerProvider>
    );
  }

  return (
    <HtmlSanitizerProvider sanitize={sanitizeHtml}>
      <SurveyForm model={model} renderers={renderers} onErrors={requestFocus} formRef={formRef} />
    </HtmlSanitizerProvider>
  );
}

interface SurveyFormProps {
  readonly model: SurveyModel;
  readonly renderers: QuestionRendererRegistry;
  readonly onErrors: () => void;
  readonly formRef: RefObject<HTMLFormElement | null>;
}

/**
 * The answerable survey: header, progress, contents, the page, and the navigation.
 *
 * Split from `Survey` so the component that *chooses* what to draw is not also the one
 * drawing it — the four states above are a different decision from the layout of the
 * form, and reading either was getting harder for the other being there.
 */
function SurveyForm({ model, renderers, onErrors, formRef }: SurveyFormProps): ReactElement {
  // Submitting means "advance", which on the last page means complete. Keeping that
  // decision in the model stops each adapter reinventing "am I at the end".
  //
  // A refused move is the renderer's cue to say why: the model has already recorded
  // the errors, so all that is left is to put the respondent in front of the first one.
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // Only `blocked`. A `pending` move has no error to point at yet — moving focus
    // would land it on a field with nothing wrong with it.
    if (model.nextPageOrComplete() === 'blocked') {
      onErrors();
    }
  };

  const currentPage = model.currentPage;

  return (
    <form className="kajay-survey" ref={formRef} onSubmit={handleSubmit} noValidate>
      <SurveyHeader survey={model} />
      <SurveyProgressBar survey={model} at="top" />
      <SurveyToc survey={model} />

      {currentPage === undefined ? null : (
        <SurveyPage key={currentPage.name} survey={model} page={currentPage} renderers={renderers} />
      )}

      <SurveyProgressBar survey={model} at="bottom" />
      <SurveyNavigation survey={model} />
    </form>
  );
}

import type { Survey as SurveyModel } from '@kajay/core';
import type { CSSProperties, FormEvent, ReactElement, ReactNode, RefObject } from 'react';
import { defaultPageElementRenderers } from './defaultPageElementRenderers.js';
import { HtmlSanitizerProvider } from './HtmlSanitizerContext.js';
import type { HtmlSanitizer } from './HtmlSanitizerContext.js';
import { QuestionRenderersProvider } from './QuestionRenderersContext.js';
import { SurveyCssProvider, useCssClass } from './SurveyCssContext.js';
import type { SurveyCss } from './SurveyCssContext.js';
import { TextRendererProvider } from './TextRendererContext.js';
import type { TextRenderer } from './TextRendererContext.js';
import type { PageElementRendererRegistry } from './PageElementRendererRegistry.js';
import { SurveyNavigation } from './SurveyNavigation.js';
import { SurveyPage } from './SurveyPage.js';
import { SurveyPreview } from './SurveyPreview.js';
import { SurveyProgressBar } from './SurveyProgressBar.js';
import { SurveyTimerPanel } from './SurveyTimerPanel.js';
import { useSurveyTimer } from './useSurveyTimer.js';
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
  readonly renderers?: PageElementRendererRegistry;
  /**
   * Cleans author-supplied markup before an `html` element renders it.
   *
   * Required in spirit, optional in the type, for any host whose definitions come from
   * people it does not trust. Nothing ships here: a sanitizer that is nearly right is
   * more dangerous than none, so plug in one that is somebody's full-time job.
   */
  readonly sanitizeHtml?: HtmlSanitizer;
  /**
   * CSS custom properties to apply to this survey — checklist I2.
   *
   * A plain map, not a theme object: `@kajay/react` may not depend on `@kajay/themes`
   * (the architecture check enforces the direction), and it does not need to. A host
   * calls `themeVariables(darkTheme)` and hands over the result, or writes the same
   * map by hand, or ignores this entirely and overrides the variables in a stylesheet.
   * All three are the same mechanism.
   */
  readonly theme?: Readonly<Record<string, string>>;
  /**
   * Extra class names for the parts of this survey — checklist I4.
   *
   * Added to the built-in names, never substituted for them, and supplied per instance
   * rather than in the definition: a class name is a fact about one host's stylesheet.
   */
  readonly css?: SurveyCss;
  /**
   * Turns authored prose into what is drawn — checklist I6.
   *
   * Where markdown goes, if a host wants markdown. It returns a node rather than an HTML
   * string, so a host that renders markup does it with their own sanitizer and the
   * library never inserts markup it did not build.
   */
  readonly renderText?: TextRenderer;
}

interface SurroundingsProps {
  readonly theme: Readonly<Record<string, string>> | undefined;
  readonly css: SurveyCss | undefined;
  readonly sanitizeHtml: HtmlSanitizer | undefined;
  readonly renderText: TextRenderer | undefined;
  readonly renderers: PageElementRendererRegistry;
  readonly children: ReactNode;
}

/**
 * Everything a survey is drawn *inside*: its theme, its classes, its text handling and
 * its renderers.
 *
 * One component because they are one decision — how this host wants surveys to look and
 * behave — and because every state below needs all four. Four nested providers repeated
 * per state was four chances to forget one.
 */
function Surroundings({
  theme,
  css,
  sanitizeHtml,
  renderText,
  renderers,
  children,
}: SurroundingsProps): ReactElement {
  return (
    <ThemeScope theme={theme}>
      <SurveyCssProvider css={css}>
        <TextRendererProvider renderText={renderText}>
          <HtmlSanitizerProvider sanitize={sanitizeHtml}>
            <QuestionRenderersProvider renderers={renderers}>{children}</QuestionRenderersProvider>
          </HtmlSanitizerProvider>
        </TextRendererProvider>
      </SurveyCssProvider>
    </ThemeScope>
  );
}

/**
 * Scopes a theme to one survey.
 *
 * A wrapper rather than the survey element itself, so the variables reach every state —
 * the form, the preview, the completed page — from one place, and so a page with two
 * surveys on it can theme them differently. Custom properties inherit, which is the
 * whole reason this is one element and not a prop threaded through twenty.
 */
function ThemeScope({
  theme,
  children,
}: {
  readonly theme: Readonly<Record<string, string>> | undefined;
  readonly children: ReactNode;
}): ReactElement {
  // React types `style` as known CSS properties; custom ones are legal at runtime and
  // this is the documented way to pass them.
  return (
    <div className="kajay-theme" style={theme as CSSProperties | undefined}>
      {children}
    </div>
  );
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
  renderers = defaultPageElementRenderers,
  sanitizeHtml,
  theme,
  css,
  renderText,
}: SurveyProps): ReactElement {
  const state = useSurveyStatus(model);
  // Subscribed for the re-render: conditional logic can add, remove or disable
  // elements between renders, and validation errors ride the same channel.
  useSurveyLogicState(model);
  // And again for navigation, which moves for reasons logic knows nothing about.
  const currentPageNo = useSurveyCurrentPageNo(model);
  const { formRef, requestFocus } = useErrorFocus(model);
  useAutoFocus(model, formRef, currentPageNo);

  const surroundings = { theme, css, sanitizeHtml, renderText, renderers };

  if (state !== 'running') {
    // Everything that is not the form still needs the sanitizer: the completed markup
    // is author-supplied, and a preview draws real questions.
    return (
      <Surroundings {...surroundings}>
        {state === 'preview' ? (
          <SurveyPreview survey={model} renderers={renderers} />
        ) : (
          <SurveyStatusPage survey={model} state={state} />
        )}
      </Surroundings>
    );
  }

  return (
    <Surroundings {...surroundings}>
      <SurveyForm model={model} renderers={renderers} onErrors={requestFocus} formRef={formRef} />
    </Surroundings>
  );
}

interface SurveyFormProps {
  readonly model: SurveyModel;
  readonly renderers: PageElementRendererRegistry;
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
  const surveyClass = useCssClass('survey', 'kajay-survey');
  // Held here rather than by the panel: a timed survey with no panel on it is still
  // timed, and a deadline that only arrives when somebody is watching is not one.
  useSurveyTimer(model);
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
    <form className={surveyClass} ref={formRef} onSubmit={handleSubmit} noValidate>
      <SurveyHeader survey={model} />
      <SurveyTimerPanel survey={model} at="top" />
      <SurveyProgressBar survey={model} at="top" />
      <SurveyToc survey={model} />

      {currentPage === undefined ? null : (
        <SurveyPage key={currentPage.name} survey={model} page={currentPage} renderers={renderers} />
      )}

      <SurveyProgressBar survey={model} at="bottom" />
      <SurveyTimerPanel survey={model} at="bottom" />
      <SurveyNavigation survey={model} />
    </form>
  );
}

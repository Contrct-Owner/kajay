import { Panel, Question } from '@kajay/core';
import type { PageElement, Survey as SurveyModel } from '@kajay/core';
import type { ReactElement } from 'react';
import type { QuestionRendererRegistry } from './QuestionRendererRegistry.js';

export interface SurveyElementsProps {
  readonly survey: SurveyModel;
  readonly elements: readonly PageElement[];
  readonly renderers: QuestionRendererRegistry;
}

/**
 * Draws a list of page elements, descending through panels.
 *
 * Panels and their contents are mutually recursive, so both live here rather than in
 * two modules importing each other. Internal to the package: the public surface is
 * `<Survey model={...} />`, and a host customises rendering by registering renderers.
 */
export function SurveyElements({
  survey,
  elements,
  renderers,
}: SurveyElementsProps): ReactElement {
  return (
    <>
      {elements.map((element) =>
        element instanceof Panel ? (
          <PanelRenderer key={element.name} survey={survey} panel={element} renderers={renderers} />
        ) : (
          <QuestionSlot key={element.name} survey={survey} element={element} renderers={renderers} />
        ),
      )}
    </>
  );
}

interface QuestionSlotProps {
  readonly survey: SurveyModel;
  readonly element: PageElement;
  readonly renderers: QuestionRendererRegistry;
}

function QuestionSlot({ survey, element, renderers }: QuestionSlotProps): ReactElement {
  if (!(element instanceof Question)) {
    return (
      <div className="kajay-question kajay-question--unsupported">
        {`"${element.type}" is neither a question nor a panel, so there is nothing to draw.`}
      </div>
    );
  }
  const Renderer = renderers.get(element.type);
  if (Renderer === undefined) {
    return (
      <div className="kajay-question kajay-question--unsupported">
        {`No renderer is registered for question type "${element.type}".`}
      </div>
    );
  }
  return <Renderer survey={survey} question={element} />;
}

interface PanelLegendProps {
  readonly panel: Panel;
  readonly contentId: string;
  readonly isCollapsed: boolean;
}

/**
 * The panel's accessible name, and its toggle when it has one.
 *
 * Only a panel that authored `state` is collapsible. A panel left at `default` is a
 * grouping device, and giving it a toggle would invite a respondent to hide content the
 * author never meant to be hidden.
 */
function PanelLegend({ panel, contentId, isCollapsed }: PanelLegendProps): ReactElement | null {
  if (panel.title.length === 0) {
    return null;
  }
  if (panel.state === 'default') {
    return <legend className="kajay-panel__title">{panel.title}</legend>;
  }
  return (
    <legend className="kajay-panel__title">
      <button
        type="button"
        className="kajay-panel__toggle"
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        onClick={() => {
          panel.setCollapsed(!panel.isCollapsed);
        }}
      >
        {panel.title}
      </button>
    </legend>
  );
}

interface PanelRendererProps {
  readonly survey: SurveyModel;
  readonly panel: Panel;
  readonly renderers: QuestionRendererRegistry;
}

/**
 * Draws one panel.
 *
 * A `fieldset` rather than a `div`: grouping related controls is exactly what it is
 * for, and `disabled` on a fieldset natively disables every control inside it, so a
 * panel's `enableIf` freezes its subtree without the renderer walking children. The
 * spec exempts the first `legend` from that, which is why the collapse toggle keeps
 * working on a disabled panel.
 *
 */
function PanelRenderer({ survey, panel, renderers }: PanelRendererProps): ReactElement {
  const contentId = `kajay-panel-${panel.name}-content`;
  const isCollapsed = panel.state !== 'default' && panel.isCollapsed;

  return (
    // No `aria-label`: a `legend` is already a fieldset's accessible name, and adding
    // one both duplicated it and overrode it — which showed up as the group and the
    // field inside it answering to the same label.
    <fieldset
      className="kajay-panel"
      data-panel-name={panel.name}
      data-collapsed={isCollapsed ? 'true' : undefined}
      disabled={!panel.isEnabled}
    >
      <PanelLegend panel={panel} contentId={contentId} isCollapsed={isCollapsed} />

      {panel.description.length > 0 && !isCollapsed ? (
        <p className="kajay-panel__description">{panel.description}</p>
      ) : null}

      {isCollapsed ? null : (
        <div className="kajay-panel__content" id={contentId}>
          <SurveyElements
            survey={survey}
            elements={panel.visibleElements}
            renderers={renderers}
          />
        </div>
      )}
    </fieldset>
  );
}

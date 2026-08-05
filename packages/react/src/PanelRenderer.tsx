import { Panel } from '@kajay/core';
import type { PageElement, Survey } from '@kajay/core';
import type { ReactElement, ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { PageElementSlot } from './PageElementSlot.js';
import type { PageElementRendererProps } from './PageElementRendererRegistry.js';
import { useQuestionRenderers } from './QuestionRenderersContext.js';
import { useCssClass } from './SurveyCssContext.js';
import { useSurveyComponents } from './SurveyComponents.js';
import { useTextRenderer } from './TextRendererContext.js';

export function PanelRenderer({ survey, element }: PageElementRendererProps): ReactElement {
  if (!(element instanceof Panel)) {
    throw new TypeError('PanelRenderer requires a panel.');
  }
  const renderers = useQuestionRenderers();
  const contentId = `kajay-panel-${element.name}-content`;
  const isCollapsed = element.state !== 'default' && element.isCollapsed;
  const panelClass = useCssClass('panel', 'kajay-panel');
  const columns = { '--kajay-col-count': String(element.colCount) } as CSSProperties;

  return (
    <fieldset
      className={panelClass}
      data-panel-name={element.name}
      data-collapsed={isCollapsed ? 'true' : undefined}
      disabled={!element.isEnabled}
    >
      <PanelLegend panel={element} contentId={contentId} isCollapsed={isCollapsed} />
      {element.description.length > 0 && !isCollapsed ? (
        <p className="kajay-panel__description">
          <PanelText panel={element} text={element.description} kind="description" />
        </p>
      ) : null}
      {isCollapsed ? null : (
        <div className="kajay-panel__content" id={contentId} style={columns}>
          {contents(survey, element).map((child) => (
            <PageElementSlot key={child.name} element={child}>
              {renderers.render(survey, child)}
            </PageElementSlot>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/**
 * What the panel shows.
 *
 * Everything on a design canvas, only what is visible to a respondent. A question hidden
 * by `visibleIf` still has to be editable, and once K2 made a panel's children
 * addressable, one hidden inside a panel became the only element in a survey a designer
 * could not reach. The page-level list never filtered, so this was an inconsistency
 * waiting for somebody to nest something.
 */
function contents(survey: Survey, panel: Panel): readonly PageElement[] {
  return survey.isDesignMode ? panel.elements : panel.visibleElements;
}

interface PanelLegendProps {
  readonly panel: Panel;
  readonly contentId: string;
  readonly isCollapsed: boolean;
}

function PanelLegend({ panel, contentId, isCollapsed }: PanelLegendProps): ReactElement | null {
  const { Button } = useSurveyComponents();
  if (panel.title.length === 0) {
    return null;
  }
  if (panel.state === 'default') {
    return (
      <legend className="kajay-panel__title">
        <PanelText panel={panel} text={panel.title} kind="title" />
      </legend>
    );
  }
  return (
    <legend className="kajay-panel__title">
      <Button
        type="button"
        className="kajay-panel__toggle"
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        onClick={() => {
          panel.setCollapsed(!panel.isCollapsed);
        }}
      >
        <PanelText panel={panel} text={panel.title} kind="title" />
      </Button>
    </legend>
  );
}

/**
 * A panel's own words, through the text seam — checklist P10.
 *
 * A panel is the one page element with prose of its own beyond a title, and the only one a
 * designer names purely for the people reading it. Going through the seam is what lets the
 * Creator make these editable where they sit; a host who supplies no `renderText` gets the
 * string, exactly as before.
 */
function PanelText({
  panel,
  text,
  kind,
}: {
  readonly panel: Panel;
  readonly text: string;
  readonly kind: 'title' | 'description';
}): ReactNode {
  const renderText = useTextRenderer();
  return renderText(text, { kind, owner: panel.name, property: kind });
}

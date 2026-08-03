import { Panel } from '@kajay/core';
import type { ReactElement } from 'react';
import type { CSSProperties } from 'react';
import { PageElementSlot } from './PageElementSlot.js';
import type { PageElementRendererProps } from './PageElementRendererRegistry.js';
import { useCssClass } from './SurveyCssContext.js';

export function PanelRenderer({
  survey,
  element,
  renderers,
}: PageElementRendererProps): ReactElement {
  if (!(element instanceof Panel)) {
    throw new TypeError('PanelRenderer requires a panel.');
  }
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
        <p className="kajay-panel__description">{element.description}</p>
      ) : null}
      {isCollapsed ? null : (
        <div className="kajay-panel__content" id={contentId} style={columns}>
          {element.visibleElements.map((child) => (
            <PageElementSlot key={child.name} element={child}>
              {renderers.render(survey, child)}
            </PageElementSlot>
          ))}
        </div>
      )}
    </fieldset>
  );
}

interface PanelLegendProps {
  readonly panel: Panel;
  readonly contentId: string;
  readonly isCollapsed: boolean;
}

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

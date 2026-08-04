import type { SaveController } from '@kajay/creator-core';
import type { PageElementRendererRegistry } from '@kajay/react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { DesignSurfacePanel } from './DesignSurfacePanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { JsonEditorPanel } from './JsonEditorPanel.js';
import { LogicPanel } from './LogicPanel.js';
import { PageNavigatorPanel } from './PageNavigatorPanel.js';
import { PreviewPanel } from './PreviewPanel.js';
import { PropertyGridPanel } from './PropertyGridPanel.js';
import { SaveButton } from './SaveButton.js';
import { ThemeEditorPanel } from './ThemeEditorPanel.js';
import { ToolboxPanel } from './ToolboxPanel.js';
import { TranslationsPanel } from './TranslationsPanel.js';
import { useDesignerPlacement } from './useDesignerPlacement.js';
import type { CreatorModels } from './SurveyCreator.js';

/** The tabs the default assembly can show. A host names the ones they want — §N2. */
export type CreatorTab = 'design' | 'preview' | 'logic' | 'json' | 'translations' | 'theme';

export const DEFAULT_CREATOR_TABS: readonly CreatorTab[] = [
  'design',
  'preview',
  'logic',
  'json',
  'translations',
  'theme',
];

/** What each tab is called. English until N3, which owns the Creator's own words. */
const TAB_TITLES: Readonly<Record<CreatorTab, string>> = {
  design: 'Design',
  preview: 'Preview',
  logic: 'Logic',
  json: 'JSON',
  translations: 'Translations',
  theme: 'Theme',
};

export interface CreatorTabsProps {
  readonly models: CreatorModels;
  readonly tabs: readonly CreatorTab[];
  readonly tab: CreatorTab;
  readonly onTabChange: (tab: CreatorTab) => void;
  readonly saver?: SaveController | undefined;
  readonly renderers?: PageElementRendererRegistry | undefined;
}

/**
 * One tab at a time, and what is on each — checklist N1.
 *
 * **One at a time is not a layout preference.** A preview is a complete second survey in
 * the document, so showing it beside the designer makes every page-wide query in a host's
 * own tests ambiguous — which M3 found the expensive way, by breaking sixty-nine scenarios
 * at once. A host who wants them side by side arranges the pieces themselves, which is
 * exactly what ADR-0021 is for.
 *
 * They are called tabs because that is what the checklist calls them and what they look
 * like. In the markup they are **navigation**, not an ARIA tablist — see below.
 */
export function CreatorTabs({
  models,
  tabs,
  tab,
  onTabChange,
  saver,
  renderers,
}: CreatorTabsProps): ReactElement {
  const { Button } = useCreatorComponents();

  return (
    <>
      <div className="kajay-creator__tabs">
        {/* **A navigation group with `aria-current`, not a `tablist`.** K4's page navigator
            made this decision first and it holds for the same reason: `role="tab"` promises
            a keyboard contract — arrow keys, Home and End, a `tabpanel` each tab controls —
            and a role that promises one without keeping it is worse than no role. These are
            views of one document, which is what `aria-current` says. An axe sweep found the
            first version claiming the role and not keeping it. */}
        <nav className="kajay-creator__views" aria-label="Creator views">
          {tabs.map((name) => (
            <Button
              key={name}
              className="kajay-creator__tab"
              data-testid={`creator-tab-${name}`}
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => {
                onTabChange(name);
              }}
            >
              {TAB_TITLES[name]}
            </Button>
          ))}
        </nav>
        {saver === undefined ? null : <SaveButton surface={models.surface} saver={saver} />}
      </div>
      <div className="kajay-creator__body">
        <TabBody models={models} tab={tab} renderers={renderers} />
      </div>
    </>
  );
}

function TabBody({
  models,
  tab,
  renderers,
}: {
  readonly models: CreatorModels;
  readonly tab: CreatorTab;
  readonly renderers: PageElementRendererRegistry | undefined;
}): ReactElement {
  switch (tab) {
    case 'design':
      return <DesignTab models={models} renderers={renderers} />;
    case 'preview':
      return (
        <PreviewPanel
          session={models.preview}
          {...(renderers === undefined ? {} : { surveyProps: { renderers } })}
        />
      );
    case 'logic':
      return <LogicPanel session={models.logic} />;
    case 'json':
      return <JsonEditorPanel session={models.json} />;
    case 'translations':
      return <TranslationsPanel session={models.translations} />;
    case 'theme':
      return <ThemeEditorPanel session={models.themeEditor} />;
  }
}

/**
 * The designer: toolbox, canvas, property grid.
 *
 * The placement lives here rather than in the assembly above, because a drag from the
 * toolbox onto the canvas is one gesture crossing two pieces — and it only exists while
 * the design tab is on screen, which is the same span the two pieces do.
 */
function DesignTab({
  models,
  renderers,
}: {
  readonly models: CreatorModels;
  readonly renderers: PageElementRendererRegistry | undefined;
}): ReactElement {
  const placement = useDesignerPlacement(models.surface);

  return (
    <div className="kajay-creator__designer">
      <ToolboxPanel toolbox={models.toolbox} getItemProps={placement.getItemProps} />
      <div className="kajay-creator__canvas">
        <HistoryPanel surface={models.surface} />
        <PageNavigatorPanel surface={models.surface} placement={placement} />
        <DesignSurfacePanel
          surface={models.surface}
          placement={placement}
          {...(renderers === undefined ? {} : { renderers })}
        />
      </div>
      <PropertyGridPanel surface={models.surface} />
    </div>
  );
}

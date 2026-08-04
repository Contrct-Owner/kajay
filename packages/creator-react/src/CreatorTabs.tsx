import type {
  CreatorConfiguration,
  CreatorStringKey,
  CreatorWorkspace,
} from '@kajay/creator-core';
import type { SaveController } from '@kajay/creator-core';
import type { PageElementRendererResolver, SurveyComponents } from '@kajay/react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import { DesignSurfacePanel } from './DesignSurfacePanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { JsonEditorPanel } from './JsonEditorPanel.js';
import { LogicPanel } from './LogicPanel.js';
import { PageNavigatorPanel } from './PageNavigatorPanel.js';
import { PreviewPanel } from './PreviewPanel.js';
import type { PreviewPanelProps } from './PreviewPanel.js';
import { PropertyGridPanel } from './PropertyGridPanel.js';
import { SaveButton } from './SaveButton.js';
import { ThemeEditorPanel } from './ThemeEditorPanel.js';
import { ToolboxPanel } from './ToolboxPanel.js';
import { TranslationsPanel } from './TranslationsPanel.js';
import { useDesignerPlacement } from './useDesignerPlacement.js';

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

/** The catalogue key each tab is named by — checklist N3. */
const TAB_KEYS: Readonly<Record<CreatorTab, CreatorStringKey>> = {
  design: 'tabDesign',
  preview: 'tabPreview',
  logic: 'tabLogic',
  json: 'tabJson',
  translations: 'tabTranslations',
  theme: 'tabTheme',
};

export interface CreatorTabsProps {
  readonly workspace: CreatorWorkspace;
  /** What this deployment has turned off — checklist N2. */
  readonly configuration?: CreatorConfiguration | undefined;
  readonly tabs: readonly CreatorTab[];
  readonly tab: CreatorTab;
  readonly onTabChange: (tab: CreatorTab) => void;
  readonly saver?: SaveController | undefined;
  readonly renderers?: PageElementRendererResolver | undefined;
  /**
   * The host's primitives for the *survey* — P2, distinct from `components`.
   *
   * Two maps because they are two audiences and two packages: `components` dresses the
   * Creator's own chrome, this dresses the survey being previewed. A host who wants one
   * look supplies both, which the reference application does in one object literal.
   */
  readonly surveyComponents?: SurveyComponents | undefined;
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
  workspace,
  configuration,
  tabs,
  tab,
  onTabChange,
  saver,
  renderers,
  surveyComponents,
}: CreatorTabsProps): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <>
      <div className="kajay-creator__tabs">
        {/* **A navigation group with `aria-current`, not a `tablist`.** K4's page navigator
            made this decision first and it holds for the same reason: `role="tab"` promises
            a keyboard contract — arrow keys, Home and End, a `tabpanel` each tab controls —
            and a role that promises one without keeping it is worse than no role. These are
            views of one document, which is what `aria-current` says. An axe sweep found the
            first version claiming the role and not keeping it. */}
        <nav className="kajay-creator__views" aria-label={text('creatorViews')}>
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
              {text(TAB_KEYS[name])}
            </Button>
          ))}
        </nav>
        {saver === undefined ? null : <SaveButton surface={workspace.surface} saver={saver} />}
      </div>
      <div className="kajay-creator__body">
        <TabBody
          workspace={workspace}
          tab={tab}
          renderers={renderers}
          surveyComponents={surveyComponents}
          configuration={configuration}
        />
      </div>
    </>
  );
}

function TabBody({
  workspace,
  tab,
  renderers,
  surveyComponents,
  configuration,
}: {
  readonly workspace: CreatorWorkspace;
  readonly tab: CreatorTab;
  readonly renderers: PageElementRendererResolver | undefined;
  readonly surveyComponents: SurveyComponents | undefined;
  readonly configuration: CreatorConfiguration | undefined;
}): ReactElement {
  switch (tab) {
    case 'design':
      return (
        <DesignTab
          workspace={workspace}
          renderers={renderers}
          configuration={configuration}
        />
      );
    case 'preview':
      return (
        <PreviewPanel
          session={workspace.preview}
          // The preview is the *real* `<Survey>`, so it takes the host's real survey props
          // — including P2's primitive map. A preview drawn with our controls beside a
          // designer drawn with theirs would be the two-design-systems problem again, one
          // tab apart.
          {...surveyPropsFor(renderers, surveyComponents)}
        />
      );
    case 'logic':
      return <LogicPanel session={workspace.logic} />;
    case 'json':
      return <JsonEditorPanel session={workspace.json} />;
    case 'translations':
      return <TranslationsPanel session={workspace.translations} />;
    case 'theme':
      return <ThemeEditorPanel session={workspace.themeEditor} />;
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
  workspace,
  renderers,
  configuration,
}: {
  readonly workspace: CreatorWorkspace;
  readonly renderers: PageElementRendererResolver | undefined;
  readonly configuration: CreatorConfiguration | undefined;
}): ReactElement {
  const placement = useDesignerPlacement(workspace.surface);

  return (
    <div className="kajay-creator__designer">
      <ToolboxPanel toolbox={workspace.toolbox} getItemProps={placement.getItemProps} />
      <div className="kajay-creator__canvas">
        <HistoryPanel surface={workspace.surface} />
        <PageNavigatorPanel surface={workspace.surface} placement={placement} />
        <DesignSurfacePanel
          surface={workspace.surface}
          placement={placement}
          {...(renderers === undefined ? {} : { renderers })}
        />
      </div>
      <PropertyGridPanel
        surface={workspace.surface}
        {...(configuration?.grid === undefined ? {} : { grid: configuration.grid })}
      />
    </div>
  );
}

/**
 * What the preview's `<Survey>` is given.
 *
 * Built rather than spread inline because `exactOptionalPropertyTypes` makes "absent" and
 * "present and undefined" different things, and the passthrough must not turn one into the
 * other — a `renderers: undefined` reaching `<Survey>` would override its default.
 */
function surveyPropsFor(
  renderers: PageElementRendererResolver | undefined,
  components: SurveyComponents | undefined,
): Pick<PreviewPanelProps, 'surveyProps'> {
  const surveyProps = {
    ...(renderers === undefined ? {} : { renderers }),
    ...(components === undefined ? {} : { components }),
  };
  return Object.keys(surveyProps).length === 0 ? {} : { surveyProps };
}

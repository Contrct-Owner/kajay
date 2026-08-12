import type { CreatorConfiguration, CreatorWorkspace } from '@kajay/creator-core';
import type { PageElementRendererResolver } from '@kajay/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { useCreatorText } from './CreatorStringsContext.js';
import { DesignerPanelDialog } from './DesignerPanelDialog.js';
import { DesignSurfacePanel } from './DesignSurfacePanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { PageNavigatorPanel } from './PageNavigatorPanel.js';
import { PropertyGridPanel } from './PropertyGridPanel.js';
import { ToolboxPanel } from './ToolboxPanel.js';
import { useDesignerPlacement } from './useDesignerPlacement.js';
import { useNarrowViewport } from './useNarrowViewport.js';

/**
 * The designer: toolbox, canvas, property grid.
 *
 * The placement lives here rather than in the assembly above, because a drag from the
 * toolbox onto the canvas is one gesture crossing two pieces — and it only exists while
 * the design tab is on screen, which is the same span the two pieces do.
 */
export function DesignTab({
  workspace,
  renderers,
  configuration,
}: {
  readonly workspace: CreatorWorkspace;
  readonly renderers: PageElementRendererResolver | undefined;
  readonly configuration: CreatorConfiguration | undefined;
}): ReactElement {
  const placement = useDesignerPlacement(workspace.surface);
  const isNarrow = useNarrowViewport();
  // One name rather than two booleans: the panels are alternatives, and two booleans can
  // say "both open", which is a state neither of them would survive.
  const [openPanel, setOpenPanel] = useState<DesignerPanel>();
  const showPanel = (panel?: DesignerPanel): void => {
    setOpenPanel(panel);
  };
  // Both layouts show the same three pieces; only where they sit differs. Built once here
  // so that stays true by construction rather than by two branches agreeing.
  const toolbox = (
    <DesignerToolbox
      workspace={workspace}
      placement={placement}
      onPick={isNarrow ? () => { showPanel(); } : undefined}
    />
  );
  const properties = <DesignerProperties workspace={workspace} configuration={configuration} />;
  const canvas = (
    <DesignerCanvas
      workspace={workspace}
      placement={placement}
      renderers={renderers}
      onEditProperties={isNarrow ? () => { showPanel('properties'); } : undefined}
    />
  );

  return isNarrow ? (
    <CompactDesigner
      toolbox={toolbox}
      properties={properties}
      canvas={canvas}
      openPanel={openPanel}
      onOpenPanel={showPanel}
    />
  ) : (
    // Three columns, in reading order. The stylesheet gives the middle one the room.
    <div className="kajay-creator__designer">
      {toolbox}
      {canvas}
      {properties}
    </div>
  );
}

type DesignerPanel = 'toolbox' | 'properties';

/**
 * What a designer can add.
 *
 * `onPick` shuts the panel it is in, because the point of picking is to see what landed —
 * and it is the toolbox's *own* callback rather than a click listener over its markup,
 * since the panel already reports a pick and reading one back out of the DOM would be a
 * second answer to a question the props answer. Absent in the wide layout, where there is
 * no panel to shut.
 */
function DesignerToolbox({
  workspace,
  placement,
  onPick,
}: {
  readonly workspace: CreatorWorkspace;
  readonly placement: ReturnType<typeof useDesignerPlacement>;
  readonly onPick: (() => void) | undefined;
}): ReactElement {
  return (
    <ToolboxPanel
      toolbox={workspace.toolbox}
      getItemProps={placement.getItemProps}
      {...(onPick === undefined ? {} : { onPick })}
    />
  );
}

/**
 * The selected element's properties.
 *
 * The `grid` passthrough is spread rather than passed as `undefined`, because
 * `exactOptionalPropertyTypes` makes "absent" and "present and undefined" different things
 * and the panel's own default is what "absent" must mean.
 */
function DesignerProperties({
  workspace,
  configuration,
}: {
  readonly workspace: CreatorWorkspace;
  readonly configuration: CreatorConfiguration | undefined;
}): ReactElement {
  return (
    <PropertyGridPanel
      surface={workspace.surface}
      {...(configuration?.grid === undefined ? {} : { grid: configuration.grid })}
    />
  );
}

/**
 * The canvas and the two controls above it, which both layouts show the same way.
 *
 * `onEditProperties` is wired only where the grid is behind a button. With it on screen
 * beside the canvas, selecting an element is already the whole gesture and a menu item
 * would be a second way to do what just happened.
 */
function DesignerCanvas({
  workspace,
  placement,
  renderers,
  onEditProperties,
}: {
  readonly workspace: CreatorWorkspace;
  readonly placement: ReturnType<typeof useDesignerPlacement>;
  readonly renderers: PageElementRendererResolver | undefined;
  readonly onEditProperties: ((elementName: string) => void) | undefined;
}): ReactElement {
  return (
    <div className="kajay-creator__canvas">
      <HistoryPanel surface={workspace.surface} />
      <PageNavigatorPanel surface={workspace.surface} placement={placement} />
      <DesignSurfacePanel
        surface={workspace.surface}
        placement={placement}
        {...(renderers === undefined ? {} : { renderers })}
        onEditProperties={onEditProperties}
      />
    </div>
  );
}

/**
 * The designer when three columns will not fit — checklist N1.
 *
 * **The canvas takes the width and the two panels go behind buttons.** Stacking them was
 * what this did before, and stacking put the toolbox *first*: a designer on a phone opened
 * their survey and found thirty question types where it should have been, then scrolled
 * past all of them to reach the thing they came to edit. Giving the canvas the full width
 * is the fix; the panels needing somewhere to go is the consequence.
 *
 * The action bar is last in the tree and sticky, so it pins to the bottom of whatever is
 * scrolling and stays in reach however long the survey grows. First in the tree would
 * render it where it already was — `bottom` pins something that would otherwise sit below
 * the fold — and a designer eight screens down would have to climb back for it.
 *
 * **Selecting an element deliberately does not open the property panel.** Adding a question
 * selects it, so a panel that opened itself would cover the canvas at the exact moment the
 * designer wanted to see what had just landed. Its own menu offers "Properties" instead,
 * which is one press from the element rather than none from the wrong place.
 */
function CompactDesigner({
  toolbox,
  properties,
  canvas,
  openPanel,
  onOpenPanel,
}: {
  readonly toolbox: ReactElement;
  readonly properties: ReactElement;
  readonly canvas: ReactElement;
  readonly openPanel: DesignerPanel | undefined;
  readonly onOpenPanel: (panel?: DesignerPanel) => void;
}): ReactElement {
  const text = useCreatorText();
  const close = (): void => {
    onOpenPanel();
  };

  return (
    <div className="kajay-creator__designer" data-compact="true">
      {canvas}
      <DesignerActions onOpenPanel={onOpenPanel} />
      <DesignerPanelDialog
        isOpen={openPanel === 'toolbox'}
        onClose={close}
        title={text('toolbox')}
        testId="panel-toolbox"
      >
        {toolbox}
      </DesignerPanelDialog>
      {/* The property grid does *not* shut on a change: editing properties is a run of
          edits against one element, and a panel that closed after each would be unusable. */}
      <DesignerPanelDialog
        isOpen={openPanel === 'properties'}
        onClose={close}
        title={text('properties')}
        testId="panel-properties"
      >
        {properties}
      </DesignerPanelDialog>
    </div>
  );
}

/**
 * The two buttons that reach the panels — checklist N1, drawn from the host's primitives.
 *
 * Its own component so it can be the sticky element without the designer around it needing
 * a wrapper: the bar is the last child, and `inset-block-end` pins the last child.
 */
function DesignerActions({
  onOpenPanel,
}: {
  readonly onOpenPanel: (panel?: DesignerPanel) => void;
}): ReactElement {
  const { Button } = useCreatorComponents();
  const text = useCreatorText();

  return (
    <div className="kajay-creator__actions">
      <Button
        className="kajay-creator__action"
        data-testid="open-toolbox"
        onClick={() => {
          onOpenPanel('toolbox');
        }}
      >
        {text('addQuestion')}
      </Button>
      <Button
        className="kajay-creator__action"
        data-testid="open-properties"
        onClick={() => {
          onOpenPanel('properties');
        }}
      >
        {text('properties')}
      </Button>
    </div>
  );
}


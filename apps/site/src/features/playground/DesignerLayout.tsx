import type { CreatorWorkspace } from '@kajay/creator-core';
import {
  DesignSurfacePanel,
  PropertyGridPanel,
  ToolboxPanel,
} from '@kajay/creator-react';
import type { useDesignerPlacement } from '@kajay/creator-react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { DesignerToolbar } from './DesignerToolbar';

/**
 * The custom playground composition proves ADR-0021: the public Creator pieces can build
 * a designer beside a live survey without privileged access to creator-react internals.
 *
 * Two arrangements of the same three pieces, chosen by width. Which one is a *layout*
 * decision, so it would belong in a `sm:` utility if it could — but a sidebar and a sheet
 * are different component trees rather than one tree with different padding, and rendering
 * both would put two toolboxes in the DOM at once. So it is measured instead. See
 * `WIDE_ENOUGH` for where the number comes from.
 */
export function DesignerLayout({
  workspace,
  placement,
}: {
  readonly workspace: CreatorWorkspace;
  readonly placement: ReturnType<typeof useDesignerPlacement>;
}): ReactElement {
  const isWide = useMediaQuery(WIDE_ENOUGH);
  const canvas = (
    <div className="flex min-w-0 flex-col gap-2">
      <DesignerToolbar workspace={workspace} placement={placement} />
      <DesignSurfacePanel surface={workspace.surface} placement={placement} />
    </div>
  );

  if (!isWide) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <CompactPanels workspace={workspace} placement={placement} />
        {canvas}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_15rem] items-start gap-3">
      {canvas}
      <Accordion
        type="multiple"
        defaultValue={['toolbox', 'properties']}
        className="sticky top-4 max-h-[calc(100svh-2rem)] min-w-0 overflow-y-auto pr-1"
      >
        <AccordionItem value="toolbox">
          <AccordionTrigger data-testid="pane-toolbox">Toolbox</AccordionTrigger>
          <AccordionContent>
            <ToolboxPanel toolbox={workspace.toolbox} getItemProps={placement.getItemProps} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="properties">
          <AccordionTrigger data-testid="pane-properties">Properties</AccordionTrigger>
          <AccordionContent>
            <PropertyGridPanel surface={workspace.surface} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/**
 * The width at which a sidebar is worth its 15rem.
 *
 * Arithmetic rather than taste: the sidebar track is a fixed 15rem, the gap is 0.75rem and
 * the page's own padding is 3rem, so the canvas column is whatever those leave behind. At
 * 375px that was 75px, which wrapped a question title to one character per line — the
 * canvas track is `minmax(0,1fr)`, so it absorbed the entire shortfall silently instead of
 * overflowing somewhere a person would have noticed it. 40rem leaves the canvas ~21rem,
 * which is a readable question.
 *
 * Phrased as `min-width` so that "no viewport" and "narrow viewport" give the same answer,
 * which is what makes the hook's server snapshot safe here.
 */
const WIDE_ENOUGH = '(min-width: 40rem)';

/**
 * The same two panels, one at a time, over the canvas.
 *
 * **Two sheets rather than one with tabs.** A designer opening this has already decided
 * which of the two they want — they are either adding something or changing something —
 * and a tab strip would charge every one of them a tap to say so again.
 *
 * The toolbox closes itself on a pick, because the point of picking is to see what landed.
 * The property grid does not: editing properties is a run of changes against one element,
 * and a panel that shut after each would be unusable.
 *
 * **Selecting an element deliberately does not open the properties sheet.** It is tempting,
 * and it is wrong in the case that matters: adding a question selects it, so every add
 * would bury the canvas under a panel at the exact moment the designer wanted to look at
 * what they had just added.
 */
function CompactPanels({
  workspace,
  placement,
}: {
  readonly workspace: CreatorWorkspace;
  readonly placement: ReturnType<typeof useDesignerPlacement>;
}): ReactElement {
  // One name rather than two booleans: the two sheets are alternatives, and two booleans
  // can say "both open", which is a state neither of them would survive.
  const [openPanel, setOpenPanel] = useState<CompactPanel>();
  const close = (): void => {
    setOpenPanel(undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PanelSheet
        panel="toolbox"
        title="Toolbox"
        label="Add question"
        icon={<Plus aria-hidden />}
        openPanel={openPanel}
        onOpenPanel={setOpenPanel}
      >
        {/* The panel's own `onPick`, not a click listener over its markup: it already
            reports a pick, and reading one back out of the DOM would be a second answer to
            a question the props answer. K2's drag ends in a click either way, so one
            callback covers both gestures. */}
        <ToolboxPanel
          toolbox={workspace.toolbox}
          getItemProps={placement.getItemProps}
          onPick={close}
        />
      </PanelSheet>

      <PanelSheet
        panel="properties"
        title="Properties"
        label="Properties"
        icon={<SlidersHorizontal aria-hidden />}
        openPanel={openPanel}
        onOpenPanel={setOpenPanel}
      >
        <PropertyGridPanel surface={workspace.surface} />
      </PanelSheet>
    </div>
  );
}

type CompactPanel = 'toolbox' | 'properties';

/** One button and the sheet it opens, sharing the pair's single open-panel state. */
function PanelSheet({
  panel,
  title,
  label,
  icon,
  openPanel,
  onOpenPanel,
  children,
}: {
  readonly panel: CompactPanel;
  readonly title: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly openPanel: CompactPanel | undefined;
  readonly onOpenPanel: (panel: CompactPanel | undefined) => void;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Sheet
      open={openPanel === panel}
      onOpenChange={(open) => {
        onOpenPanel(open ? panel : undefined);
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`pane-${panel}`}>
          {icon}
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent title={title} data-testid={`sheet-${panel}`}>
        {children}
      </SheetContent>
    </Sheet>
  );
}

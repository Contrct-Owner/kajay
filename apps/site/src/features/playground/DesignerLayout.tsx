import type { CreatorWorkspace } from '@kajay/creator-core';
import {
  DesignSurfacePanel,
  PropertyGridPanel,
  ToolboxPanel,
} from '@kajay/creator-react';
import type { useDesignerPlacement } from '@kajay/creator-react';
import type { ReactElement } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { DesignerToolbar } from './DesignerToolbar';

/**
 * The custom playground composition proves ADR-0021: the public Creator pieces can build
 * a designer beside a live survey without privileged access to creator-react internals.
 */
export function DesignerLayout({
  workspace,
  placement,
}: {
  readonly workspace: CreatorWorkspace;
  readonly placement: ReturnType<typeof useDesignerPlacement>;
}): ReactElement {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_15rem] items-start gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <DesignerToolbar workspace={workspace} placement={placement} />
        <DesignSurfacePanel surface={workspace.surface} placement={placement} />
      </div>
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

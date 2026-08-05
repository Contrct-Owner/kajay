import {
  CreatorComponentsProvider,
  DesignSurfacePanel,
  ToolboxPanel,
  useCreatorWorkspace,
  useDesignerPlacement,
} from '@kajay/creator-react';
import type { SurveyDefinition } from '@kajay/core';
import type { ReactElement } from 'react';
import { KAJAY_CREATOR_COMPONENTS } from '@/kajay/creatorComponents';

/**
 * The designer, running — checklist P8.
 *
 * Two panels, not the whole Creator. A toolbox and canvas demonstrate composition and
 * placement without turning the landing page into a smaller, worse playground.
 */
const SAMPLE: SurveyDefinition = {
  pages: [
    {
      name: 'p1',
      elements: [
        { type: 'text', name: 'company', title: 'Company name' },
        {
          type: 'radiogroup',
          name: 'size',
          title: 'How big is your team?',
          choices: ['1–10', '11–50', '51+'],
        },
      ],
    },
  ],
};

export function DesignerDemo(): ReactElement {
  const workspace = useCreatorWorkspace({ definition: SAMPLE });
  const placement = useDesignerPlacement(workspace.surface);

  return (
    <CreatorComponentsProvider components={KAJAY_CREATOR_COMPONENTS}>
      <div
        className="grid min-w-0 gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]"
        data-testid="designer-demo"
      >
        <ToolboxPanel
          toolbox={workspace.toolbox}
          getItemProps={placement.getItemProps}
          className="max-h-72 overflow-y-auto"
        />
        <DesignSurfacePanel surface={workspace.surface} placement={placement} />
      </div>
    </CreatorComponentsProvider>
  );
}

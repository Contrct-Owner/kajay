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
 * **The section it sits in used to be a paragraph**, which failed the row's own standard:
 * the hero demonstrates the survey half and the designer half was asserted. A drag-and-drop
 * canvas is exactly the claim a screenshot cannot make, because the interesting part is
 * that it moves.
 *
 * **Two panels, not the whole Creator.** A toolbox and a canvas are enough to show what the
 * thing is; a property grid, logic editor, JSON view and page navigator beside them on a
 * landing page would be a smaller, worse playground. The button underneath goes to the real
 * one, which is where somebody who wants the rest should end up.
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
    // The same map the survey above is drawn with. A designer dressed in our controls
    // beside a survey dressed in theirs would undercut the sentence it illustrates.
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

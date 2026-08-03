import { DesignSurface, Toolbox } from '@kajay/creator-core';
import {
  HistoryPanel,
  PageNavigatorPanel,
  PropertyGridPanel,
  useDesignerPlacement,
} from '@kajay/creator-react';
import { useMemo } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { DesignerSurface } from './DesignerSurface.js';
import { DesignerToolbox } from './DesignerToolbox.js';

/** A small survey to design, kept apart from the one the demo asks you to answer. */
const DESIGNED = {
  title: 'A survey being designed',
  pages: [
    {
      name: 'p1',
      title: 'Draft: the first page',
      colCount: 2,
      elements: [
        // Deliberately sharing no name, title or choice with the survey the demo asks
        // you to answer. They are two documents on one page, and a scenario reaching
        // for "paid" should never have to say which one it meant — the first version
        // of this reused those names and broke thirteen unrelated scenarios.
        { type: 'text', name: 'draftName', title: 'Draft: applicant name' },
        {
          type: 'radiogroup',
          name: 'draftTier',
          title: 'Draft: which tier?',
          choices: ['bronze', 'silver'],
        },
        {
          type: 'rating',
          name: 'draftScore',
          title: 'Draft: how likely to recommend?',
          startWithNewLine: true,
          // A reference to another question by name, so renaming `draftName` from the
          // property grid has something to be seen following it — L1's rename claim is
          // otherwise only provable in a unit test.
          visibleIf: '{draftName} notempty',
        },
        // A panel, so a drop *into* one is reachable at all — K2's last gap, and the
        // reason the row stayed partial until the canvas could adorn what is inside it.
        {
          type: 'panel',
          name: 'draftGroup',
          title: 'Draft: extra details',
          startWithNewLine: true,
          elements: [{ type: 'text', name: 'draftRole', title: 'Draft: your role' }],
        },
        { type: 'panel', name: 'draftEmpty', title: 'Draft: nothing here yet', elements: [] },
      ],
    },
    { name: 'p2', elements: [{ type: 'comment', name: 'draftNotes', title: 'Draft: notes' }] },
  ],
};

export interface DesignerProps {
  readonly theme: Readonly<Record<string, string>>;
}

/**
 * The Creator, assembled by the host out of pieces — checklists K1, K2, K3.
 *
 * This is what [ADR-0021](../../../docs/adr/0021-creator-composition.md) is for. The
 * toolbox and the design surface are two independent pieces with no knowledge of each
 * other, and *this file* is the thing that knows they belong together — a host could
 * put the toolbox in a sidebar their application already owns and the canvas in a route.
 *
 * It has to be one component rather than two, because a drag from the toolbox onto the
 * canvas is one gesture crossing both: the placement is created here and handed to each.
 * Two copies would be two gestures, one of which never finishes.
 */
export function Designer({ theme }: DesignerProps): ReactElement {
  // Built once: they hold the selection and the search term, and rebuilding them per
  // render would drop what the designer had picked or typed on every keystroke.
  const surface = useMemo(() => new DesignSurface({ definition: DESIGNED }), []);
  const toolbox = useMemo(() => new Toolbox(), []);
  const placement = useDesignerPlacement(surface);

  return (
    <>
      <DesignerToolbox
        theme={theme}
        toolbox={toolbox}
        getItemProps={placement.getItemProps}
      />
      <DesignerSurface theme={theme} surface={surface} placement={placement}>
        <HistoryPanel surface={surface} />
        <PageNavigatorPanel surface={surface} placement={placement} />
      </DesignerSurface>
      {/* Its own section rather than a strip inside the canvas — a property grid is the
          piece most likely to live somewhere the host already had a sidebar (L1). */}
      <section
        className="host-demo__panel"
        aria-label="Designer properties"
        style={theme as CSSProperties}
      >
        <h2>Properties</h2>
        <PropertyGridPanel surface={surface} />
      </section>
    </>
  );
}

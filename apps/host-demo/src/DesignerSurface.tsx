import { DesignSurface } from '@kajay/creator-core';
import { serializeSurvey } from '@kajay/core';
import { DesignSurfacePanel } from '@kajay/creator-react';
import { useMemo, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement } from 'react';

/** A small survey to design, kept apart from the one the demo asks you to answer. */
const DESIGNED = {
  title: 'A survey being designed',
  pages: [
    {
      name: 'p1',
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
        },
      ],
    },
  ],
};

export interface DesignerSurfaceProps {
  readonly theme: Readonly<Record<string, string>>;
}

/**
 * The design surface, driven the way a host drives it — checklist K3.
 *
 * The definition it edits is its own, not the survey the rest of the demo asks you to
 * answer: a designer and a respondent are two different people looking at two different
 * documents, and sharing one here would make every scenario about the demo's own
 * plumbing rather than about the Creator.
 */
export function DesignerSurface({ theme }: DesignerSurfaceProps): ReactElement {
  // Built once: it holds the selection, and rebuilding it per render would drop what
  // the designer had picked on every keystroke.
  const surface = useMemo(() => new DesignSurface({ definition: DESIGNED }), []);
  const version = useSyncExternalStore(
    (onStoreChange) => surface.onChanged.add(onStoreChange),
    () => surface.version,
  );

  return (
    <section
      className="host-demo__panel"
      aria-label="Design surface"
      style={theme as CSSProperties}
    >
      <h2>Design surface</h2>
      <DesignSurfacePanel surface={surface} />
      <p data-testid="surface-selected">
        {surface.selected === undefined
          ? 'Nothing selected.'
          : `Selected ${String(surface.selected.getPropertyValue('name'))}.`}
      </p>
      <pre data-testid="surface-json" data-version={version}>
        {JSON.stringify(serializeSurvey(surface.survey), null, 2)}
      </pre>
    </section>
  );
}

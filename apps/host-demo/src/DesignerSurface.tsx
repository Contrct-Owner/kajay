import type { DesignSurface } from '@kajay/creator-core';
import { serializeSurvey } from '@kajay/core';
import { DesignSurfacePanel } from '@kajay/creator-react';
import type { DesignerPlacement } from '@kajay/creator-react';
import { useSyncExternalStore } from 'react';
import type { CSSProperties, ReactElement } from 'react';

export interface DesignerSurfaceProps {
  readonly theme: Readonly<Record<string, string>>;
  readonly surface: DesignSurface;
  readonly placement: DesignerPlacement;
}

/**
 * The design surface, driven the way a host drives it — checklist K3.
 *
 * The definition it edits is its own, not the survey the rest of the demo asks you to
 * answer: a designer and a respondent are two different people looking at two different
 * documents, and sharing one here would make every scenario about the demo's own
 * plumbing rather than about the Creator.
 */
export function DesignerSurface({
  theme,
  surface,
  placement,
}: DesignerSurfaceProps): ReactElement {
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
      <DesignSurfacePanel surface={surface} placement={placement} />
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

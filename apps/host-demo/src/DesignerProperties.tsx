import { PropertyEditorProvider, PropertyGridPanel, useCreatorComponents } from '@kajay/creator-react';
import type { PropertyEditorProps, PropertyEditorResolver } from '@kajay/creator-react';
import type { DesignSurface, PropertyGridOptions } from '@kajay/creator-core';
import type { CSSProperties, ReactElement } from 'react';

/**
 * The property grid, customized the way a host customizes it — checklist L4.
 *
 * Everything here is *this deployment's* opinion, and none of it is in the library. The
 * grid the Creator generates is complete, which is what makes it right by default and
 * occasionally wrong for one product — so this is the file where a product disagrees.
 */
const GRID: PropertyGridOptions = {
  // This demo's surveys are not stored under a second key, and a field nobody uses is a
  // field somebody eventually fills in.
  hidden: ['valueName'],
  // L1 derives labels rather than tabling them, and said "Col count" would be the case a
  // host fixed. Here it is, fixed.
  titles: { colCount: 'Columns' },
  // The title is what a designer types first, so it goes above the name.
  order: ['title', 'name'],
  // A section the library has never heard of, kept and drawn where this host asked.
  categories: { correctAnswer: 'Quiz' },
  categoryOrder: ['General', 'Validation', 'Logic', 'Layout', 'Data', 'Quiz'],
};

/**
 * A picker for a property the registry can only call a `string`.
 *
 * L1 named this gap and declined to guess at it: `titleLocation`'s description reads
 * "default, top, left or hidden", and inferring a domain by parsing English prose is not
 * something to build. A *host* knows, so a host says — which is what the editor seam is
 * for, and what closing L1's gap through it rather than in the library looks like.
 */
const TITLE_LOCATIONS = ['default', 'top', 'left', 'hidden'];

function TitleLocationEditor({
  surface,
  element,
  row,
  id,
  hint,
  testId,
}: PropertyEditorProps): ReactElement {
  const { Select } = useCreatorComponents();

  return (
    <Select
      className="kajay-properties__input"
      id={id}
      data-testid={testId}
      aria-describedby={hint}
      value={typeof row.value === 'string' ? row.value : 'default'}
      options={TITLE_LOCATIONS.map((value) => ({ value, label: value }))}
      onValueChange={(value) => {
        surface.setProperty(element, row.name, value);
      }}
    />
  );
}

const resolveEditor: PropertyEditorResolver = (row) =>
  row.name === 'titleLocation' ? TitleLocationEditor : undefined;

export interface DesignerPropertiesProps {
  readonly theme: Readonly<Record<string, string>>;
  readonly surface: DesignSurface;
}

export function DesignerProperties({ theme, surface }: DesignerPropertiesProps): ReactElement {
  return (
    <section
      className="host-demo__panel"
      aria-label="Designer properties"
      style={theme as CSSProperties}
    >
      <h2>Properties</h2>
      <PropertyEditorProvider resolve={resolveEditor}>
        <PropertyGridPanel surface={surface} grid={GRID} />
      </PropertyEditorProvider>
    </section>
  );
}

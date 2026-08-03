import type { DesignSurface } from '@kajay/creator-core';
import type { SurveyElement } from '@kajay/core';
import type { ReactElement } from 'react';
import { CollectionEditor } from './CollectionEditor.js';
import { PropertySection } from './PropertyFields.js';
import { useSurfaceVersion } from './useSurfaceVersion.js';

export interface PropertyGridPanelProps {
  readonly surface: DesignSurface;
  readonly className?: string;
}

/**
 * Every property of the selection, generated from the registry — checklists L1 and L2.
 *
 * A piece ([ADR-0021](../../../docs/adr/0021-creator-composition.md)): it takes the
 * surface and holds nothing, so a host puts it in whichever panel their layout already
 * has. **Nothing here names a property, a type or a collection** — the sections, the
 * order, the labels and the editors all come from `surface.properties` and
 * `surface.collections`, which is the whole claim of both rows.
 *
 * It edits **whatever is selected**, and a page is selectable (K4), so selecting one shows
 * the page's own properties with no code about pages. §L5 is still open: the survey itself
 * is not selectable, and there is nowhere yet for the settings that belong to it.
 */
export function PropertyGridPanel({ surface, className }: PropertyGridPanelProps): ReactElement {
  useSurfaceVersion(surface);
  const selected = surface.selected;

  return (
    <div className={className === undefined ? 'kajay-properties' : `kajay-properties ${className}`}>
      {selected === undefined ? (
        // Deliberately not a live region. The canvas already has one for placement, and
        // K2 learned the expensive way that a second announcing element on the page is
        // something every test that looks one up has to start disambiguating.
        <p className="kajay-properties__empty">Select a question or a page to edit it.</p>
      ) : (
        <SelectedElement surface={surface} element={selected} />
      )}
    </div>
  );
}

/**
 * The properties, then the collections.
 *
 * That order because a property is a fact about the element and a collection is a list of
 * other elements — and a choice list is tall enough that anything below it is below the
 * fold. The `scope` is the element's name, which is unique across the survey, so the ids
 * of a question's fields and those of the third choice inside it cannot collide.
 */
function SelectedElement({
  surface,
  element,
}: {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
}): ReactElement {
  const scope = String(element.getPropertyValue('name') ?? '');

  return (
    <>
      {surface.properties(element).map((category) => (
        <PropertySection
          key={category.name}
          surface={surface}
          element={element}
          category={category}
          scope={scope}
        />
      ))}
      {surface.collections(element).map((collection) => (
        <CollectionEditor
          key={collection.property}
          surface={surface}
          owner={element}
          collection={collection}
          scope={scope}
        />
      ))}
    </>
  );
}

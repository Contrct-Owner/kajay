import type { DesignSurface, PropertyRow } from '@kajay/creator-core';
import type { SurveyElement } from '@kajay/core';
import { createContext, useContext } from 'react';
import type { ComponentType, ReactElement, ReactNode } from 'react';

/**
 * What a host's own editor is handed — checklist L4.
 *
 * Everything the built-in fields have, and nothing they do not: the row (which carries the
 * value, the label, the declared type and L3's read-only state), the element and surface to
 * write through, and the ids the label and hint are already pointing at. A replacement that
 * dropped `id` would be a field with no label attached to it, which is why it is passed
 * rather than left to the host to invent.
 */
export interface PropertyEditorProps {
  readonly surface: DesignSurface;
  readonly element: SurveyElement;
  readonly row: PropertyRow;
  /** What the row's `<label>` points at. A replacement must put it on its control. */
  readonly id: string;
  /** The registry's description, already rendered. Wire it with `aria-describedby`. */
  readonly hint: string | undefined;
  readonly testId: string;
}

/**
 * Which editor to draw for a row, or `undefined` to keep the built-in one.
 *
 * **A function rather than a map**, and the reason is a collision that would otherwise be
 * real: a map keyed by name cannot also be keyed by editor kind without `text` meaning
 * either "the property called text" — which `itemvalue` and every validator have — or
 * "every text field". A function lets a host say `row.name === 'helpUrl'`, or
 * `row.editor === 'json'`, or both, and there is nothing to disambiguate. It is the same
 * shape `IsContainerType` took for the same reason.
 */
export type PropertyEditorResolver = (
  row: PropertyRow,
) => ComponentType<PropertyEditorProps> | undefined;

const PropertyEditorContext = createContext<PropertyEditorResolver | undefined>(undefined);

export interface PropertyEditorProviderProps {
  readonly resolve: PropertyEditorResolver | undefined;
  readonly children: ReactNode;
}

/**
 * Supplies a host's own property editors to every grid below.
 *
 * A context beside `CreatorComponentsProvider` and for its reason: which components draw
 * the Creator is a fact about the *application*, not about any one panel — and a grid
 * rendered with no provider anywhere gets the built-in editors and works.
 *
 * Deliberately **not** part of `CreatorComponents`. That map is ADR-0022's design-system
 * seam — "draw every button with mine" — and this is a different question: "draw *this
 * property* with mine". A host replacing their button set has said nothing about `helpUrl`.
 */
export function PropertyEditorProvider({
  resolve,
  children,
}: PropertyEditorProviderProps): ReactElement {
  return (
    <PropertyEditorContext.Provider value={resolve}>{children}</PropertyEditorContext.Provider>
  );
}

/** The host's editor for a row, if they supplied one. */
export function usePropertyEditor(
  row: PropertyRow,
): ComponentType<PropertyEditorProps> | undefined {
  return useContext(PropertyEditorContext)?.(row);
}

import type { PropertyGridOptions } from './propertyGridOptions.js';
import type { ToolboxItem } from './ToolboxItem.js';

/**
 * What a host is allowed to turn off — checklist N2.
 *
 * **Configuration is a plain value, not a class**, so it can be written in JSON, stored
 * against a customer, sent from a server and diffed in a test. A deployment that offers
 * three question types to one tenant and thirty to another has to be able to *say* so
 * somewhere other than in code.
 *
 * Everything here is a **restriction**. There is no option that adds a capability the
 * library does not otherwise have, which is what keeps the shape checkable: a Creator with
 * no configuration is the most capable one, and every field below can only take something
 * away. That also means an unrecognised field is harmless rather than dangerous, and a
 * host upgrading past a release that added one loses nothing by not knowing about it.
 */
export interface CreatorConfiguration {
  /**
   * The question types a designer may add, by registered type name.
   *
   * Absent means *every* registered type, which is K1's whole claim and must stay the
   * default. A named list restricts; an **empty** list is honoured as "none", because a
   * deployment that offers a fixed set of pre-built pages is a real thing and "empty means
   * unrestricted" is the sort of rule that deletes somebody's restriction by surprise.
   */
  readonly allowedTypes?: readonly string[] | undefined;
  /** Types a designer may not add, applied after {@link allowedTypes}. */
  readonly blockedTypes?: readonly string[] | undefined;
  /**
   * Whether the survey can be changed at all.
   *
   * A **read-only Creator is a viewer**: the canvas, the property grid and the JSON are all
   * still there to read, and nothing writes. That is a different thing from hiding the
   * tabs, and both are worth having — a reviewer needs to see the logic to comment on it.
   */
  readonly isReadOnly?: boolean | undefined;
  /** Restrictions on the property grid — hidden rows, sections, labels. §L4's own options. */
  readonly grid?: PropertyGridOptions | undefined;
}

/**
 * The types a designer may add, given a configuration.
 *
 * Order comes from the registry rather than from the allow-list, so a host cannot
 * accidentally reorder the toolbox by listing types in a different order — which would make
 * the configuration silently do two things at once.
 */
export function allowedToolboxItems(
  items: readonly ToolboxItem[],
  configuration: CreatorConfiguration | undefined,
): readonly ToolboxItem[] {
  const allowed = configuration?.allowedTypes;
  const blocked = new Set(configuration?.blockedTypes ?? []);
  return items.filter(
    (item) =>
      (allowed === undefined || allowed.includes(item.type)) && !blocked.has(item.type),
  );
}

/**
 * Whether a type may be added at all.
 *
 * The same rule as the toolbox filter, asked of one type — because a restricted Creator
 * must refuse a paste and a conversion too, not merely draw a shorter toolbox. A
 * restriction that only hid the button would be a suggestion.
 */
export function isTypeAllowed(type: string, configuration?: CreatorConfiguration): boolean {
  const allowed = configuration?.allowedTypes;
  return (
    (allowed === undefined || allowed.includes(type)) &&
    !(configuration?.blockedTypes ?? []).includes(type)
  );
}

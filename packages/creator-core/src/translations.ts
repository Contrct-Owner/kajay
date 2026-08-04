import { DEFAULT_LOCALE_KEY, localizedTextIn } from './propertyGrid.js';
import type { MetadataRegistry, PropertyValue, Survey, SurveyElement } from '@kajay/core';

/**
 * Every string in a survey that a respondent reads — checklist M4.
 *
 * **Found by walking the registry, not by knowing what a survey contains.** Which
 * properties are translatable is `isLocalizable`, which the registry already declares for
 * J1's sake; what holds what is `getChildCollections`. So a choice's `text`, a validator's
 * message, a matrix column's title and a host's own custom localizable property all turn
 * up here without anything naming them — the same claim K1 made about the toolbox and L1
 * about the property grid, one level deeper.
 */

/** One translatable string, wherever it lives. */
export interface TranslationEntry {
  /**
   * Machine identity, stable across a re-parse, and what a spreadsheet round-trips on.
   *
   * Built from *names* rather than indices — `pages/p1/elements/who/title`, not
   * `pages/0/elements/0/title` — because a translator sends the file back a week later and
   * a question that has moved must not take somebody's German with it to the wrong row.
   * Where a child has no name its own value is its identity, which is what a choice item
   * has instead; only a child with neither falls back to its position.
   */
  readonly key: string;
  /** The trail a human reads: "Which tier? › bronze › Text". */
  readonly context: string;
  readonly element: SurveyElement;
  readonly property: string;
  readonly value: PropertyValue | undefined;
}

/**
 * Every translatable string in the survey, in the order they are authored.
 *
 * Document order, because that is the order a translator will read them in and the order
 * the definition serializes in — the same argument L1 made about property order, and for
 * the same reason there is no second ordering to keep in step.
 */
export function collectTranslations(
  survey: Survey,
  registry: MetadataRegistry,
): readonly TranslationEntry[] {
  const entries: TranslationEntry[] = [];
  visit(survey, 'survey', labelOf(survey), registry, entries);
  return entries;
}

function visit(
  element: SurveyElement,
  key: string,
  context: string,
  registry: MetadataRegistry,
  into: TranslationEntry[],
): void {
  for (const descriptor of registry.getProperties(element.type)) {
    if (descriptor.isLocalizable) {
      into.push({
        key: `${key}/${descriptor.name}`,
        context: `${context} › ${descriptor.name}`,
        element,
        property: descriptor.name,
        value: element.getResolvedProperty(descriptor.name),
      });
    }
  }
  for (const collection of registry.getChildCollections(element.type)) {
    const children = element.getChildren(collection.property);
    for (const [index, child] of children.entries()) {
      const identity = identityOf(child, index);
      visit(
        child,
        `${key}/${collection.property}/${identity}`,
        `${context} › ${labelOf(child)}`,
        registry,
        into,
      );
    }
  }
}

/**
 * What a child answers to.
 *
 * `name` where it has one, its own `value` where it does not — a choice item is identified
 * by what it stores, which is the only thing about it that is stable and unique. Position
 * is the last resort rather than the first, because it is the one that goes wrong silently
 * when somebody reorders a list between exporting a sheet and importing it.
 */
function identityOf(child: SurveyElement, index: number): string {
  const name = child.getPropertyValue('name');
  if (typeof name === 'string' && name.length > 0) {
    return name;
  }
  const value = child.getPropertyValue('value');
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return String(index);
}

/**
 * What a person calls it: the title they wrote, or the name they gave it.
 *
 * Read in the **default** language rather than the survey's current one, because this is
 * the trail a translator navigates by and it has to stay put while they fill a column in.
 * A context that renamed itself as each language was translated would be a moving target.
 */
function labelOf(element: SurveyElement): string {
  const title = localizedTextIn(element.getResolvedProperty('title'), DEFAULT_LOCALE);
  if (title.length > 0) {
    return title;
  }
  const name = element.getPropertyValue('name') ?? element.getPropertyValue('value');
  return typeof name === 'string' || typeof name === 'number' ? String(name) : element.type;
}

/**
 * Every language the survey already speaks.
 *
 * Read off what is *written*, not off a list somebody maintains: a survey's languages are
 * the ones its strings are in. `default` is always among them, because a survey with no
 * translations at all still has a column to translate *from*.
 */
export function localesUsed(entries: readonly TranslationEntry[]): readonly string[] {
  const found = new Set<string>([DEFAULT_LOCALE]);
  for (const entry of entries) {
    const value = entry.value;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const locale of Object.keys(value)) {
        found.add(locale);
      }
    }
  }
  return [...found];
}

/**
 * The language a plain string is in, and the one everything falls back to.
 *
 * Re-exported from the property grid's own constant rather than spelled again: two
 * modules disagreeing about what `default` is called would be a translation table whose
 * source column is empty.
 */
export const DEFAULT_LOCALE: string = DEFAULT_LOCALE_KEY;

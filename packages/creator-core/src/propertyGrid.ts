import { isLocalizedText, resolveLocalizedText } from '@kajay/core';
import type { MetadataRegistry, PropertyDescriptor, PropertyValue, SurveyElement } from '@kajay/core';
import {
  GENERAL_CATEGORY,
  LOGIC_CATEGORY,
  orderPropertyCategories,
  PROPERTY_CATEGORIES,
} from './propertyCategories.js';

/**
 * The property grid, generated from the metadata registry — checklist L1.
 *
 * **Nothing in this file names a property**, which is the row's actual claim and the same
 * one K1 made about the toolbox. The rows come from `registry.getProperties(type)`, the
 * editor comes from the declared property type, the label is derived from the name and the
 * hint is the registry's own description. A custom question type, or a custom property
 * added to a built-in one with `addProperty`, therefore appears here with no further
 * wiring — and a test registers both to prove it rather than trusting the shape of the
 * code.
 *
 * The one thing the registry does not supply is which section a property belongs in, and
 * [`propertyCategories`](./propertyCategories.ts) says why that is deliberate.
 */

/**
 * How a property is edited. One kind per declared property type, and no more.
 *
 * The mapping is by *type* because that is the only thing the registry declares about a
 * value's shape. `titleLocation` is a `string` whose description happens to read
 * "default, top, left or hidden", and turning that into a picker would mean parsing
 * English prose to guess a domain — a thing that works until somebody writes a
 * description slightly differently. The honest fix is a domain on the descriptor, which
 * is §L4's to add; until then those are text fields and the description sits under them.
 *
 * `literal` and `json` both draw as a text field and differ in how the text is read back —
 * see {@link parseEditorText}. They are separate kinds rather than one, because the kind
 * is the whole of what a view needs to know.
 */
export type PropertyEditorKind = 'text' | 'number' | 'boolean' | 'literal' | 'json';

/**
 * When a keystroke reaches the survey.
 *
 * Everything commits as it is typed, except an element's `name`. Renaming rewrites every
 * reference to it (see {@link renameIn}), so committing per keystroke would take `{who}`
 * through `{w}`, `{wh}`, `{who}` on the way to `{whom}` — a series of renames of names
 * that never existed, each one its own entry in K6's undo stack, and each one re-parsing
 * the survey underneath the field being typed in.
 */
export type PropertyCommit = 'change' | 'blur';

/** One property, ready to draw. */
export interface PropertyRow {
  readonly name: string;
  /** The label, derived from the name — see {@link humanizePropertyName}. */
  readonly title: string;
  /** The registry's own description, drawn as a hint. */
  readonly description: string | undefined;
  readonly editor: PropertyEditorKind;
  readonly commit: PropertyCommit;
  /**
   * The value in force: what was authored, or the registered default.
   *
   * Raw, so a boolean editor reads a boolean. {@link PropertyRow.text} is the same value
   * as a text-shaped editor shows it, which is not always `String(value)` — a localizable
   * property holds `{ default, fr }` and shows one language of it.
   */
  readonly value: PropertyValue | undefined;
  readonly text: string;
  readonly isRequired: boolean;
  readonly isLocalizable: boolean;
}

/** Rows that belong together, in the order they are drawn. */
export interface PropertyGridCategory {
  readonly name: string;
  readonly rows: readonly PropertyRow[];
}

/**
 * Every property of an element, grouped and ordered — checklist L1.
 *
 * **Ordered within a section by what the registry declares**, which is inheritance order
 * then declaration order — and therefore the order the element serializes in. A designer
 * who has read the JSON finds the properties where they left them, and there is no second
 * ordering to keep in step with the first. Curating one here would be a table that has to
 * name every property of every type to be complete, which is the coupling this row exists
 * to avoid.
 *
 * A section with nothing in it is not returned, so a type with no layout properties draws
 * no empty "Layout" heading.
 */
export function propertyRowsFor(
  element: SurveyElement,
  registry: MetadataRegistry,
): readonly PropertyGridCategory[] {
  const grouped = new Map<string, PropertyRow[]>();
  for (const descriptor of registry.getProperties(element.type)) {
    const category = categoryOf(descriptor);
    const bucket = grouped.get(category);
    const row = rowFor(element, descriptor);
    if (bucket === undefined) {
      grouped.set(category, [row]);
    } else {
      bucket.push(row);
    }
  }
  return orderPropertyCategories([...grouped.keys()]).map((name) => ({
    name,
    rows: grouped.get(name) ?? [],
  }));
}

function categoryOf(descriptor: PropertyDescriptor): string {
  // The table first, then the registry's own declaration, then General. A property that
  // is both listed and an expression is listed on purpose — `setValueExpression` would
  // be Logic either way, but a host's table entry has to be able to win.
  return (
    PROPERTY_CATEGORIES.get(descriptor.name) ??
    (descriptor.isExpression ? LOGIC_CATEGORY : GENERAL_CATEGORY)
  );
}

function rowFor(element: SurveyElement, descriptor: PropertyDescriptor): PropertyRow {
  const value = element.getResolvedProperty(descriptor.name) ?? descriptor.defaultValue;
  return {
    name: descriptor.name,
    title: humanizePropertyName(descriptor.name),
    description: descriptor.description,
    editor: editorKindFor(descriptor),
    // `name` is the identity every expression in the survey refers to; see PropertyCommit.
    commit: descriptor.name === 'name' ? 'blur' : 'change',
    value,
    text: editorText(value, descriptor, element.localeScope.locale),
    isRequired: descriptor.isRequired,
    isLocalizable: descriptor.isLocalizable,
  };
}

/** The editor a declared property type is drawn with. */
export function editorKindFor(descriptor: PropertyDescriptor): PropertyEditorKind {
  switch (descriptor.type) {
    case 'string':
      return 'text';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'value':
      return 'literal';
    case 'json':
      return 'json';
  }
}

/**
 * The value as a text-shaped editor shows it.
 *
 * A **localizable** property is shown in the survey's current language, not as the object
 * it is stored in. That is the same decision K3's inline title editor made and it has to
 * be the same one: a designer editing a French survey's title should see the French, and
 * writing back merges rather than replaces (see `DesignSurface.setProperty`).
 */
function editorText(
  value: PropertyValue | undefined,
  descriptor: PropertyDescriptor,
  locale: string,
): string {
  if (value === undefined) {
    return '';
  }
  if (descriptor.isLocalizable && isLocalizedText(value)) {
    return resolveLocalizedText(value, locale);
  }
  if (descriptor.type === 'json') {
    return typeof value === 'string' && value.length === 0 ? '' : JSON.stringify(value);
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Reads an editor's text back into a value, or refuses it.
 *
 * `undefined` means **do not write**, and it is a real answer rather than an error: a
 * number field is empty for a moment while somebody retypes it, and a JSON field is
 * unparseable for as long as it takes to type an object. Writing `0` the instant a field
 * is cleared is how a number editor becomes impossible to clear.
 *
 * A `literal` holds whichever scalar the author wrote — a `valueTrue` of `true` and a
 * `min` of `0` are the same property type — so the text is read as one: `true` and
 * `false` are booleans, anything that parses as a finite number is a number, and
 * everything else is the string. The cost is exact and worth stating: the *string*
 * `"true"` cannot be typed into a literal field. §L4's editor customization is where a
 * host that needs one says so.
 */
export function parseEditorText(
  kind: PropertyEditorKind,
  text: string,
): PropertyValue | undefined {
  switch (kind) {
    case 'text':
      return text;
    case 'number':
      return numberOrNothing(text);
    case 'literal':
      return literalFrom(text);
    case 'json':
      return jsonOrNothing(text);
    case 'boolean':
      // Nothing types into a checkbox. A view that reaches here has drawn the wrong
      // editor, and returning the text would quietly store a string in a boolean.
      return undefined;
  }
}

function numberOrNothing(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function literalFrom(text: string): PropertyValue {
  const trimmed = text.trim();
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }
  return numberOrNothing(text) ?? text;
}

function jsonOrNothing(text: string): PropertyValue | undefined {
  if (text.trim().length === 0) {
    // The registered default for a `json` property, and what every reader of one already
    // treats as "nothing was authored". Refusing the empty field instead would make a
    // `correctAnswer` impossible to take back off a question.
    return '';
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed === undefined ? undefined : (parsed as PropertyValue);
  } catch {
    return undefined;
  }
}

/**
 * `startWithNewLine` to "Start with new line", `showTOC` to "Show TOC".
 *
 * **Derived rather than tabled**, which is a real decision and not laziness. A table of
 * human labels would have to name every property of every registered type to be complete,
 * would be missing an entry the day a property was added, and would leave a host's custom
 * property as the one row in the grid with a machine name — the exact failure this row
 * claims not to have. Where the derived label reads oddly ("Col count") the registry's own
 * description sits underneath it saying what the property means, and §L4's customization
 * API is where a host renames one.
 *
 * Runs of capitals are kept whole, so an acronym survives rather than being spelled out.
 */
export function humanizePropertyName(name: string): string {
  const words = name.split(/(?<=[a-z\d])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/u);
  return words
    .map((word, index) => (index === 0 ? capitalize(word) : lowerUnlessAcronym(word)))
    .join(' ');
}

function capitalize(word: string): string {
  return word.length === 0 ? word : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`;
}

function lowerUnlessAcronym(word: string): string {
  return word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase();
}

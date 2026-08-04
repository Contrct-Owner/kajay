/**
 * Which drawer of the property grid a property lives in — checklist L1.
 *
 * **In the Creator, not in the metadata registry**, for the reason
 * [`builtInToolbox`](./builtInToolbox.ts) gives about the toolbox: "which section does a
 * designer find this under" is a decision about a designer, and the registry is the
 * runtime's. A survey being answered on a server has no property grid.
 *
 * The table is deliberately **short**, and short in a specific way: it names only the
 * properties that belong somewhere *other* than General. Everything it has never heard of
 * is General, which is the opposite of the toolbox's fallback and the right way round for
 * this row. An unlisted toolbox item is an unknown type among known ones, so it goes last;
 * an unlisted *property* is almost always the one the designer opened the grid to find —
 * `rateMax` on a rating, `inputType` on a text question — and burying those under "Other"
 * would mean this table had to name every property of every type to stay useful. That is
 * exactly the coupling K1 refused.
 *
 * N3 localized these: a section name now comes from the Creator's string catalogue, with
 * the word below as the fallback for a section a host's own table invented (§L4).
 */

/** Where anything unclassified goes, and the first section a designer reads. */
export const GENERAL_CATEGORY = 'General';

/**
 * Everything that holds an expression.
 *
 * **Not a table entry — derived.** `PropertyDescriptor.isExpression` already says so, and
 * says so for a reason the registry itself records: more than one thing needs to know
 * which properties are expressions, and a list kept elsewhere is wrong the day a property
 * arrives. So a custom property registered with `isExpression: true` lands here with no
 * entry below, and every row in this section is one the §M logic editor can open.
 *
 * The cost is visible and worth naming: `requiredIf` sits here while `isRequired` sits
 * under Validation, one section away from its pair. That is the price of the section
 * meaning something exact rather than meaning "expressions, mostly".
 */
export const LOGIC_CATEGORY = 'Logic';

const VALIDATION = 'Validation';
const LAYOUT = 'Layout';
const DATA = 'Data';

/**
 * The properties that are not General, by name.
 *
 * Names rather than types, because two properties of the same type belong in different
 * places — `width` is layout and `valueName` is data, and both are strings.
 */
export const PROPERTY_CATEGORIES: ReadonlyMap<string, string> = new Map([
  // Validation, which §L2's validators editor joins.
  ['isRequired', VALIDATION],
  ['requiredErrorText', VALIDATION],

  // Where the element sits, rather than what it asks.
  ['startWithNewLine', LAYOUT],
  ['width', LAYOUT],
  ['minWidth', LAYOUT],
  ['titleLocation', LAYOUT],
  ['colCount', LAYOUT],
  ['state', LAYOUT],
  ['indent', LAYOUT],

  // How the answer is stored and scored, rather than how it is asked.
  ['valueName', DATA],
  ['correctAnswer', DATA],
  ['includeIntoResult', DATA],
]);

/**
 * The order the sections are drawn in.
 *
 * Named rather than alphabetical, for the reason the toolbox's order is: a grid is read
 * top to bottom, and the properties a designer changes on nearly every question should be
 * the ones they do not have to scroll to. Anything a host's own table adds follows, in
 * the order it was met.
 */
export const PROPERTY_CATEGORY_ORDER: readonly string[] = [
  GENERAL_CATEGORY,
  LOGIC_CATEGORY,
  VALIDATION,
  LAYOUT,
  DATA,
];

/**
 * The sections present, in the order to draw them.
 *
 * Exported rather than kept private to the grid, and for a reason worth stating: the
 * second half of it — a section this file has never heard of, kept and drawn last —
 * cannot be reached at all until §L4 lets a host add one, and logic no test can reach is
 * logic nobody has checked. As a function it is reachable now, and it is the same thing
 * §L4 will call.
 */
export function orderPropertyCategories(present: readonly string[]): readonly string[] {
  const known = PROPERTY_CATEGORY_ORDER.filter((name) => present.includes(name));
  return [...known, ...present.filter((name) => !PROPERTY_CATEGORY_ORDER.includes(name))];
}

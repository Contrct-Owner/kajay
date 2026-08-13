import type { PropertyValue } from '@kajay/core';
import { OTHER_CATEGORY } from './ToolboxItem.js';

/**
 * What the built-in types are called and where they live — checklist K1.
 *
 * **In the Creator, not in the metadata registry.** "Which drawer does this live in"
 * and "what does a designer call this" are decisions about a designer, and the registry
 * is the runtime's: a survey being answered on a server has no toolbox and no drawers,
 * and putting a category on a class descriptor would ship that decision to every
 * consumer of the definition format.
 *
 * The consequence is the point of the row: a type this table has never heard of still
 * *appears*, in {@link OTHER_CATEGORY} under a fallback title. Auto-population is not a
 * courtesy extended to types we listed.
 *
 * **N3 localized the categories, not the titles.** A category is one of the Creator's own
 * words and now comes from its string catalogue, with the word below as the fallback for a
 * drawer the catalogue has never heard of. An item's *title* stayed here: K1 made it
 * host-curatable data — replaced by re-adding the item — and putting it in the catalogue
 * too would have made the two mechanisms fight over the same string.
 */
export interface BuiltInEntry {
  readonly title: string;
  readonly category: string;
  readonly keywords?: readonly string[];
  /** What the created element starts with. See {@link STARTER}. */
  readonly defaults?: Readonly<Record<string, PropertyValue>>;
}

/**
 * Starter content — checklist N5's finding.
 *
 * Until N5 walked the whole designer path for the first time, every built-in item created
 * an element with nothing in it: a dropped dropdown had no choices, a matrix had no rows
 * and no columns, a repeating panel had no template. Each was a question a respondent
 * could look at and not answer, and a designer's first act after every drop was the same
 * three clicks.
 *
 * **A starter exists where a question would otherwise be unanswerable, not merely where it
 * would be empty.** So the choice lists, the matrix axes, the multiple-text fields and the
 * repeating template have one, and `html`, `image` and `expression` do not: their content
 * is *entirely* the designer's, there is no placeholder for it that is not noise, and a
 * display element nobody filled in is empty rather than broken.
 *
 * Written here rather than as registered defaults because it is a decision about a
 * designer, which is what this whole file is: a survey arriving from a server must not
 * grow three choices because somebody left `choices` out, and
 * [ADR-0016](../../../docs/adr/0016-metadata-owns-property-defaults.md) is the reason that
 * distinction has somewhere to live — "unset" and "explicitly empty" are already different
 * states, and this is neither.
 */
type Starters = 'choices' | 'fields' | 'grid' | 'cells' | 'rows' | 'template' | 'blanks';

const STARTER: Readonly<Record<Starters, Readonly<Record<string, PropertyValue>>>> = {
  choices: { choices: ['Item 1', 'Item 2', 'Item 3'] },
  fields: { items: [{ name: 'item1', title: 'Item 1' }, { name: 'item2', title: 'Item 2' }] },
  // A dropped fill-in-the-blank with no template renders *nothing at all*, which is the
  // clearest case this map exists for: the prose and the blanks it names arrive together,
  // because either alone is a question nobody can answer.
  blanks: {
    template: 'The [[blank1]] is [[blank2]].',
    blanks: [{ name: 'blank1' }, { name: 'blank2' }],
  },
  grid: { columns: ['Column 1', 'Column 2', 'Column 3'], rows: ['Row 1', 'Row 2'] },
  cells: {
    columns: [{ type: 'text', name: 'column1', title: 'Column 1' }],
    rows: ['Row 1', 'Row 2'],
  },
  rows: { columns: [{ type: 'text', name: 'column1', title: 'Column 1' }] },
  template: { templateElements: [{ type: 'text', name: 'question1', title: 'Question 1' }] },
};

const TEXT = 'Text';
const CHOICE = 'Choice';
const MATRIX = 'Matrix';
const PANELS = 'Panels';
const MEDIA = 'Media';
const DISPLAY = 'Display';

export const BUILT_IN_TOOLBOX: ReadonlyMap<string, BuiltInEntry> = new Map([
  ['text', { title: 'Single-line input', category: TEXT, keywords: ['input', 'field'] }],
  ['comment', { title: 'Long text', category: TEXT, keywords: ['textarea', 'paragraph'] }],
  ['multipletext', { title: 'Multiple text fields', category: TEXT, keywords: ['group'],
    defaults: STARTER['fields'] }],
  ['fillintheblank', { title: 'Fill in the blank', category: TEXT,
    keywords: ['cloze', 'gap', 'quiz', 'assessment'], defaults: STARTER['blanks'] }],

  ['radiogroup', { title: 'Radio group', category: CHOICE, keywords: ['single', 'one of'],
    defaults: STARTER['choices'] }],
  ['checkbox', { title: 'Checkboxes', category: CHOICE, keywords: ['multiple', 'many of'],
    defaults: STARTER['choices'] }],
  ['dropdown', { title: 'Dropdown', category: CHOICE, keywords: ['select', 'combo'],
    defaults: STARTER['choices'] }],
  ['tagbox', { title: 'Multi-select dropdown', category: CHOICE, keywords: ['select', 'tags'],
    defaults: STARTER['choices'] }],
  ['boolean', { title: 'Yes / No', category: CHOICE, keywords: ['switch', 'toggle'] }],
  ['rating', { title: 'Rating', category: CHOICE, keywords: ['stars', 'scale', 'nps'] }],
  ['imagepicker', { title: 'Image picker', category: CHOICE, keywords: ['picture', 'choice'],
    defaults: STARTER['choices'] }],
  ['ranking', { title: 'Ranking', category: CHOICE, keywords: ['order', 'sort', 'priority'],
    defaults: STARTER['choices'] }],

  ['matrix', { title: 'Single-select matrix', category: MATRIX, keywords: ['grid', 'table'],
    defaults: STARTER['grid'] }],
  ['matrixcells', { title: 'Matrix with cell types', category: MATRIX, keywords: ['grid'],
    defaults: STARTER['cells'] }],
  ['matrixdynamic', { title: 'Dynamic matrix', category: MATRIX, keywords: ['grid', 'rows'],
    defaults: STARTER['rows'] }],

  ['panel', { title: 'Panel', category: PANELS, keywords: ['group', 'section'] }],
  ['paneldynamic', { title: 'Repeating panel', category: PANELS, keywords: ['group', 'repeat'],
    defaults: STARTER['template'] }],

  ['file', { title: 'File upload', category: MEDIA, keywords: ['attach', 'upload'] }],
  ['signaturepad', { title: 'Signature', category: MEDIA, keywords: ['sign', 'draw'] }],
  ['image', { title: 'Image', category: MEDIA, keywords: ['picture', 'logo'] }],

  ['html', { title: 'HTML', category: DISPLAY, keywords: ['markup', 'rich text'] }],
  ['expression', { title: 'Computed value', category: DISPLAY, keywords: ['formula', 'total'] }],
]);

/**
 * The order categories are drawn in.
 *
 * Named rather than alphabetical, because a toolbox is read top to bottom and the
 * common answers should be near the top; alphabetical would open with "Choice" and bury
 * "Text" in the middle. Anything not listed follows, in the order it was met.
 */
export const CATEGORY_ORDER: readonly string[] = [
  TEXT,
  CHOICE,
  MATRIX,
  PANELS,
  MEDIA,
  DISPLAY,
  OTHER_CATEGORY,
];

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
 * These strings are English and will stay English until N3, which owns localizing the
 * Creator's own words. A host may override any of them today by replacing the item.
 */
export interface BuiltInEntry {
  readonly title: string;
  readonly category: string;
  readonly keywords?: readonly string[];
}

const TEXT = 'Text';
const CHOICE = 'Choice';
const MATRIX = 'Matrix';
const PANELS = 'Panels';
const MEDIA = 'Media';
const DISPLAY = 'Display';

export const BUILT_IN_TOOLBOX: ReadonlyMap<string, BuiltInEntry> = new Map([
  ['text', { title: 'Single-line input', category: TEXT, keywords: ['input', 'field'] }],
  ['comment', { title: 'Long text', category: TEXT, keywords: ['textarea', 'paragraph'] }],
  ['multipletext', { title: 'Multiple text fields', category: TEXT, keywords: ['group'] }],

  ['radiogroup', { title: 'Radio group', category: CHOICE, keywords: ['single', 'one of'] }],
  ['checkbox', { title: 'Checkboxes', category: CHOICE, keywords: ['multiple', 'many of'] }],
  ['dropdown', { title: 'Dropdown', category: CHOICE, keywords: ['select', 'combo'] }],
  ['tagbox', { title: 'Multi-select dropdown', category: CHOICE, keywords: ['select', 'tags'] }],
  ['boolean', { title: 'Yes / No', category: CHOICE, keywords: ['switch', 'toggle'] }],
  ['rating', { title: 'Rating', category: CHOICE, keywords: ['stars', 'scale', 'nps'] }],
  ['imagepicker', { title: 'Image picker', category: CHOICE, keywords: ['picture', 'choice'] }],
  ['ranking', { title: 'Ranking', category: CHOICE, keywords: ['order', 'sort', 'priority'] }],

  ['matrix', { title: 'Single-select matrix', category: MATRIX, keywords: ['grid', 'table'] }],
  ['matrixcells', { title: 'Matrix with cell types', category: MATRIX, keywords: ['grid'] }],
  ['matrixdynamic', { title: 'Dynamic matrix', category: MATRIX, keywords: ['grid', 'rows'] }],

  ['panel', { title: 'Panel', category: PANELS, keywords: ['group', 'section'] }],
  ['paneldynamic', { title: 'Repeating panel', category: PANELS, keywords: ['group', 'repeat'] }],

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

import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import type { PropertyDefinition } from './PropertyDescriptor.js';

/**
 * How a matrix lays itself out on a narrow screen — checklist F6.
 *
 * Shared by all three matrix types, which are not related to each other by inheritance:
 * a single-select matrix, a table of cells and a table of respondent-added rows are the
 * same problem on a phone, and an author who learned the word on one should not find it
 * spelled differently on the next.
 */
const MOBILE_MODE: PropertyDefinition = {
  name: 'mobileMode',
  type: 'string',
  defaultValue: 'auto',
  description: 'auto, table or list. auto turns the table into a list on a narrow screen.',
};

interface MatrixTypeDefinitions {
  readonly matrix: ClassMetadataDefinition;
  readonly matrixTotal: ClassMetadataDefinition;
  readonly matrixCells: ClassMetadataDefinition;
  readonly matrixDynamic: ClassMetadataDefinition;
}

/**
 * Authoritative metadata for the matrix family (§F).
 *
 * Its own file, like the select family: §F adds a type at a time, and the question file
 * has already outgrown one limit.
 *
 * Rows and columns are `itemvalue` collections rather than a shape of their own. They
 * are choices in every respect that matters — a value, display text, and a `visibleIf`
 * evaluated by the same engine — and a parallel type would have meant a second
 * definition of the same thing for the registry, the Creator and every host to learn.
 */
export const MATRIX_TYPE_DEFINITIONS: MatrixTypeDefinitions = {
  matrix: {
    name: 'matrix',
    parent: 'question',
    properties: [
      {
        name: 'isAllRowRequired',
        type: 'boolean',
        description: 'Every visible row demands an answer, not just the question as a whole.',
      },
      {
        name: 'eachRowUnique',
        type: 'boolean',
        description: 'No two rows may be answered with the same column.',
      },
      {
        name: 'alternateRows',
        type: 'boolean',
        description: 'Shade alternate rows. Presentation only.',
      },
      MOBILE_MODE,
    ],
    childCollections: [
      { property: 'columns', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
      { property: 'rows', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
    ],
  },
  matrixTotal: {
    name: 'matrixtotal',
    properties: [
      { name: 'column', type: 'string', isRequired: true, description: 'The column summarised.' },
      { name: 'kind', type: 'string', description: 'sum, count, min, max or avg.' },
      {
        name: 'expression',
        type: 'string',
        isExpression: true,
        description: 'Computes the figure instead. {row.col} is that column own total.',
      },
      {
        name: 'format',
        type: 'string',
        description: 'Template around the figure, with {0} standing for it.',
      },
      { name: 'precision', type: 'number', description: 'Decimal places shown.' },
    ],
  },
  matrixCells: {
    name: 'matrixcells',
    parent: 'question',
    properties: [
      {
        name: 'detailPanelMode',
        type: 'string',
        defaultValue: 'none',
        description: 'none, underRow, or underRowSingle (one row open at a time).',
      },
      MOBILE_MODE,
    ],
    childCollections: [
      // Ordinary question definitions. A column *is* a question — what SurveyJS spells
      // as `cellType` is simply `type` here — so a cell gets that type's properties,
      // validators, choices and renderer without the matrix knowing any of them.
      { property: 'columns', elementBaseType: 'question' },
      { property: 'rows', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
      { property: 'detailElements', elementBaseType: 'question' },
      { property: 'totals', elementBaseType: 'matrixtotal' },
    ],
  },
  matrixDynamic: {
    name: 'matrixdynamic',
    parent: 'question',
    properties: [
      {
        name: 'minRowCount',
        type: 'number',
        description: 'Rows shown before the respondent adds any, and the floor on removal.',
        defaultValue: 1,
      },
      { name: 'maxRowCount', type: 'number', description: '0 means no limit.' },
      { name: 'allowAddRows', type: 'boolean', defaultValue: true },
      { name: 'allowRemoveRows', type: 'boolean', defaultValue: true },
      { name: 'addRowText', type: 'string',
        isLocalizable: true, defaultValue: 'Add row' },
      { name: 'removeRowText', type: 'string',
        isLocalizable: true, defaultValue: 'Remove' },
      {
        name: 'confirmDelete',
        type: 'boolean',
        description: 'Removing a row asks first. A row can hold a lot of typing.',
      },
      {
        name: 'confirmDeleteText',
        type: 'string',
        isLocalizable: true,
        defaultValue: 'Remove this row?',
      },
      {
        name: 'rowTitleFormat',
        type: 'string',
        isLocalizable: true,
        description: 'Row header template, with {0} as the row number.',
      },
      {
        name: 'defaultRowValue',
        type: 'json',
        description: 'Answers a new row starts with, keyed by column name.',
      },
      {
        name: 'defaultValueFromLastRow',
        type: 'boolean',
        description: 'A new row starts as a copy of the one before it. Wins over defaultRowValue.',
      },
      {
        name: 'detailPanelMode',
        type: 'string',
        defaultValue: 'none',
        description: 'none, underRow, or underRowSingle (one row open at a time).',
      },
      MOBILE_MODE,
    ],
    childCollections: [
      { property: 'columns', elementBaseType: 'question' },
      { property: 'detailElements', elementBaseType: 'question' },
      { property: 'totals', elementBaseType: 'matrixtotal' },
    ],
  },
};

import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface MatrixTypeDefinitions {
  readonly matrix: ClassMetadataDefinition;
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
    ],
    childCollections: [
      { property: 'columns', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
      { property: 'rows', elementBaseType: 'itemvalue', shorthandProperty: 'value' },
    ],
  },
};

import { MatrixQuestion } from '../model/MatrixQuestion.js';
import { MATRIX_TYPE_DEFINITIONS } from './matrixTypeDefinitions.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/** Registers the matrix family. Runs after the select types, which declare `itemvalue`. */
export function registerMatrixTypes(registry: MetadataRegistry): void {
  registry.addClass({
    ...MATRIX_TYPE_DEFINITIONS.matrix,
    create: () => new MatrixQuestion(),
  });
}

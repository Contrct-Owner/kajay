import { MatrixCellsQuestion } from '../model/MatrixCellsQuestion.js';
import { MatrixDynamicQuestion } from '../model/MatrixDynamicQuestion.js';
import { MatrixQuestion } from '../model/MatrixQuestion.js';
import { MatrixTotal } from '../model/MatrixTotal.js';
import { MATRIX_TYPE_DEFINITIONS } from './matrixTypeDefinitions.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/** Registers the matrix family. Runs after the select types, which declare `itemvalue`. */
export function registerMatrixTypes(registry: MetadataRegistry): void {
  registry.addClass({
    ...MATRIX_TYPE_DEFINITIONS.matrix,
    create: () => new MatrixQuestion(),
  });
  registry.addClass({
    ...MATRIX_TYPE_DEFINITIONS.matrixTotal,
    create: () => new MatrixTotal(),
  });
  registry.addClass({
    ...MATRIX_TYPE_DEFINITIONS.matrixCells,
    create: () => new MatrixCellsQuestion(),
  });
  registry.addClass({
    ...MATRIX_TYPE_DEFINITIONS.matrixDynamic,
    create: () => new MatrixDynamicQuestion(),
  });
}

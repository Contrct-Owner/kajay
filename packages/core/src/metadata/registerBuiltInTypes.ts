import type { MetadataRegistry } from './MetadataRegistry.js';
import { registerCoreTypes } from './registerCoreTypes.js';
import { registerDisplayTypes } from './registerDisplayTypes.js';
import { registerMatrixTypes } from './registerMatrixTypes.js';
import { registerQuestionTypes } from './registerQuestionTypes.js';
import { registerSelectTypes } from './registerSelectTypes.js';
import { registerTriggerTypes } from './registerTriggerTypes.js';
import { registerValidatorTypes } from './registerValidatorTypes.js';

/**
 * Registers the built-in type set.
 *
 * Order matters only for inheritance: a parent must exist before its children. Split
 * by family because the list grows with every §C row, and one file would keep
 * outgrowing its limit.
 */
export function registerBuiltInTypes(registry: MetadataRegistry): void {
  registerCoreTypes(registry);
  registerTriggerTypes(registry);
  registerValidatorTypes(registry);
  registerQuestionTypes(registry);
  registerSelectTypes(registry);
  registerMatrixTypes(registry);
  registerDisplayTypes(registry);
}

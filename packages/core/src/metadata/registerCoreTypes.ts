import { CalculatedValue } from '../model/CalculatedValue.js';
import { Page } from '../model/Page.js';
import { Survey } from '../model/Survey.js';
import { CORE_TYPE_DEFINITIONS } from './coreTypeDefinitions.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/**
 * Registers the survey root, calculated values, and pages.
 *
 * Factories stay here because they depend on the model. Property metadata stays in
 * the model-free definition object shared with direct-instance default resolution.
 */
export function registerCoreTypes(registry: MetadataRegistry): void {
  registry.addClass({ ...CORE_TYPE_DEFINITIONS.survey, create: () => new Survey() });
  registry.addClass({
    ...CORE_TYPE_DEFINITIONS.calculatedValue,
    create: () => new CalculatedValue(),
  });
  registry.addClass({ ...CORE_TYPE_DEFINITIONS.page, create: () => new Page() });
}

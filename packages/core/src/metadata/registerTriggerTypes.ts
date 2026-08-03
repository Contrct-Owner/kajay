import { Trigger } from '../model/Trigger.js';
import type { MetadataRegistry } from './MetadataRegistry.js';
import { TRIGGER_TYPE_DEFINITIONS } from './triggerTypeDefinitions.js';

/** Registers the trigger base and every trigger kind. */
export function registerTriggerTypes(registry: MetadataRegistry): void {
  registry.addClass(TRIGGER_TYPE_DEFINITIONS.trigger);
  registry.addClass({
    ...TRIGGER_TYPE_DEFINITIONS.setValue,
    create: () => new Trigger('setvalue'),
  });
  registry.addClass({
    ...TRIGGER_TYPE_DEFINITIONS.copyValue,
    create: () => new Trigger('copyvalue'),
  });
  registry.addClass({
    ...TRIGGER_TYPE_DEFINITIONS.runExpression,
    create: () => new Trigger('runexpression'),
  });
  registry.addClass({
    ...TRIGGER_TYPE_DEFINITIONS.complete,
    create: () => new Trigger('complete'),
  });
  registry.addClass({
    ...TRIGGER_TYPE_DEFINITIONS.skip,
    create: () => new Trigger('skip'),
  });
}

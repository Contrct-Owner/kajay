import { Trigger } from '../model/Trigger.js';
import type { MetadataRegistry } from './MetadataRegistry.js';

/**
 * Triggers: an abstract base plus one concrete class per kind.
 *
 * Splitting them by class rather than giving one class every property is what lets the
 * contract say precisely which properties each kind takes, and what stops
 * `{"type": "complete", "gotoName": "..."}` from looking well-formed.
 */
function registerTriggerBase(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'trigger',
    isAbstract: true,
    properties: [
      {
        name: 'expression',
        type: 'string',
        isRequired: true,
        description: 'The trigger acts when this becomes true, not while it stays true.',
      },
    ],
  });
}

/** Kinds that write an answer. */
function registerValueTriggers(registry: MetadataRegistry): void {
  registry.addClass({
    name: 'setvalue',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string', isRequired: true },
      { name: 'setValue', type: 'value', description: 'Literal written to setToName.' },
    ],
    create: () => new Trigger('setvalue'),
  });

  registry.addClass({
    name: 'copyvalue',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string', isRequired: true },
      { name: 'fromName', type: 'string', isRequired: true },
    ],
    create: () => new Trigger('copyvalue'),
  });

  registry.addClass({
    name: 'runexpression',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string' },
      { name: 'runExpression', type: 'string', isRequired: true },
    ],
    create: () => new Trigger('runexpression'),
  });
}

/** Kinds that act on the survey rather than on an answer. */
function registerFlowTriggers(registry: MetadataRegistry): void {
  registry.addClass({ name: 'complete', parent: 'trigger', create: () => new Trigger('complete') });

  registry.addClass({
    name: 'skip',
    parent: 'trigger',
    properties: [
      {
        name: 'gotoName',
        type: 'string',
        isRequired: true,
        description: 'Page name, or a question name whose page is navigated to.',
      },
    ],
    create: () => new Trigger('skip'),
  });
}

/** The trigger base and every kind. */
export function registerTriggerTypes(registry: MetadataRegistry): void {
  registerTriggerBase(registry);
  registerValueTriggers(registry);
  registerFlowTriggers(registry);
}

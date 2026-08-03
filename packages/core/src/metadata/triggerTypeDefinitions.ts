import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface TriggerTypeDefinitions {
  readonly trigger: ClassMetadataDefinition;
  readonly setValue: ClassMetadataDefinition;
  readonly copyValue: ClassMetadataDefinition;
  readonly runExpression: ClassMetadataDefinition;
  readonly complete: ClassMetadataDefinition;
  readonly skip: ClassMetadataDefinition;
}

/** Authoritative metadata for the trigger base and every trigger kind. */
export const TRIGGER_TYPE_DEFINITIONS: TriggerTypeDefinitions = {
  trigger: {
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
  },
  setValue: {
    name: 'setvalue',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string', isRequired: true },
      { name: 'setValue', type: 'value', description: 'Literal written to setToName.' },
    ],
  },
  copyValue: {
    name: 'copyvalue',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string', isRequired: true },
      { name: 'fromName', type: 'string', isRequired: true },
    ],
  },
  runExpression: {
    name: 'runexpression',
    parent: 'trigger',
    properties: [
      { name: 'setToName', type: 'string' },
      { name: 'runExpression', type: 'string', isRequired: true },
    ],
  },
  complete: { name: 'complete', parent: 'trigger' },
  skip: {
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
  },
};

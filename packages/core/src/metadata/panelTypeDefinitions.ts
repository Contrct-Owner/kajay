import { PANEL_SCOPE } from '../expressions/recordScopes.js';
import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface PanelTypeDefinitions {
  readonly panelDynamic: ClassMetadataDefinition;
}

/**
 * Authoritative metadata for the repeating panel (§G).
 *
 * Its own file for the same reason the matrix family has one: §G adds surface a row at a
 * time, and the question file has already outgrown one limit.
 *
 * `templateElements` admits **page elements**, not just questions, which is what makes
 * G4's nesting a matter of authoring rather than of new code: a panel inside the template
 * groups its own children, and a matrix inside it builds its own cells.
 */
export const PANEL_TYPE_DEFINITIONS: PanelTypeDefinitions = {
  panelDynamic: {
    name: 'paneldynamic',
    recordScope: PANEL_SCOPE,
    parent: 'question',
    properties: [
      {
        name: 'minPanelCount',
        type: 'number',
        defaultValue: 1,
        description: 'Instances shown before the respondent adds any, and the floor on removal.',
      },
      { name: 'maxPanelCount', type: 'number', description: '0 means no limit.' },
      { name: 'allowAddPanel', type: 'boolean', defaultValue: true },
      { name: 'allowRemovePanel', type: 'boolean', defaultValue: true },
      { name: 'addPanelText', type: 'string',
        isLocalizable: true, defaultValue: 'Add another' },
      { name: 'removePanelText', type: 'string',
        isLocalizable: true, defaultValue: 'Remove' },
      {
        name: 'confirmDelete',
        type: 'boolean',
        description: 'Removing an instance asks first. A panel can hold a lot of typing.',
      },
      { name: 'confirmDeleteText', type: 'string',
        isLocalizable: true, defaultValue: 'Remove this one?' },
      {
        name: 'panelTitleFormat',
        type: 'string',
        isLocalizable: true,
        description: 'Instance heading template, with {0} as its number.',
      },
      {
        name: 'renderMode',
        type: 'string',
        defaultValue: 'list',
        description: 'list shows every instance; tab and progress show one at a time.',
      },
      {
        name: 'defaultPanelValue',
        type: 'json',
        description: 'Answers a new instance starts with, keyed by question name.',
      },
    ],
    childCollections: [{ property: 'templateElements', elementBaseType: 'pageelement' }],
  },
};

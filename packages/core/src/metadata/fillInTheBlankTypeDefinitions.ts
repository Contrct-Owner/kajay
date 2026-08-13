import type { ClassMetadataDefinition } from './ClassDescriptor.js';

interface FillInTheBlankTypeDefinitions {
  readonly fillInTheBlank: ClassMetadataDefinition;
}

/**
 * Metadata for the fill-in-the-blank question and the blanks it positions — checklist C13.
 *
 * Its own file, as the select and matrix families have theirs: the question file was at the
 * size limit, and a family whose two types are only ever read together is the split the
 * limit is asking for.
 */
export const FILL_IN_THE_BLANK_TYPE_DEFINITIONS: FillInTheBlankTypeDefinitions = {
  fillInTheBlank: {
    name: 'fillintheblank',
    parent: 'question',
    properties: [
      {
        name: 'template',
        type: 'string',
        isRequired: true,
        isLocalizable: true,
        description: 'Prose with [[name]] marking each blank. Translators may move a marker.',
      },
      {
        name: 'blankSize',
        type: 'number',
        description: 'Default blank width in characters. A blank size wins.',
      },
    ],
    // Real questions, as a matrix's cell columns and a dynamic panel's template elements
    // already are. A dropdown blank *is* a dropdown, so choices, remote choices,
    // carry-forward and marking arrive with it rather than being rebuilt inside an item.
    childCollections: [
      { property: 'blanks', elementBaseType: 'question', markerProperty: 'template' },
    ],
  },
};

import type { ClassMetadataDefinition } from './ClassDescriptor.js';
import { CORE_TYPE_DEFINITIONS } from './coreTypeDefinitions.js';
import { DISPLAY_TYPE_DEFINITIONS } from './displayTypeDefinitions.js';
import { FILL_IN_THE_BLANK_TYPE_DEFINITIONS } from './fillInTheBlankTypeDefinitions.js';
import { MATRIX_TYPE_DEFINITIONS } from './matrixTypeDefinitions.js';
import { MEDIA_TYPE_DEFINITIONS } from './mediaTypeDefinitions.js';
import { PANEL_TYPE_DEFINITIONS } from './panelTypeDefinitions.js';
import { QUESTION_TYPE_DEFINITIONS } from './questionTypeDefinitions.js';
import { SELECT_TYPE_DEFINITIONS } from './selectTypeDefinitions.js';
import { TRIGGER_TYPE_DEFINITIONS } from './triggerTypeDefinitions.js';
import { VALIDATOR_TYPE_DEFINITIONS } from './validatorTypeDefinitions.js';

/**
 * Every built-in class's model-free metadata, in inheritance-safe registration order.
 *
 * Both registration and direct-constructor default lookup consume this catalog. Adding
 * a family anywhere else cannot make registry-created and directly constructed models
 * disagree, because there is no second family list to update.
 */
export const BUILT_IN_TYPE_DEFINITIONS: readonly ClassMetadataDefinition[] = [
  ...Object.values(CORE_TYPE_DEFINITIONS),
  ...Object.values(TRIGGER_TYPE_DEFINITIONS),
  ...Object.values(VALIDATOR_TYPE_DEFINITIONS),
  ...Object.values(QUESTION_TYPE_DEFINITIONS),
  ...Object.values(SELECT_TYPE_DEFINITIONS),
  ...Object.values(MATRIX_TYPE_DEFINITIONS),
  ...Object.values(FILL_IN_THE_BLANK_TYPE_DEFINITIONS),
  ...Object.values(PANEL_TYPE_DEFINITIONS),
  ...Object.values(MEDIA_TYPE_DEFINITIONS),
  ...Object.values(DISPLAY_TYPE_DEFINITIONS),
];

import { CheckboxQuestion } from '../model/CheckboxQuestion.js';
import { DropdownQuestion } from '../model/DropdownQuestion.js';
import { ImagePickerQuestion } from '../model/ImagePickerQuestion.js';
import { ItemValue } from '../model/ItemValue.js';
import { RadiogroupQuestion } from '../model/RadiogroupQuestion.js';
import { RankingQuestion } from '../model/RankingQuestion.js';
import { TagboxQuestion } from '../model/TagboxQuestion.js';
import type { MetadataRegistry } from './MetadataRegistry.js';
import { SELECT_TYPE_DEFINITIONS } from './selectTypeDefinitions.js';

/** Registers choice items and every question answered by picking from them. */
export function registerSelectTypes(registry: MetadataRegistry): void {
  registry.addClass({
    ...SELECT_TYPE_DEFINITIONS.itemValue,
    create: () => new ItemValue(),
  });
  registry.addClass(SELECT_TYPE_DEFINITIONS.selectBase);
  registry.addClass(SELECT_TYPE_DEFINITIONS.multiSelectBase);
  registry.addClass({
    ...SELECT_TYPE_DEFINITIONS.radiogroup,
    create: () => new RadiogroupQuestion(),
  });
  registry.addClass({
    ...SELECT_TYPE_DEFINITIONS.dropdown,
    create: () => new DropdownQuestion(),
  });
  registry.addClass({
    ...SELECT_TYPE_DEFINITIONS.checkbox,
    create: () => new CheckboxQuestion(),
  });
  registry.addClass({
    ...SELECT_TYPE_DEFINITIONS.tagbox,
    create: () => new TagboxQuestion(),
  });
  registry.addClass({
    ...SELECT_TYPE_DEFINITIONS.imagePicker,
    create: () => new ImagePickerQuestion(),
  });
  registry.addClass({
    ...SELECT_TYPE_DEFINITIONS.ranking,
    create: () => new RankingQuestion(),
  });
}

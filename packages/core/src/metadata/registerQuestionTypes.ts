import { TextQuestion } from '../model/TextQuestion.js';
import type { MetadataRegistry } from './MetadataRegistry.js';
import { QUESTION_TYPE_DEFINITIONS } from './questionTypeDefinitions.js';

/** Registers the question base and the types that are not select questions. */
export function registerQuestionTypes(registry: MetadataRegistry): void {
  registry.addClass(QUESTION_TYPE_DEFINITIONS.question);
  registry.addClass({
    ...QUESTION_TYPE_DEFINITIONS.text,
    create: () => new TextQuestion(),
  });
}

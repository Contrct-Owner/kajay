import { BooleanQuestion } from '../model/BooleanQuestion.js';
import { CommentQuestion } from '../model/CommentQuestion.js';
import { ExpressionQuestion } from '../model/ExpressionQuestion.js';
import { MultipleTextItem } from '../model/MultipleTextItem.js';
import { MultipleTextQuestion } from '../model/MultipleTextQuestion.js';
import { RatingQuestion } from '../model/RatingQuestion.js';
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
  registry.addClass({
    ...QUESTION_TYPE_DEFINITIONS.comment,
    create: () => new CommentQuestion(),
  });
  registry.addClass({
    ...QUESTION_TYPE_DEFINITIONS.boolean,
    create: () => new BooleanQuestion(),
  });
  registry.addClass({
    ...QUESTION_TYPE_DEFINITIONS.rating,
    create: () => new RatingQuestion(),
  });
  registry.addClass({
    ...QUESTION_TYPE_DEFINITIONS.expression,
    create: () => new ExpressionQuestion(),
  });
  registry.addClass({
    ...QUESTION_TYPE_DEFINITIONS.multipleTextItem,
    create: () => new MultipleTextItem(),
  });
  registry.addClass({
    ...QUESTION_TYPE_DEFINITIONS.multipleText,
    create: () => new MultipleTextQuestion(),
  });
}

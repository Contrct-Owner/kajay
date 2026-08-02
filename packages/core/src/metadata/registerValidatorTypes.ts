import { AnswerCountValidator } from '../model/AnswerCountValidator.js';
import { EmailValidator } from '../model/EmailValidator.js';
import { ExpressionValidator } from '../model/ExpressionValidator.js';
import { NumericValidator } from '../model/NumericValidator.js';
import { RegexValidator } from '../model/RegexValidator.js';
import { TextValidator } from '../model/TextValidator.js';
import type { MetadataRegistry } from './MetadataRegistry.js';
import { VALIDATOR_TYPE_DEFINITIONS } from './validatorTypeDefinitions.js';

/** Registers the validator base and every built-in check. */
export function registerValidatorTypes(registry: MetadataRegistry): void {
  const definitions = VALIDATOR_TYPE_DEFINITIONS;
  registry.addClass(definitions.validator);
  registry.addClass({ ...definitions.numeric, create: () => new NumericValidator() });
  registry.addClass({ ...definitions.text, create: () => new TextValidator() });
  registry.addClass({ ...definitions.regex, create: () => new RegexValidator() });
  registry.addClass({ ...definitions.email, create: () => new EmailValidator() });
  registry.addClass({ ...definitions.expression, create: () => new ExpressionValidator() });
  registry.addClass({ ...definitions.answerCount, create: () => new AnswerCountValidator() });
}

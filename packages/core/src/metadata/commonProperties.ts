import type { PropertyDefinition } from './PropertyDescriptor.js';

/**
 * Declared once because several unrelated bases carry it — question, page and choice
 * item — and they must agree on its name and type or the same authored expression
 * would mean different things in different places.
 */
export const VISIBLE_IF: PropertyDefinition = { name: 'visibleIf', type: 'string' };

/**
 * Shared for the same reason, by two bases that are not related to each other: the
 * multi-select base, and ranking. A ranking is not a multi-select — its answer is an
 * order, not a set — but "how many choices may be in the answer at once" is the same
 * question with the same units, and an author who learned it on a checkbox should not
 * find it spelled differently on a ranking.
 */
export const MAX_SELECTED_CHOICES: PropertyDefinition = {
  name: 'maxSelectedChoices',
  type: 'number',
  description: '0 means no limit.',
};

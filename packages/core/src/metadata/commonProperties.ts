import type { PropertyDefinition } from './PropertyDescriptor.js';

/**
 * Declared once because several unrelated bases carry it — question, page and choice
 * item — and they must agree on its name and type or the same authored expression
 * would mean different things in different places.
 */
export const VISIBLE_IF: PropertyDefinition = { name: 'visibleIf', type: 'string' };

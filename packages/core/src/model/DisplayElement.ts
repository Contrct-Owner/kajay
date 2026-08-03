import { PageElement } from './PageElement.js';

/**
 * A page element that shows something and holds no answer.
 *
 * Its own base rather than a `Question` with the answer parts unused, because the
 * registry is what the Creator's property grid is generated from: parenting `html`
 * under `question` would offer an author `isRequired`, `requiredIf` and a `validators`
 * collection on a paragraph of text. Being inert at runtime is not the same as being
 * honest about what is authorable.
 *
 * Nothing else has to change to accommodate them. `collectQuestions` walks for
 * `Question`s, so a display element never reaches `data`, the value resolver or
 * validation — not by a check that remembers to skip it, but because it was never in
 * the set.
 */
export abstract class DisplayElement extends PageElement {}

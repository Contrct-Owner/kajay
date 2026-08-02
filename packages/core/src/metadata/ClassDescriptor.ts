import type { SurveyElement } from '../model/SurveyElement.js';
import type { PropertyDefinition, PropertyDescriptor } from './PropertyDescriptor.js';

/**
 * Declares that a class holds a collection of child elements under a JSON property.
 *
 * This is what keeps the serializer and the schema generator registry-driven rather
 * than hard-coding "a survey has pages, a page has elements". A custom container type
 * registered later gets the same treatment for free.
 */
export interface ChildCollectionDescriptor {
  /** JSON property holding the children, e.g. `pages`. */
  readonly property: string;
  /**
   * Type assumed for a child that omits `type`, and the base whose concrete
   * subclasses are legal here.
   */
  readonly elementBaseType: string;
}

/** Input form of a class registration. */
export interface ClassDefinition {
  readonly name: string;
  readonly parent?: string;
  readonly properties?: readonly PropertyDefinition[];
  /**
   * Child collections, in the order they serialize.
   *
   * A list rather than a single collection because one class genuinely holds several:
   * a survey has both `pages` and `calculatedValues`, and the matrix family will hold
   * `columns` and `rows`. Special-casing any of them in the serializer would put
   * per-type knowledge back where the registry is supposed to be the only source.
   */
  readonly childCollections?: readonly ChildCollectionDescriptor[];
  /** Abstract classes contribute inherited properties but cannot be instantiated. */
  readonly isAbstract?: boolean;
  readonly create?: () => SurveyElement;
}

/** Stored form of a class registration. */
export interface ClassDescriptor {
  readonly name: string;
  readonly parent: string | undefined;
  readonly properties: readonly PropertyDescriptor[];
  readonly childCollections: readonly ChildCollectionDescriptor[];
  readonly isAbstract: boolean;
  readonly create: (() => SurveyElement) | undefined;
}

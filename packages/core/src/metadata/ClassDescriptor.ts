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
  readonly childCollection?: ChildCollectionDescriptor;
  /** Abstract classes contribute inherited properties but cannot be instantiated. */
  readonly isAbstract?: boolean;
  readonly create?: () => SurveyElement;
}

/** Stored form of a class registration. */
export interface ClassDescriptor {
  readonly name: string;
  readonly parent: string | undefined;
  readonly properties: readonly PropertyDescriptor[];
  readonly childCollection: ChildCollectionDescriptor | undefined;
  readonly isAbstract: boolean;
  readonly create: (() => SurveyElement) | undefined;
}

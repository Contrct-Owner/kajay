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
  /**
   * Property a bare scalar is read into, when the collection accepts a shorthand.
   *
   * `choices: ["a", "b"]` is how anyone actually writes a choice list, and it means
   * `[{ value: "a" }, { value: "b" }]`. The expansion happens on the way in, so the
   * canonical form has one shape — which is exactly the case ADR-0002 cites for why
   * the round-trip bar is a fixed point rather than byte stability.
   */
  readonly shorthandProperty?: string;
  /**
   * The owner's property whose `[[name]]` markers position these children — ADR-0048.
   *
   * `template` for a sentence's blanks, and nothing at all for every other collection: a
   * choice list has an order, a blanks list has *places in prose*. One fact, because a
   * collection positioned this way says four things at once — the children have to be
   * drawable in a line, a new one has to be given a place or nobody sees it, a removed
   * one's marker has to go with it, and a renamed one's marker has to follow. All four
   * used to be nobody's, so ordinary editing produced definitions the parser rejects.
   *
   * Declared rather than derived from the type name, so the Creator asks the registry the
   * question instead of asking "is this the blanks of a fill-in-the-blank" — which is the
   * per-type knowledge the collection editor exists not to hold.
   */
  readonly markerProperty?: string;
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
  /**
   * Whether this type may sit *inside* a line of prose — checklist C13, ADR-0048.
   *
   * Declared here rather than kept in a list somewhere, so a host's own type can opt in
   * and so the answer comes from the registry the day a type is added rather than from
   * whoever remembered to update the list. Core owns it because the definition
   * diagnostics and both runtimes read it, and none of them may touch a DOM.
   *
   * Off by default, deliberately: a type that has never considered the question cannot
   * be drawn in a sentence, and refusing it is the safe answer.
   */
  readonly allowsInline?: boolean;
  readonly create?: () => SurveyElement;
}

/**
 * A class's authoritative metadata without its model-construction factory.
 * Property and child-collection order remains the canonical serialization order.
 */
export type ClassMetadataDefinition = Omit<ClassDefinition, 'create'>;

/** Stored form of a class registration. */
export interface ClassDescriptor {
  readonly name: string;
  readonly parent: string | undefined;
  readonly properties: readonly PropertyDescriptor[];
  readonly childCollections: readonly ChildCollectionDescriptor[];
  readonly isAbstract: boolean;
  /** Whether this type may sit inside a line of prose. See {@link ClassDefinition}. */
  readonly allowsInline: boolean;
  readonly create: (() => SurveyElement) | undefined;
}

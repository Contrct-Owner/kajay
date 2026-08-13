import type { SurveyElement } from '../model/SurveyElement.js';
import type { ChildCollectionDescriptor, ClassDefinition, ClassDescriptor } from './ClassDescriptor.js';
import type { PropertyDefinition, PropertyDescriptor } from './PropertyDescriptor.js';
import { normalizePropertyDefinition } from './PropertyDescriptor.js';
import { attachPropertyDefaults } from './PropertyDefaults.js';

/**
 * The load-bearing wall: every question type, its typed property descriptors, and its
 * child structure live here. The serializer, the JSON Schema contract, and later the
 * property grid all introspect this rather than hard-coding per-type knowledge.
 *
 * Instances are independent, which is what lets a test build a private registry
 * instead of mutating the process-global one.
 */
export class MetadataRegistry {
  readonly #classes: Map<string, ClassDescriptor> = new Map();

  addClass(definition: ClassDefinition): void {
    if (this.#classes.has(definition.name)) {
      throw new Error(`Class "${definition.name}" is already registered.`);
    }
    if (definition.parent !== undefined && !this.#classes.has(definition.parent)) {
      throw new Error(
        `Class "${definition.name}" declares parent "${definition.parent}", which is not registered.`,
      );
    }
    this.#classes.set(definition.name, {
      name: definition.name,
      parent: definition.parent,
      properties: (definition.properties ?? []).map((property) =>
        normalizePropertyDefinition(property),
      ),
      childCollections: definition.childCollections ?? [],
      isAbstract: definition.isAbstract ?? false,
      allowsInline: definition.allowsInline ?? false,
      ...(definition.recordScope === undefined ? {} : { recordScope: definition.recordScope }),
      create: definition.create,
    });
  }

  /**
   * Removes a registration. Exists for test teardown: the global registry is
   * process-wide, so a test that registers a type must be able to undo it.
   */
  removeClass(name: string): void {
    this.#classes.delete(name);
  }

  hasClass(name: string): boolean {
    return this.#classes.has(name);
  }

  getClass(name: string): ClassDescriptor | undefined {
    return this.#classes.get(name);
  }

  /** Registered class names, sorted, so generated artefacts are order-stable. */
  getClassNames(): readonly string[] {
    return Array.from(this.#classes.keys()).toSorted();
  }

  /**
   * The `addProperty` extension seam: injects a property into an already-registered
   * class. The serializer and contract pick it up with no further wiring.
   */
  addProperty(className: string, property: PropertyDefinition): void {
    const descriptor = this.#classes.get(className);
    if (descriptor === undefined) {
      throw new Error(`Cannot add property "${property.name}": class "${className}" is not registered.`);
    }
    if (descriptor.properties.some((existing) => existing.name === property.name)) {
      throw new Error(`Class "${className}" already declares property "${property.name}".`);
    }
    this.#classes.set(className, {
      ...descriptor,
      properties: [...descriptor.properties, normalizePropertyDefinition(property)],
    });
  }

  /**
   * Own and inherited properties, ancestors first, in declaration order. A subclass
   * redeclaring an inherited name replaces it **in place**, so the order a definition
   * serializes in never depends on the inheritance depth it was declared at.
   */
  getProperties(className: string): readonly PropertyDescriptor[] {
    const descriptor = this.#classes.get(className);
    if (descriptor === undefined) {
      return [];
    }
    const inherited =
      descriptor.parent === undefined ? [] : [...this.getProperties(descriptor.parent)];
    for (const property of descriptor.properties) {
      const index = inherited.findIndex((existing) => existing.name === property.name);
      if (index === -1) {
        inherited.push(property);
      } else {
        inherited[index] = property;
      }
    }
    return inherited;
  }

  /** Own and inherited child collections, ancestors first. */
  getChildCollections(className: string): readonly ChildCollectionDescriptor[] {
    const descriptor = this.#classes.get(className);
    if (descriptor === undefined) {
      return [];
    }
    const inherited =
      descriptor.parent === undefined ? [] : this.getChildCollections(descriptor.parent);
    return [...inherited, ...descriptor.childCollections];
  }

  /** The collection stored under a given JSON property, if the class declares one. */
  getChildCollection(className: string, property: string): ChildCollectionDescriptor | undefined {
    return this.getChildCollections(className).find(
      (collection) => collection.property === property,
    );
  }

  isSubclassOf(className: string, ancestorName: string): boolean {
    let current: string | undefined = className;
    while (current !== undefined) {
      if (current === ancestorName) {
        return true;
      }
      current = this.#classes.get(current)?.parent;
    }
    return false;
  }

  /** Instantiable classes descending from `baseName`, sorted for stable output. */
  getConcreteSubclasses(baseName: string): readonly string[] {
    return this.getClassNames().filter(
      (name) => !(this.#classes.get(name)?.isAbstract ?? true) && this.isSubclassOf(name, baseName),
    );
  }

  createInstance(className: string): SurveyElement {
    const descriptor = this.#classes.get(className);
    if (descriptor === undefined) {
      throw new Error(`Cannot create "${className}": no such registered class.`);
    }
    if (descriptor.create === undefined) {
      throw new Error(`Cannot create "${className}": it is abstract or has no factory.`);
    }
    const instance = descriptor.create();
    attachPropertyDefaults(instance, this.getProperties(className));
    return instance;
  }
}

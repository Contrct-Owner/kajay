import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import type { SurveyElement } from './SurveyElement.js';

/**
 * A deep copy of an element, made through the registry rather than by hand.
 *
 * A matrix column is authored once and asked of every row, and each of those cells needs
 * its own answer, its own errors and its own visibility — so each is a real question
 * instance built from the column as a template. That is what lets every existing
 * question type, validator and renderer work inside a cell without any of them knowing
 * a matrix exists.
 *
 * Registry-driven, so a type gains copyability by being registered and nothing has to
 * be added here when one arrives. Unknown properties come too: ADR-0002 rule 3 says we
 * carry what we do not understand, and a cell that dropped them would answer
 * differently from the column it came from.
 *
 * Computed state is deliberately not copied — visibility and enablement are derived
 * from rules, and the copy's own rules will set them.
 */
export function copyElement(element: SurveyElement, registry: MetadataRegistry): SurveyElement {
  const copy = registry.createInstance(element.type);
  // The same locale holder, not a fresh one: a cell built from a column reads the
  // survey's language, and a copy with a scope of its own would sit in a French survey
  // rendering its titles in the default (J1).
  copy.setLocaleScope(element.localeScope);
  for (const descriptor of registry.getProperties(element.type)) {
    const value = element.getPropertyValue(descriptor.name);
    if (value !== undefined) {
      copy.setPropertyValue(descriptor.name, value);
    }
  }
  for (const [name, value] of element.getUnknownProperties()) {
    copy.setUnknownProperty(name, value);
  }
  for (const collection of registry.getChildCollections(element.type)) {
    for (const child of element.getChildren(collection.property)) {
      copy.addChild(collection.property, copyElement(child, registry));
    }
  }
  return copy;
}

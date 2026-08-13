import type { MetadataRegistry } from '../metadata/MetadataRegistry.js';
import type { HostValues } from '../model/hostValues.js';
import type { LocaleScope } from '../model/localizedText.js';
import type { Diagnostic } from './Diagnostic.js';

/**
 * What every reader in one parse shares.
 *
 * Its own file because more than one reader takes it — the element, the property and
 * the children readers all do — and a type that several modules need should not live
 * inside whichever of them happened to be written first.
 */
export interface ReadContext {
  readonly registry: MetadataRegistry;
  readonly diagnostics: Diagnostic[];
  /**
   * The one locale holder every element in this survey shares — checklist J1.
   *
   * Handed out here rather than walked in afterwards because this is the only place
   * that sees *every* element: choices, validators, matrix columns and multiple-text
   * items are all created down this path, and a walk would have to know about each
   * collection separately and be wrong about the next one.
   */
  readonly locale: LocaleScope;
  /**
   * The host values in force, so an expression naming one the host never supplied is
   * reported where it is read — with the property and the JSON Pointer already in hand,
   * which a walk over the finished tree would have to reconstruct.
   */
  readonly values: HostValues;
}

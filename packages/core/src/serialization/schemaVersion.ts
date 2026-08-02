/** Major version of the definition format. Matches the trailing integer of SCHEMA_ID. */
export const CURRENT_SCHEMA_VERSION: number = 1;

/**
 * Stable identifier for the contract (ADR-0011). A URN, not a URL: `$id` is an
 * identifier, and it must never change once anything pins it.
 */
export const SCHEMA_ID: string = 'urn:kajay:survey-definition:1';

/**
 * Raised when a definition declares a format version this build cannot handle.
 *
 * Refusing beats best-effort parsing: a definition written against a different format
 * would otherwise fail later, somewhere less obvious, having silently dropped whatever
 * it is that changed.
 */
export class UnsupportedSchemaVersionError extends Error {
  readonly found: number;
  readonly supported: number;

  constructor(found: number) {
    super(
      `Definition declares schemaVersion ${found}, but this build supports ` +
        `${CURRENT_SCHEMA_VERSION}. Refusing to parse rather than guessing.`,
    );
    this.name = 'UnsupportedSchemaVersionError';
    this.found = found;
    this.supported = CURRENT_SCHEMA_VERSION;
  }
}

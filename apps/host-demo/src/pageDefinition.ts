/**
 * A page as a host authors it: plain JSON, not a model type.
 *
 * The demo's whole point is to go through the public parsing seam, so these stay
 * untyped records rather than borrowing model classes — anything stronger here would
 * be the demo checking its own homework instead of the library's.
 */
export type PageDefinition = Readonly<Record<string, unknown>>;

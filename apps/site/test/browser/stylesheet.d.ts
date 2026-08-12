/**
 * A side-effect stylesheet import, for the one browser test that loads one.
 *
 * `@kajay/themes` publishes `./styles.css` as a real file rather than a module, so there is
 * nothing for TypeScript to resolve types *from* — the bundler understands the import and
 * the compiler needs telling that it is allowed to. Declared here, beside the only test
 * that does it, rather than repo-wide: the stylesheet is deliberately absent from every
 * other test, and a global declaration would quietly make importing one look ordinary.
 */
declare module '*.css';

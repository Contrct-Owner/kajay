function pagePath(slug) {
  return slug === '' ? '/docs' : `/docs/${slug}`;
}

function generatedReferencePaths(manifest) {
  const paths = new Set([
    '/docs/reference',
    '/docs/reference/definition-types',
    '/docs/reference/properties',
    '/docs/reference/expression-language',
    '/docs/reference/diagnostics',
    '/docs/reference/api',
  ]);
  for (const item of [
    ...manifest.definitionTypes,
    ...manifest.definitionProperties,
    ...manifest.apiSymbols,
  ]) {
    paths.add(item.url.split('#')[0]);
  }
  for (const apiPackage of new Set(manifest.apiSymbols.map(({ packageName }) => packageName))) {
    paths.add(`/docs/reference/api/${apiPackage.replace('@kajay/', '')}`);
  }
  return paths;
}

/** Checks authored routes against the generated reference registry without importing React. */
export function validatePageCatalog(pages, manifest) {
  const errors = [];
  const generated = generatedReferencePaths(manifest);
  for (const page of pages) {
    const path = pagePath(page.slug);
    if (generated.has(path)) {
      errors.push(`${page.source}: authored path ${path} is owned by generated reference.`);
    }
  }
  return errors;
}

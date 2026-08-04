const SECTIONS = new Set([
  'Start',
  'Quickstart',
  'Surveys',
  'Integration',
  'Creator',
  'Customize',
  'Customization',
  'Reference',
  'Help',
]);
const STATUSES = new Set(['preview', 'stable']);
const AUDIENCES = new Set(['consumer', 'extension', 'advanced']);
const SDKS = new Set(['neutral', 'typescript']);
const FRAMEWORKS = new Set(['neutral', 'react']);
const SLUG = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/u;
const ANCHOR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function requireText(page, name, errors) {
  const value = page[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${page.source}: ${name} must be a non-empty string.`);
  }
}

function requireMember(page, name, values, errors) {
  if (!values.has(page[name])) {
    errors.push(`${page.source}: ${name} ${JSON.stringify(page[name])} is not supported.`);
  }
}

function validateToc(page, errors) {
  const seen = new Set();
  for (const item of page.toc) {
    if (typeof item.id !== 'string' || !ANCHOR.test(item.id)) {
      errors.push(`${page.source}: heading anchor ${JSON.stringify(item.id)} is not canonical.`);
    } else if (seen.has(item.id)) {
      errors.push(`${page.source}: heading anchor ${JSON.stringify(item.id)} is duplicated.`);
    }
    seen.add(item.id);
    if (typeof item.label !== 'string' || item.label.trim().length === 0) {
      errors.push(`${page.source}: heading ${JSON.stringify(item.id)} has no label.`);
    }
    if (item.depth !== 2 && item.depth !== 3) {
      errors.push(`${page.source}: heading ${JSON.stringify(item.id)} has invalid depth ${item.depth}.`);
    }
  }
}

/** Returns every registry violation so an author can fix the whole page in one pass. */
export function validatePageRegistry(pages) {
  const errors = [];
  const paths = new Map();
  for (const page of pages) {
    requireText(page, 'title', errors);
    requireText(page, 'description', errors);
    requireMember(page, 'section', SECTIONS, errors);
    requireMember(page, 'status', STATUSES, errors);
    requireMember(page, 'audience', AUDIENCES, errors);
    requireMember(page, 'sdk', SDKS, errors);
    requireMember(page, 'framework', FRAMEWORKS, errors);

    const validSlug = page.slug === '' || (typeof page.slug === 'string' && SLUG.test(page.slug));
    if (!validSlug) errors.push(`${page.source}: slug ${JSON.stringify(page.slug)} is not canonical.`);
    const path = page.slug === '' ? '/docs' : `/docs/${page.slug}`;
    const previous = paths.get(path);
    if (previous !== undefined) errors.push(`${page.source}: path ${path} is already owned by ${previous}.`);
    paths.set(path, page.source);
    validateToc(page, errors);
  }

  const slugs = new Set(pages.map(({ slug }) => slug));
  for (const page of pages) {
    for (const target of page.related) {
      if (!slugs.has(target)) errors.push(`${page.source}: related page ${JSON.stringify(target)} does not exist.`);
    }
  }
  return errors;
}

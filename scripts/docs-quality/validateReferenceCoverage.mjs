function key(packageName, name) {
  return `${packageName}:${name}`;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateKnownDefinitionNames(types, properties, metadata) {
  const errors = [];
  const sourceTypeNames = new Set(metadata.classes.map(({ name }) => name));
  const sourcePropertyNames = new Set(
    metadata.classes.flatMap(({ declaredProperties }) => declaredProperties.map(({ name }) => name)),
  );
  for (const name of types.keys()) {
    if (!sourceTypeNames.has(name)) errors.push(`Reference contains unknown definition type ${name}.`);
  }
  for (const name of properties.keys()) {
    if (!sourcePropertyNames.has(name)) errors.push(`Reference contains unknown definition property ${name}.`);
  }
  return errors;
}

function validateDefinitions(manifest, metadata) {
  const types = new Map(manifest.definitionTypes.map((item) => [item.name, item]));
  const properties = new Map(manifest.definitionProperties.map((item) => [item.name, item]));
  const errors = validateKnownDefinitionNames(types, properties, metadata);

  for (const sourceType of metadata.classes) {
    const documented = types.get(sourceType.name);
    if (documented === undefined) {
      errors.push(`Definition type ${sourceType.name} is absent from reference.`);
      continue;
    }
    if (documented.parent !== sourceType.parent || documented.isAbstract !== sourceType.isAbstract) {
      errors.push(`Definition type ${sourceType.name} changed parent or abstract status in reference.`);
    }
    if (documented.description !== null || !documented.gaps.includes('description')) {
      errors.push(`Definition type ${sourceType.name} must expose its missing description as a gap.`);
    }
    for (const collection of sourceType.declaredChildCollections) {
      const found = documented.childCollections.some((item) =>
        item.property === collection.property
        && item.elementBaseType === collection.elementBaseType
        && item.shorthandProperty === collection.shorthandProperty
        && item.declaredBy === sourceType.name);
      if (!found) errors.push(`Child collection ${sourceType.name}.${collection.property} is absent from reference.`);
    }
    for (const sourceProperty of sourceType.declaredProperties) {
      const reference = properties.get(sourceProperty.name);
      const occurrence = reference?.occurrences.find(({ declaredBy }) => declaredBy === sourceType.name);
      const sourceFacts = Object.fromEntries(
        Object.entries(sourceProperty).filter(([name]) => name !== 'name'),
      );
      if (occurrence === undefined) {
        errors.push(`Definition property ${sourceType.name}.${sourceProperty.name} is absent from reference.`);
      } else if (!sameValue(occurrence, { declaredBy: sourceType.name, ...sourceFacts })) {
        errors.push(`Definition property ${sourceType.name}.${sourceProperty.name} drifted from metadata.`);
      }
    }
  }
  return errors;
}

function validateRuntimeValues(manifest, publicRuntimeSurface) {
  const errors = [];
  const apiValues = new Map(
    manifest.apiSymbols
      .filter(({ exportKind }) => exportKind === 'value')
      .map((item) => [key(item.packageName, item.name), item]),
  );
  const runtimeKeys = new Set(
    Object.entries(publicRuntimeSurface).flatMap(([packageName, names]) =>
      names.map((name) => key(packageName, name))),
  );
  for (const valueKey of apiValues.keys()) {
    if (!runtimeKeys.has(valueKey)) errors.push(`API reference contains unknown runtime value ${valueKey}.`);
  }
  for (const [packageName, names] of Object.entries(publicRuntimeSurface)) {
    for (const name of names) {
      const item = apiValues.get(key(packageName, name));
      if (item === undefined) errors.push(`Runtime value ${packageName}:${name} is absent from API reference.`);
      else if (item.classification === 'unclassified') {
        errors.push(`Runtime value ${packageName}:${name} has no audience classification.`);
      }
    }
  }
  return errors;
}

function validateUniqueUrls(manifest) {
  const errors = [];
  const urls = new Map();
  const referenceItems = [
    ...manifest.definitionTypes,
    ...manifest.definitionProperties,
    ...(manifest.diagnostics ?? []),
    ...(manifest.expressionOperators ?? []),
    ...(manifest.expressionFunctions ?? []),
    ...manifest.apiSymbols,
  ];
  for (const item of referenceItems) {
    if (typeof item.url !== 'string') continue;
    const owner = urls.get(item.url);
    if (owner !== undefined) errors.push(`Reference URL ${item.url} is shared by ${owner} and ${item.name ?? item.code}.`);
    urls.set(item.url, item.name ?? item.code);
  }
  return errors;
}

/** Ensures generated reference is complete while preserving gaps as gaps. */
export function validateReferenceCoverage({ manifest, metadata, publicRuntimeSurface }) {
  return [
    ...validateDefinitions(manifest, metadata),
    ...validateRuntimeValues(manifest, publicRuntimeSurface),
    ...validateUniqueUrls(manifest),
  ];
}

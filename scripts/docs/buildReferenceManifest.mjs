import {
  expressionFunctions,
  expressionOperators,
  packageExports,
  runtimeClassifications,
} from './sourceFacts.mjs';

const OPERATOR_SLUGS = Object.freeze({
  'binary:or': 'or',
  'binary:and': 'and',
  'binary:==': 'equal',
  'binary:!=': 'not-equal',
  'binary:>': 'greater-than',
  'binary:>=': 'greater-than-or-equal',
  'binary:<': 'less-than',
  'binary:<=': 'less-than-or-equal',
  'binary:contains': 'contains',
  'binary:notcontains': 'not-contains',
  'binary:anyof': 'any-of',
  'binary:allof': 'all-of',
  'binary:+': 'add',
  'binary:-': 'subtract',
  'binary:*': 'multiply',
  'binary:/': 'divide',
  'binary:%': 'remainder',
  'binary:^': 'power',
  'unary:not': 'not',
  'unary:-': 'negate',
  'postfix:empty': 'empty',
  'postfix:notempty': 'not-empty',
});

function slug(value) {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .toLocaleLowerCase('en-US')
    .replace(/^@kajay\//u, '')
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');
}

function classMap(metadata) {
  return new Map(metadata.classes.map((item) => [item.name, item]));
}

function lineage(item, classes) {
  const result = [];
  let current = item;
  const seen = new Set();
  while (current !== undefined && !seen.has(current.name)) {
    result.unshift(current);
    seen.add(current.name);
    current = current.parent === null ? undefined : classes.get(current.parent);
  }
  return result;
}

function definitionCategory(item, classes) {
  const names = new Set(lineage(item, classes).map(({ name }) => name));
  if (item.name === 'survey') return 'survey';
  if (item.name === 'page') return 'page';
  if (names.has('question')) return 'question';
  if (names.has('validator')) return 'validator';
  if (names.has('trigger')) return 'trigger';
  if (names.has('pageelement')) return 'element';
  return 'supporting';
}

function effectiveProperties(item, classes) {
  const properties = new Map();
  for (const owner of lineage(item, classes)) {
    for (const property of owner.declaredProperties) {
      properties.set(property.name, { name: property.name, declaredBy: owner.name });
    }
  }
  return [...properties.values()];
}

function effectiveCollections(item, classes) {
  const collections = new Map();
  for (const owner of lineage(item, classes)) {
    for (const collection of owner.declaredChildCollections) {
      collections.set(collection.property, { ...collection, declaredBy: owner.name });
    }
  }
  return [...collections.values()];
}

function definitionTypes(metadata) {
  const classes = classMap(metadata);
  return metadata.classes.map((item) => ({
    name: item.name,
    url: `/docs/reference/definition-types/${slug(item.name)}`,
    category: definitionCategory(item, classes),
    parent: item.parent,
    isAbstract: item.isAbstract,
    description: null,
    declaredProperties: item.declaredProperties.map(({ name }) => name),
    effectiveProperties: effectiveProperties(item, classes),
    childCollections: effectiveCollections(item, classes),
    gaps: ['description'],
  }));
}

function propertyOccurrences(metadata) {
  const result = new Map();
  for (const owner of metadata.classes) {
    for (const property of owner.declaredProperties) {
      const existing = result.get(property.name) ?? [];
      existing.push({
        declaredBy: owner.name,
        type: property.type,
        defaultValue: property.defaultValue,
        isRequired: property.isRequired,
        isExpression: property.isExpression,
        isLocalizable: property.isLocalizable,
        visibleIf: property.visibleIf,
        readOnlyIf: property.readOnlyIf,
        description: property.description,
      });
      result.set(property.name, existing);
    }
  }
  return result;
}

function definitionProperties(metadata, types) {
  const occurrences = propertyOccurrences(metadata);
  return [...occurrences.entries()].map(([name, records]) => {
    const availableOn = types
      .filter((item) => item.effectiveProperties.some((property) => property.name === name))
      .map((item) => item.name);
    return {
      name,
      url: `/docs/reference/properties/${slug(name)}`,
      declaredBy: records.map(({ declaredBy }) => declaredBy),
      availableOn,
      occurrences: records,
      gaps: records.some(({ description }) => description !== null) ? [] : ['description'],
    };
  }).toSorted((left, right) => left.name.localeCompare(right.name));
}

function diagnostics(contract) {
  const records = [];
  for (const item of contract.definitionDiagnostics) {
    records.push({ ...item, category: 'definition', phase: null, extensible: false });
  }
  for (const item of contract.expressionErrors) {
    records.push({ ...item, category: 'expression', severity: null, extensible: false });
  }
  for (const item of contract.dependencyErrors) {
    records.push({ ...item, category: 'dependency', severity: null, phase: null, extensible: false });
  }
  for (const item of contract.surveyErrors.builtInKinds) {
    records.push({ code: item.kind, description: item.description, category: 'survey', severity: null, phase: null, extensible: contract.surveyErrors.extensible });
  }
  return records.map((item) => ({
    code: item.code,
    category: item.category,
    severity: item.severity,
    phase: item.phase,
    description: item.description,
    extensible: item.extensible,
    url: `/docs/reference/diagnostics#${item.category}-${slug(item.code)}`,
    gaps: [],
  }));
}

function operatorReferences(source) {
  return expressionOperators(source).map((item) => {
    const operatorSlug = OPERATOR_SLUGS[`${item.kind}:${item.name}`];
    if (operatorSlug === undefined) {
      throw new Error(`Expression operator ${item.kind}:${item.name} needs a stable URL slug.`);
    }
    return {
      name: item.name,
      kind: item.kind,
      spellings: item.spellings,
      precedence: item.precedence,
      associativity: item.associativity,
      url: `/docs/reference/expression-language#operator-${operatorSlug}`,
      description: null,
      gaps: ['description'],
    };
  });
}

function functionReferences(source) {
  return expressionFunctions(source).map((item) => ({
    name: item.name,
    category: item.category,
    url: `/docs/reference/expression-language#function-${slug(item.name)}`,
    description: null,
    signature: null,
    gaps: ['description', 'signature'],
  }));
}

function apiSymbolFacts(inputs) {
  const classifications = runtimeClassifications(inputs.publicInterfaceLedger);
  return Object.entries(inputs.packageIndexSources).flatMap(([packageName, source]) =>
    packageExports(source).map((item) => {
      const classification = classifications.get(`${packageName}:${item.name}`) ?? 'unclassified';
      const gaps = ['description', 'signature'];
      if (classification === 'unclassified') gaps.unshift('classification');
      return {
        packageName,
        name: item.name,
        exportKind: item.exportKind,
        classification,
        description: null,
        signature: null,
        gaps,
      };
    }),
  );
}

function apiSymbolUrl(item, collisions) {
  const base = `/docs/reference/api/${slug(item.packageName)}/${slug(item.name)}`;
  return collisions.length === 1 || item.exportKind === 'value'
    ? base
    : `${base}-${item.exportKind}`;
}

function apiSymbols(inputs) {
  const facts = apiSymbolFacts(inputs);
  const result = facts.map((item) => {
    const collisions = facts.filter((candidate) =>
      candidate.packageName === item.packageName && slug(candidate.name) === slug(item.name));
    return Object.assign({}, item, { url: apiSymbolUrl(item, collisions) });
  }).toSorted((left, right) =>
    left.packageName.localeCompare(right.packageName) || left.name.localeCompare(right.name));
  const urls = new Set();
  for (const item of result) {
    if (urls.has(item.url)) {
      throw new Error(`API URL ${item.url} needs another explicit export-kind suffix.`);
    }
    urls.add(item.url);
  }
  return result;
}

function assertSources(inputs, types, api) {
  if (inputs.schema.$id !== inputs.metadata.definitionSchemaId) {
    throw new Error('Survey Schema and runtime metadata disagree on their definition schema ID.');
  }
  for (const item of types) {
    if (inputs.schema.$defs[item.name] === undefined) {
      throw new Error(`Survey Schema has no definition for metadata type ${item.name}.`);
    }
  }
  for (const [packageName, names] of Object.entries(inputs.publicRuntimeSurface)) {
    for (const name of names) {
      const item = api.find((candidate) => candidate.packageName === packageName && candidate.name === name);
      if (item === undefined || item.exportKind !== 'value' || item.classification === 'unclassified') {
        throw new Error(`Runtime API ${packageName}:${name} lacks a classified value export.`);
      }
    }
  }
  for (const item of api.filter(({ exportKind }) => exportKind === 'value')) {
    const runtimeNames = inputs.publicRuntimeSurface[item.packageName] ?? [];
    if (!runtimeNames.includes(item.name)) {
      throw new Error(`Value export ${item.packageName}:${item.name} is absent from the runtime manifest.`);
    }
  }
}

/** Produces the deterministic, browser-consumable projection of authoritative contracts. */
export function buildReferenceManifest(inputs) {
  const types = definitionTypes(inputs.metadata);
  const api = apiSymbols(inputs);
  assertSources(inputs, types, api);
  return {
    manifestVersion: 1,
    sources: {
      runtimeMetadataContractVersion: inputs.metadata.contractVersion,
      runtimeDiagnosticContractVersion: inputs.diagnostics.contractVersion,
      definitionSchemaId: inputs.metadata.definitionSchemaId,
      definitionSchemaVersion: inputs.metadata.definitionSchemaVersion,
      expressionConformanceVersion: inputs.expressionConformance.contractVersion,
    },
    definitionTypes: types,
    definitionProperties: definitionProperties(inputs.metadata, types),
    diagnostics: diagnostics(inputs.diagnostics),
    expressionOperators: operatorReferences(inputs.operatorSource),
    expressionFunctions: functionReferences(inputs.functionSource),
    apiSymbols: api,
  };
}

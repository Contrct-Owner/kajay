import type { ReactNode } from 'react';
import type { DocPageAudience, DocPageDefinition, DocPageSdk } from '../docs-shell';
import {
  docsReferenceManifest,
  type ApiSymbolReference,
  type DefinitionPropertyReference,
  type DefinitionTypeReference,
  type DocsReferenceManifest,
} from '../docs-reference';
import { ApiIndexContent } from './ApiIndexContent';
import { ApiSymbolContent } from './ApiSymbolContent';
import { DefinitionPropertyContent } from './DefinitionPropertyContent';
import { DefinitionTypeContent } from './DefinitionTypeContent';
import { DiagnosticsContent } from './DiagnosticsContent';
import { ExpressionLanguageContent } from './ExpressionLanguageContent';
import { ReferenceCatalogContent } from './ReferenceCatalogContent';
import { ReferenceHomeContent } from './ReferenceHomeContent';

export interface ReferencePageRegistry {
  readonly navigationPages: readonly DocPageDefinition[];
  readonly resolve: (slug: string) => DocPageDefinition | undefined;
}

export interface ReferencePageExtensions {
  readonly expressionLanguageOverview?: ReactNode;
  readonly expressionLanguageEvaluator?: ReactNode;
}

interface PageOptions {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly section?: string;
  readonly audience?: DocPageAudience;
  readonly sdk?: DocPageSdk;
  readonly framework?: 'neutral' | 'react';
  readonly toc: readonly { readonly id: string; readonly label: string; readonly depth: 2 | 3 }[];
  readonly content: ReactNode;
}

function page(options: PageOptions): DocPageDefinition {
  return {
    slug: options.slug,
    title: options.title,
    description: options.description,
    section: options.section ?? 'Reference',
    status: 'preview',
    audience: options.audience ?? 'consumer',
    sdk: options.sdk ?? 'neutral',
    framework: options.framework ?? 'neutral',
    toc: options.toc,
    content: options.content,
  };
}

function navigationPages(
  manifest: DocsReferenceManifest,
  extensions: ReferencePageExtensions,
): readonly DocPageDefinition[] {
  return [
    page({ slug: 'reference', title: 'Reference', description: 'Generated facts for Kajay definitions, expressions, diagnostics, and public APIs.', toc: [{ id: 'reference-sources', label: 'Generated sources', depth: 2 }, { id: 'reference-catalogs', label: 'Browse reference', depth: 2 }, { id: 'reference-version', label: 'Compatibility', depth: 2 }], content: <ReferenceHomeContent manifest={manifest} /> }),
    definitionTypesIndex(manifest),
    propertiesIndex(manifest),
    expressionLanguagePage(manifest, extensions),
    diagnosticsPage(manifest),
    apiIndexPage(manifest),
  ];
}

function definitionTypesIndex(manifest: DocsReferenceManifest): DocPageDefinition {
  return page({
    slug: 'reference/definition-types',
    title: 'Definition types',
    description: 'Every object type registered in the authoritative survey-definition metadata.',
    toc: [],
    content: <ReferenceCatalogContent introduction="Concrete types can appear in survey JSON; abstract types contribute inherited properties and child structure." items={manifest.definitionTypes.map((item) => ({ title: item.name, description: `${item.category}${item.isAbstract ? ' · abstract' : ''}`, url: item.url, badge: item.category }))} />,
  });
}

function propertiesIndex(manifest: DocsReferenceManifest): DocPageDefinition {
  return page({
    slug: 'reference/properties',
    title: 'Definition properties',
    description: 'Canonical property entries with declarations, defaults, flags, and type availability.',
    toc: [],
    content: <ReferenceCatalogContent introduction="A property has one stable URL even when several definition types declare it with distinct defaults or descriptions." items={manifest.definitionProperties.map((item) => ({ title: item.name, description: item.occurrences.find((entry) => entry.description !== null)?.description ?? `Available on ${item.availableOn.length} types`, url: item.url }))} />,
  });
}

function expressionLanguagePage(
  manifest: DocsReferenceManifest,
  extensions: ReferencePageExtensions,
): DocPageDefinition {
  return page({
    slug: 'reference/expression-language',
    title: 'Expression language',
    description: 'Operator syntax, precedence, canonical spellings, and the built-in function registry.',
    toc: [{ id: 'expression-operators', label: 'Operators', depth: 2 }, { id: 'expression-functions', label: 'Built-in functions', depth: 2 }],
    content: <ExpressionLanguageContent evaluator={extensions.expressionLanguageEvaluator} functions={manifest.expressionFunctions} operators={manifest.expressionOperators} overview={extensions.expressionLanguageOverview} />,
  });
}

function diagnosticsPage(manifest: DocsReferenceManifest): DocPageDefinition {
  return page({
    slug: 'reference/diagnostics',
    title: 'Diagnostics',
    description: 'Stable definition, expression, dependency, and survey-error identifiers.',
    toc: ['definition', 'expression', 'dependency', 'survey'].map((name) => ({ id: `diagnostic-${name}`, label: `${name[0]?.toUpperCase()}${name.slice(1)}`, depth: 2 })),
    content: <DiagnosticsContent diagnostics={manifest.diagnostics} />,
  });
}

function apiIndexPage(manifest: DocsReferenceManifest): DocPageDefinition {
  return page({ slug: 'reference/api', title: 'SDK API', description: 'Generated public API facts for the maintained TypeScript and .NET SDKs.', sdk: 'neutral', framework: 'neutral', toc: [], content: <ApiIndexContent items={manifest.apiSymbols} /> });
}

function definitionTypePage(item: DefinitionTypeReference): DocPageDefinition {
  return page({ slug: withoutDocs(item.url), title: `${item.name} definition`, description: item.description ?? `Generated ${item.category} definition reference.`, toc: [{ id: 'definition-shape', label: 'Definition shape', depth: 2 }, { id: 'definition-properties', label: 'Properties', depth: 2 }, { id: 'child-collections', label: 'Child collections', depth: 2 }], content: <DefinitionTypeContent item={item} /> });
}

function propertyPage(item: DefinitionPropertyReference): DocPageDefinition {
  return page({ slug: withoutDocs(item.url), title: `${item.name} property`, description: item.occurrences.find((entry) => entry.description !== null)?.description ?? 'Generated survey-definition property reference.', toc: [{ id: 'property-declarations', label: 'Declarations', depth: 2 }, { id: 'property-behavior', label: 'Behavior flags', depth: 2 }, { id: 'property-availability', label: 'Available on', depth: 2 }], content: <DefinitionPropertyContent item={item} /> });
}

function apiSymbolPage(item: ApiSymbolReference): DocPageDefinition {
  const framework = item.packageName.includes('react') ? 'react' : 'neutral';
  const sdk = item.packageName === 'Kajay.Core' ? 'dotnet' : 'typescript';
  return page({ slug: withoutDocs(item.url), title: item.name, description: item.description ?? `${item.exportKind} from ${item.packageName}.`, audience: audience(item), sdk, framework, toc: [{ id: 'api-identity', label: 'API identity', depth: 2 }, { id: 'api-signature', label: 'Signature', depth: 2 }], content: <ApiSymbolContent item={item} /> });
}

function apiPackagePage(packageName: string, manifest: DocsReferenceManifest): DocPageDefinition {
  const sdk = packageName === 'Kajay.Core' ? 'dotnet' : 'typescript';
  return page({ slug: `reference/api/${apiPackageSlug(packageName)}`, title: packageName, description: `Public API types and values from ${packageName}.`, sdk, framework: packageName.includes('react') ? 'react' : 'neutral', toc: [], content: <ApiIndexContent items={manifest.apiSymbols} packageName={packageName} /> });
}

function apiPackageSlug(value: string): string {
  return value.replace(/^@kajay\//u, '').replaceAll('.', '-').toLocaleLowerCase('en-US');
}

function audience(item: ApiSymbolReference): DocPageAudience {
  if (item.classification === 'consumer') return 'consumer';
  if (item.classification === 'extension') return 'extension';
  return 'advanced';
}

function withoutDocs(url: string): string {
  return url.startsWith('/docs/') ? url.slice('/docs/'.length) : url;
}

function itemBySlug<Item extends { readonly url: string }>(items: readonly Item[]): ReadonlyMap<string, Item> {
  return new Map(items.map((item) => [withoutDocs(item.url), item]));
}

export function createReferencePageRegistry(
  manifest: DocsReferenceManifest = docsReferenceManifest,
  extensions: ReferencePageExtensions = {},
): ReferencePageRegistry {
  const pages = navigationPages(manifest, extensions);
  const staticPages = new Map(pages.map((item) => [item.slug, item]));
  const types = itemBySlug(manifest.definitionTypes);
  const properties = itemBySlug(manifest.definitionProperties);
  const api = itemBySlug(manifest.apiSymbols);
  const packages = new Map([...new Set(manifest.apiSymbols.map((item) => item.packageName))].map((name) => [`reference/api/${apiPackageSlug(name)}`, name]));
  return {
    navigationPages: pages,
    resolve(slug) {
      const direct = staticPages.get(slug);
      if (direct !== undefined) return direct;
      const type = types.get(slug);
      if (type !== undefined) return definitionTypePage(type);
      const property = properties.get(slug);
      if (property !== undefined) return propertyPage(property);
      const symbol = api.get(slug);
      if (symbol !== undefined) return apiSymbolPage(symbol);
      const packageName = packages.get(slug);
      return packageName === undefined ? undefined : apiPackagePage(packageName, manifest);
    },
  };
}

export const referencePageRegistry: ReferencePageRegistry = createReferencePageRegistry();
export const referenceDocPages: readonly DocPageDefinition[] = referencePageRegistry.navigationPages;

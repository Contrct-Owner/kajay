export type DocumentationGap = 'classification' | 'description' | 'example' | 'signature';

export type DefinitionTypeCategory =
  | 'survey'
  | 'page'
  | 'question'
  | 'element'
  | 'validator'
  | 'trigger'
  | 'supporting';

export interface DefinitionPropertyOccurrence {
  readonly declaredBy: string;
  readonly type: 'string' | 'number' | 'boolean' | 'value' | 'json';
  readonly defaultValue: unknown;
  readonly isRequired: boolean;
  readonly isExpression: boolean;
  readonly isLocalizable: boolean;
  readonly visibleIf: string | null;
  readonly readOnlyIf: string | null;
  readonly description: string | null;
}

export interface DefinitionPropertyReference {
  readonly name: string;
  readonly url: string;
  readonly declaredBy: readonly string[];
  readonly availableOn: readonly string[];
  readonly occurrences: readonly DefinitionPropertyOccurrence[];
  readonly gaps: readonly DocumentationGap[];
}

export interface DefinitionChildCollectionReference {
  readonly property: string;
  readonly elementBaseType: string;
  readonly shorthandProperty: string | null;
  /** The owner's property whose `[[name]]` markers position these children, or null. */
  readonly markerProperty: string | null;
  readonly declaredBy: string;
}

export interface EffectiveDefinitionProperty {
  readonly name: string;
  readonly declaredBy: string;
}

export interface DefinitionTypeReference {
  readonly name: string;
  readonly url: string;
  readonly category: DefinitionTypeCategory;
  readonly parent: string | null;
  readonly isAbstract: boolean;
  readonly description: string | null;
  readonly declaredProperties: readonly string[];
  readonly effectiveProperties: readonly EffectiveDefinitionProperty[];
  readonly childCollections: readonly DefinitionChildCollectionReference[];
  readonly gaps: readonly DocumentationGap[];
}

export type DiagnosticCategory = 'definition' | 'expression' | 'dependency' | 'survey';

export interface DiagnosticReference {
  readonly code: string;
  readonly url: string;
  readonly category: DiagnosticCategory;
  readonly severity: 'warning' | 'error' | null;
  readonly phase: 'parse' | 'evaluate' | null;
  readonly description: string;
  readonly extensible: boolean;
  readonly gaps: readonly DocumentationGap[];
}

export interface ExpressionOperatorReference {
  readonly name: string;
  readonly url: string;
  readonly kind: 'binary' | 'unary' | 'postfix';
  readonly spellings: readonly string[];
  readonly precedence: number;
  readonly associativity: 'left' | 'right' | null;
  readonly description: string | null;
  readonly gaps: readonly DocumentationGap[];
}

export interface ExpressionFunctionReference {
  readonly name: string;
  readonly url: string;
  readonly category: 'logic' | 'math' | 'date';
  readonly description: string | null;
  readonly signature: string | null;
  readonly gaps: readonly DocumentationGap[];
}

export type ApiClassification = 'consumer' | 'extension' | 'adapter' | 'unclassified';

export interface ApiSymbolReference {
  readonly packageName: string;
  readonly name: string;
  readonly url: string;
  readonly exportKind: 'value' | 'type';
  readonly classification: ApiClassification;
  readonly description: string | null;
  readonly signature: string | null;
  readonly gaps: readonly DocumentationGap[];
}

export interface DocsReferenceManifest {
  readonly manifestVersion: 1;
  readonly sources: {
    readonly runtimeMetadataContractVersion: number;
    readonly runtimeDiagnosticContractVersion: number;
    readonly definitionSchemaId: string;
    readonly definitionSchemaVersion: number;
    readonly expressionConformanceVersion: number;
  };
  readonly definitionTypes: readonly DefinitionTypeReference[];
  readonly definitionProperties: readonly DefinitionPropertyReference[];
  readonly diagnostics: readonly DiagnosticReference[];
  readonly expressionOperators: readonly ExpressionOperatorReference[];
  readonly expressionFunctions: readonly ExpressionFunctionReference[];
  readonly apiSymbols: readonly ApiSymbolReference[];
}

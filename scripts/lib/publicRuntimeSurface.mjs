/** Runtime values intentionally available from each installed package root. */
export const PUBLIC_RUNTIME_SURFACE = Object.freeze({
  '@kajay/core': Object.freeze([
    'AsyncValidator',
    'BooleanQuestion',
    'CURRENT_SCHEMA_VERSION',
    'CheckboxQuestion',
    'CommentQuestion',
    'EventEmitter',
    'ExpressionCache',
    'ExpressionQuestion',
    'FileQuestion',
    'HtmlElement',
    'ImageElement',
    'ImagePickerQuestion',
    'MatrixCellsBase',
    'MatrixDynamicQuestion',
    'MatrixQuestion',
    'MetadataRegistry',
    'MultiSelectQuestion',
    'MultipleTextQuestion',
    'PageElement',
    'Panel',
    'PanelDynamicQuestion',
    'Question',
    'RUNTIME_DIAGNOSTIC_CONTRACT_VERSION',
    'RUNTIME_METADATA_CONTRACT_VERSION',
    'RadiogroupQuestion',
    'RankingQuestion',
    'RatingQuestion',
    'RepeatingQuestion',
    'SCHEMA_ID',
    'SelectQuestion',
    'SignatureQuestion',
    'SurveyElement',
    'TextQuestion',
    'UnsupportedSchemaVersionError',
    'Validator',
    'createDefaultFunctionRegistry',
    'createValueResolver',
    'evaluateExpression',
    'globalRegistry',
    'isLocalizedText',
    'isTruthy',
    'matrixRowKey',
    'measureProgress',
    'moveWithin',
    'parseExpression',
    'parseSurvey',
    'printExpression',
    'registerBuiltInTypes',
    'resolveLocalizedText',
    'scoreQuiz',
    'serializeSurvey',
  ]),
  '@kajay/react': Object.freeze([
    'PageElementDecoratorProvider',
    'PageElementRendererRegistry',
    'PageElementSlot',
    'QuestionRenderersProvider',
    'Survey',
    'defaultPageElementRenderers',
    'readOnlyAction',
    'reorderAnnouncement',
    'useQuestionRenderers',
    'useQuestionValue',
    'useReorder',
    'useSurveyCurrentPageNo',
    'useSurveyStatus',
    'useSurveyValidating',
    'useSurveyValue',
  ]),
  '@kajay/creator-core': Object.freeze([
    'CONDITION_OPERATORS',
    'CreatorStringDictionary',
    'CreatorWorkspace',
    'DEFAULT_LOCALE',
    'DesignSurface',
    'JsonEditorSession',
    'LOGIC_TEMPLATES',
    'LogicSession',
    'PREVIEW_DEVICES',
    'PreviewSession',
    'SaveController',
    'ThemeEditorSession',
    'Toolbox',
    'TranslationSession',
    'applySuggestion',
    'childLabel',
    'expressionSuggestions',
    'fastEntryText',
    'isUnaryOperator',
    'localesOf',
    'localizedTextIn',
    'matchingSuggestions',
    'parseEditorText',
    'previewDevice',
    'sameDefinition',
    'tokenAt',
  ]),
  '@kajay/creator-react': Object.freeze([
    'CreatorComponentsProvider',
    'CreatorStringsProvider',
    'CreatorTabs',
    'DEFAULT_CREATOR_TABS',
    'DesignSurfacePanel',
    'HistoryPanel',
    'JsonEditorPanel',
    'LogicPanel',
    'PageNavigatorPanel',
    'PreviewPanel',
    'PropertyEditorProvider',
    'PropertyGridPanel',
    'SaveButton',
    'SurveyCreator',
    'ThemeEditorPanel',
    'ToolboxPanel',
    'TranslationsPanel',
    'useCreatorComponents',
    'useCreatorDocument',
    'useCreatorText',
    'useCreatorWorkspace',
    'useDesignerPlacement',
    'usePreviewVersion',
    'usePropertyEditor',
    'useThemeVersion',
  ]),
  '@kajay/themes': Object.freeze([
    'darkTheme',
    'lightTheme',
    'panellessTheme',
    'themeVariables',
    'themes',
  ]),
});

function valuesInSection(source, packageName) {
  const heading = `## \`${packageName}\``;
  const start = source.indexOf(heading);
  if (start < 0) {
    return;
  }
  const next = source.indexOf('\n## ', start + heading.length);
  const section = source.slice(start, next < 0 ? undefined : next);
  const values = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) {
      continue;
    }
    const column = line.split('|')[2]?.trim() ?? '';
    for (const match of column.matchAll(/`([^`]+)`/gu)) {
      values.push(match[1]);
    }
  }
  return { section, values };
}

/** Checks the human ledger against the machine-readable compatibility manifest. */
export function publicSurfaceLedgerViolations(source, expected = PUBLIC_RUNTIME_SURFACE) {
  const violations = [];
  for (const [packageName, expectedValues] of Object.entries(expected)) {
    const parsed = valuesInSection(source, packageName);
    if (parsed === undefined) {
      violations.push(`Missing runtime-surface section for ${packageName}.`);
      continue;
    }
    if (!parsed.section.startsWith(`## \`${packageName}\` — ${expectedValues.length} values`)) {
      violations.push(`${packageName} heading must state ${expectedValues.length} values.`);
    }
    const seen = new Set();
    for (const value of parsed.values) {
      if (seen.has(value)) {
        violations.push(`${packageName} lists ${value} more than once.`);
      }
      seen.add(value);
    }
    for (const value of expectedValues) {
      if (!seen.has(value)) {
        violations.push(`${packageName} ledger is missing ${value}.`);
      }
    }
    for (const value of seen) {
      if (!expectedValues.includes(value)) {
        violations.push(`${packageName} ledger contains unexpected value ${value}.`);
      }
    }
  }
  return violations;
}

/** Mutation proof for the parser that makes the Markdown ledger enforceable. */
export function assertPublicSurfaceLedgerRulesWork() {
  const expected = { '@example/pkg': ['kept'] };
  const clean = '## `@example/pkg` — 1 values\n\n| Category | Values | Evidence |\n| --- | --- | --- |\n| Consumer | `kept` | proof |';
  if (publicSurfaceLedgerViolations(clean, expected).length > 0) {
    throw new Error('Public-surface ledger self-check rejected its clean fixture.');
  }
  const broken = clean.replace('`kept`', '`extra`');
  const failures = publicSurfaceLedgerViolations(broken, expected);
  if (failures.length !== 2) {
    throw new Error('Public-surface ledger self-check did not reject missing and extra values.');
  }
}

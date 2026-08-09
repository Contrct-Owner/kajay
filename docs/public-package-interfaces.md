# Public Package Interface Ledger

- Area: Published package architecture
- Status: active
- Owner: Jarod
- Last updated: 2026-08-06

The `package.json` `exports` map makes each package root its only JavaScript entry. This
ledger classifies every runtime value available from those roots after architecture
remediation. Type-only exports remain public declaration contracts, but are not runtime
values and therefore are not repeated here.

Admission rule: a new value export must be a consumer operation, an intentional
extension seam, or a requirement of another maintained adapter. Package-local
algorithms stay private and package-local tests import them relatively. A proposed seam
with no caller needs an explicit compatibility reason and an installed-consumer or
browser proof.

## `@kajay/core` — 54 values

| Category | Values | Concrete evidence |
| --- | --- | --- |
| Consumer operations and contract identity | `CURRENT_SCHEMA_VERSION`, `RUNTIME_DIAGNOSTIC_CONTRACT_VERSION`, `RUNTIME_METADATA_CONTRACT_VERSION`, `SCHEMA_ID`, `UnsupportedSchemaVersionError`, `UnsupportedSurveySnapshotVersionError`, `digestCanonicalDefinition`, `parseSurvey`, `parseSurveySnapshot`, `scoreQuiz`, `serializeSurvey` | Host and Creator parsing, conformance adapter, definition and Response Snapshot identity, quiz/progress behavior, and the installed [pack consumer](../scripts/pack-fixtures.mjs). |
| Intentional extension seams | `AsyncValidator`, `MetadataRegistry`, `PageElement`, `Question`, `RepeatingQuestion`, `SurveyElement`, `Validator`, `createDefaultFunctionRegistry`, `globalRegistry`, `registerBuiltInTypes` | Custom metadata/question/validator and expression-function registration, host-defined renderer/browser proofs, and the installed [extension consumer](../scripts/pack-extension-fixtures.mjs). Base classes remain values because consumers subclass or register factories for them. Per-survey wording is extended through the dictionary already owned by `survey.strings`; no standalone dictionary constructor or raw locale table is needed. |
| Maintained adapter requirements | `BooleanQuestion`, `CheckboxQuestion`, `CommentQuestion`, `EventEmitter`, `ExpressionCache`, `ExpressionQuestion`, `FileQuestion`, `HtmlElement`, `ImageElement`, `ImagePickerQuestion`, `MatrixCellsBase`, `MatrixDynamicQuestion`, `MatrixQuestion`, `MultiSelectQuestion`, `MultipleTextQuestion`, `Panel`, `PanelDynamicQuestion`, `RadiogroupQuestion`, `RankingQuestion`, `RatingQuestion`, `SelectQuestion`, `SignatureQuestion`, `TextQuestion`, `createValueResolver`, `evaluateExpression`, `isLocalizedText`, `isTruthy`, `matrixRowKey`, `measureProgress`, `moveWithin`, `parseExpression`, `printExpression`, `resolveLocalizedText` | Runtime React renderer dispatch and Creator headless models import these values through the package root. Expression semantics also back the versioned conformance adapter. Removing them would move type dispatch, truthiness, caching, or expression behavior into adapters. |

Notably, `Survey`, `Page`, `SurveyTimer`, `StringDictionary`, `FunctionRegistry`,
`DisplayElement`, concrete validators, and other model shapes are still available as
types, but their constructors are no longer JavaScript compatibility promises. Surveys
are created from the authoritative definition through `parseSurvey`; timer and string
operations are reached through `survey.timer` and `survey.strings`.

## `@kajay/react` — 25 values

| Category | Values | Concrete evidence |
| --- | --- | --- |
| Consumer operations | `Survey`, `useSurveyCurrentPageNo`, `useSurveyStatus`, `useSurveyValidating` | Host rendering, navigation/status UI, validation timelines, and browser tests. |
| Intentional extension seams | `PageElementRendererRegistry`, `SurveyComponentsProvider`, `defaultPageElementRenderers`, `useQuestionRenderers`, `useQuestionValue`, `useReorder`, `useSurveyComponents`, `useSurveyValue` | Custom renderer registration and isolation, nested renderer resolution, custom question controls, and the shared accessible reorder grammar. The default registry is statically readonly; `clone()` returns a mutable registry. `SurveyComponentsProvider`/`useSurveyComponents` are [ADR-0022](./adr/0022-design-system-primitives.md)'s primitive seam for the renderer (P2) — a host supplies their own Button and the survey draws with it; the provider is public because a host arranging pieces themselves needs to establish the map without `<Survey>`. |
| Maintained Creator-adapter requirements | `IdScopeProvider`, `PageElementDecoratorProvider`, `PageElementSlot`, `PageElementSlotDecoratorProvider`, `TextRendererProvider`, `QuestionErrors`, `QuestionTitleContent`, `questionErrorId`, `questionId`, `useIdScope`, `QuestionRenderersProvider`, `readOnlyAction`, `reorderAnnouncement` | Creator adorners, nested container rendering, property actions, and placement narration import these through the public package seam. The two decorators wrap different things and both are needed: `PageElementDecoratorProvider` wraps an element *inside* its layout slot, which is where an adorner belongs, and `PageElementSlotDecoratorProvider` wraps the slot itself, which is the only way to add a node a container lays out as one of its own children — the drop placeholder (P12) has to be a cell of the container's grid or it cannot say which of two side-by-side positions a drop means. `IdScopeProvider` is what makes drawing a **second copy** of an element legal: the drag ghost runs a question's own renderer again, and without its own scope both copies emit one set of ids and every `<label for>` in the second resolves to the first — P7's defect, reintroduced by the picture of the question. |

## `@kajay/creator-core` — 31 values

| Category | Values | Concrete evidence |
| --- | --- | --- |
| Headless consumer models and lifetime | `CreatorStringDictionary`, `CreatorWorkspace`, `DesignSurface`, `JsonEditorSession`, `LogicSession`, `PreviewSession`, `SaveController`, `ThemeEditorSession`, `Toolbox`, `TranslationSession` | Both the default assembly and the deliberately different host layout use one workspace. Public pieces accept these narrow models, and unit/browser/E2E tests prove shared registry/document lifetime and idempotent disposal. `DesignSelection` is reached as the type of `surface.selection`; its constructor is not a compatibility promise. |
| Stable configuration and vocabulary | `CONDITION_OPERATORS`, `DEFAULT_LOCALE`, `LOGIC_TEMPLATES`, `PREVIEW_DEVICES`, `isUnaryOperator`, `previewDevice` | Creator UI adapters draw stable condition controls, logic templates, locales, and preview devices without copying catalogues. Creator wording is extended through `CreatorStringDictionary`; its backing catalogue and formatter remain package-local. |
| Maintained React-adapter requirements | `applySuggestion`, `childLabel`, `expressionSuggestions`, `fastEntryText`, `localesOf`, `localizedTextIn`, `matchingSuggestions`, `parseEditorText`, `sameDefinition`, `tokenAt` | Property, collection, expression, translation, and controlled-document adapters call these through the root. Their semantics remain headless and reusable by a second framework adapter. |
| Why an edit was refused ([ADR-0023](./adr/0023-the-creator-says-what-happened.md)) | `nameRefusal`, `refuse`, `refusalMessageKey` | Every edit answers with `EditRefusal | undefined` rather than a boolean, so a host drawing their own property grid can say *why* an edit did not take. `nameRefusal` is the shared predicate the rename guards with and a field asks before committing — one rule, two callers, so a view cannot promise an edit the document then refuses. `refusalMessageKey` maps a reason to the N3 catalogue, keeping the words translatable and white-labelled. |
| What the Creator did unasked ([ADR-0023](./adr/0023-the-creator-says-what-happened.md)) | `notice`, `noticeMessageKey` | The other half of a refusal. `DesignSurface.onNotice` carries what the Creator did on its own initiative — a paste that renumbered names, a conversion that dropped settings, a delete that took a container's children — so a host can route them into their own notification system instead of the shipped live region. `notify` is public for the same reason `change` and `applyEdit` are: a host's own edits reshape a survey too, and should be able to say so. |

Free placement/tree/edit algorithms are private. Consumers use `DesignSurface.place`
or the deep `DesignSurface.placement` controller; translation/theme/logic consumers use
their sessions rather than raw traversal and codec functions.

## `@kajay/creator-react` — 30 values

| Category | Values | Concrete evidence |
| --- | --- | --- |
| Default assembly and composition controllers | `CreatorTabs`, `DEFAULT_CREATOR_TABS`, `SurveyCreator`, `useCreatorDocument`, `useCreatorWorkspace`, `useDesignerPlacement` | The assembled Creator and host-owned arrangement share the same public workspace, controlled-document, and placement lifetime paths. |
| Top-level pieces promised by ADR-0021 | `DesignSurfacePanel`, `HistoryPanel`, `JsonEditorPanel`, `LogicPanel`, `PageNavigatorPanel`, `PreviewPanel`, `PropertyGridPanel`, `SaveButton`, `ThemeEditorPanel`, `ToolboxPanel`, `TranslationsPanel` | Default and non-default host layouts render these pieces through public imports; browser and host E2E suites cover both arrangements. |
| Host design-system, text, editor, and session seams | `CreatorComponentsProvider`, `CreatorStringsProvider`, `PropertyEditorProvider`, `useCreatorComponents`, `useCreatorText`, `usePreviewVersion`, `usePropertyEditor`, `useInlineTextRenderer`, `useSurfaceVersion`, `useThemeVersion` | Host primitive replacement, white-label strings, custom property editors, and custom preview/theme panels use these seams without internal imports. **`useSurfaceVersion` is what a host needs to put undo in their own toolbar** — ADR-0021 invites exactly that, and until the reference application wanted icon buttons the hook was private, so a host's own control could not tell when there stopped being anything to undo. | Host primitive replacement, white-label strings, custom property editors, and custom preview/theme panels use these seams without internal imports. |
| Saying what the Creator did ([ADR-0023](./adr/0023-the-creator-says-what-happened.md)) | `CreatorNotices`, `InlineText`, `useLatestNotice` | The default assembly renders the shipped polite live region; a host who would rather route notices into their own notification system subscribes with the hook and draws nothing. Browser scenarios cover both the shipped region and a white-labelled message. |

Nested fields, shortcuts, panel-internal version counters, and element-action widgets
are private implementation details of the top-level pieces. Public version hooks remain
the narrow subscription seams for host-built preview and theme panels.

## `@kajay/themes` — 5 values

| Category | Values | Concrete evidence |
| --- | --- | --- |
| Consumer theme operations and presets | `darkTheme`, `lightTheme`, `panellessTheme`, `themes`, `themeVariables` | Hosts import theme data and CSS explicitly. The installed pack consumer resolves a preset and computes variables without coupling the React package to themes. |

## Enforcement and review

- [Workspace policy](../scripts/lib/workspacePolicy.mjs) fixes the package set,
  dependency roles, project references, and export-map keys.
- The machine-readable [runtime surface manifest](../scripts/lib/publicRuntimeSurface.mjs)
  is checked against these tables by the architecture gate and against the installed
  tarballs by the pack test.
- [Architecture checks](../scripts/check-arch.mjs) reject package subpath imports and
  undeclared dependencies.
- Package-local algorithm tests may use relative `src` imports; browser/E2E/host tests
  use package roots only.
- [Pack tests](../scripts/pack-test.mjs) install tarballs outside the workspace and
  compile representative public calls under TypeScript 5.5, 6, and 7.
- Narrowing a published value after release must follow the selected release posture
  and carry the appropriate breaking-change note.

## Related decisions

- [ADR-0010 — package manifest and distribution](./adr/0010-package-manifest-and-distribution.md)
- [ADR-0014 — supported TypeScript range](./adr/0014-supported-typescript-range.md)
- [ADR-0019 — deep runtime modules and rendering seam](./adr/0019-deep-runtime-modules-and-rendering-seam.md)
- [ADR-0021 — Creator composition](./adr/0021-creator-composition.md)
- [Architecture remediation plan](./architecture-remediation-plan.md)

import {
  CORE_EXTENSION_SMOKE,
  RENDERER_EXTENSION_SMOKE,
} from './pack-extension-fixtures.mjs';

/**
 * The scratch project's sources for the pack test.
 *
 * Kept beside the harness rather than inside it because they are a *consumer's* code, not
 * the harness's: they are read as TypeScript, they are the only thing in this repository
 * that imports Kajay the way a stranger would, and they are long enough that living in the
 * middle of the packing logic buried both.
 */

/**
 * The smoke scenario — compiled under every TypeScript in the matrix, then run.
 *
 * The Creator half is headless on purpose: this runs in Node with no DOM, and everything it
 * touches is `creator-core`, which is a core package and may not have one. What a browser
 * would add is checked by compiling {@link CREATOR_TSX} beside it, not by rendering here.
 */
export const SMOKE_TS = `import {
  AsyncValidator,
  CURRENT_SCHEMA_VERSION,
  MetadataRegistry,
  Question,
  RepeatingQuestion,
  Validator,
  createDefaultFunctionRegistry,
  createValueResolver,
  evaluateExpression,
  moveWithin,
  parseExpression,
  parseSurvey,
  parseSurveySnapshot,
  registerBuiltInTypes,
  scoreQuiz,
  serializeSurvey,
  globalRegistry,
  type SurveyError,
  type SurveyDefinition,
  type PageElement,
  type ValidationContext,
} from '@kajay/core';
import {
  CreatorWorkspace,
  CreatorStringDictionary,
  DesignSurface,
  SaveController,
  Toolbox,
  type CreatorConfiguration,
} from '@kajay/creator-core';
import { lightTheme } from '@kajay/themes';
import {
  defaultPageElementRenderers,
  reorderAnnouncement,
  useReorder,
  type ReorderOptions,
} from '@kajay/react';

const definition: SurveyDefinition = {
  title: 'Pack smoke',
  maxTimeToFinish: 60,
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1', correctAnswer: 'Ada', keptUnknown: 'yes' }] }],
};

const first = parseSurvey(definition);
const canonical = serializeSurvey(first.survey);
const second = serializeSurvey(parseSurvey(canonical).survey);

if (JSON.stringify(canonical) !== JSON.stringify(second)) {
  throw new Error('Round-trip is not a fixed point.');
}
if (canonical['schemaVersion'] !== CURRENT_SCHEMA_VERSION) {
  throw new Error('schemaVersion missing from canonical output.');
}
if (!first.diagnostics.some((d) => d.code === 'unknown-property')) {
  throw new Error('Unknown property was not surfaced as a diagnostic.');
}
if (!globalRegistry.hasClass('text')) {
  throw new Error('Built-in types are not registered.');
}

${CORE_EXTENSION_SMOKE}

first.survey.setValue('q1', 'Ada');
if (scoreQuiz(first.survey).correct !== 1) {
  throw new Error('Quiz scoring did not survive packaging.');
}
first.survey.timer.start();
first.survey.timer.tick();
first.survey.timer.stop();
if (first.survey.timer.isRunning) {
  throw new Error('The survey-owned timer did not stop.');
}

const storedSnapshot = JSON.stringify(first.survey.createSnapshot());
const restoredSurvey = parseSurvey(canonical).survey;
restoredSurvey.restoreSnapshot(parseSurveySnapshot(storedSnapshot));
if (restoredSurvey.getValue('q1') !== 'Ada' || !storedSnapshot.includes(first.definitionDigest)) {
  throw new Error('Response Snapshot storage did not survive packaging.');
}

const workspace = new CreatorWorkspace({ definition });
const toolbox = workspace.toolbox;
if (toolbox.items.length === 0) {
  throw new Error('Toolbox derived no items from the registry.');
}
if (!toolbox.categories.some((category) => category.name === 'Choice')) {
  throw new Error('Toolbox categories did not survive packaging.');
}
if (!defaultPageElementRenderers.has('text')) {
  throw new Error('Default renderers are missing the text question.');
}
if (JSON.stringify(moveWithin(['a', 'b', 'c'], 0, 2)) !== JSON.stringify(['b', 'c', 'a'])) {
  throw new Error('The reusable core reorder primitive is not working.');
}
if (typeof useReorder !== 'function') {
  throw new Error('The reusable React reorder interaction is not exported.');
}
const reorderOptions: ReorderOptions = {
  itemCount: 1,
  onMove: () => false,
  describe: () => 'Only item',
};
if (reorderOptions.itemCount !== 1 || reorderAnnouncement('moved', 'Only item', 0, 1) !== 'Only item, position 1 of 1.') {
  throw new Error('The reusable React reorder contract is not working.');
}
if (lightTheme.name !== 'light') {
  throw new Error('Theme preset did not load.');
}

// --- The Creator, driven from the tarball — checklist N4 ---------------------
// Headless on purpose: this file runs in Node with no DOM, and everything below is
// \`creator-core\`, which is a core package and may not touch one. What a browser would
// add is checked by compiling \`creator.tsx\` beside this, not by rendering here.
const designed = workspace.surface;
designed.place(
  { kind: 'new', item: { name: 'comment', type: 'comment', title: 'Long text', category: 'Text', keywords: [], defaults: {} } },
  { list: { of: 'elements', container: 'p1' }, index: 1 },
);
if (designed.page?.elements.length !== 2) {
  throw new Error('A question could not be added through the packaged Creator.');
}

const added = designed.page.elements[1]!;
const addedName = added.name;
designed.setProperty(added, 'title', 'Tell us more');
if (designed.properties(added).length === 0) {
  throw new Error('The property grid generated nothing from the packaged registry.');
}
designed.undo();
// Re-read by *name*: undo re-parses, and element identity does not survive that
// (ADR-0009 decision 3). Holding the old object would ask a model the survey no longer
// has — which is exactly the mistake this line is here to not make.
if (designed.survey.getQuestionByName(addedName)?.title === 'Tell us more') {
  throw new Error('Undo did not survive packaging.');
}

designed.setProperty(designed.survey.getQuestionByName('q1')!, 'visibleIf', "{q1} notempty");
const logic = workspace.logic;
if (logic.rules.length !== 1 || logic.rules[0]?.condition === undefined) {
  throw new Error('The logic editor did not read the rule it just wrote.');
}

const translations = workspace.translations;
if (!translations.entries.some((entry) => entry.key.endsWith('/title'))) {
  throw new Error('The translation table found no strings.');
}

const json = workspace.json;
if (json.isDirty || json.problem !== undefined) {
  throw new Error('The JSON editor did not open clean on the definition it was given.');
}

// The definition survives being built by the Creator and read back — ADR-0002 again,
// this time through an installed package rather than a workspace symlink.
if (JSON.stringify(serializeSurvey(parseSurvey(designed.definition).survey)) !== JSON.stringify(designed.definition)) {
  throw new Error('A Creator-built definition is not a round-trip fixed point.');
}

const restricted: CreatorConfiguration = { allowedTypes: ['text'], isReadOnly: true };
const locked = new DesignSurface({ definition, configuration: restricted });
locked.setProperty(locked.survey.getQuestionByName('q1')!, 'title', 'Should not stick');
if (locked.survey.getQuestionByName('q1')?.title === 'Should not stick') {
  throw new Error('A read-only configuration did not survive packaging.');
}
if (new Toolbox({ configuration: restricted }).items.length !== 1) {
  throw new Error('A type restriction did not survive packaging.');
}

const words = new CreatorStringDictionary();
words.register('en', { save: 'Publish' });
if (words.get('en', 'save') !== 'Publish' || words.get('en', 'undo') !== 'Undo') {
  throw new Error('White-labelled Creator strings did not survive packaging.');
}

const saver = new SaveController(() => true);
saver.request(designed.definition);
if (saver.state !== 'saving') {
  throw new Error('The save seam did not start.');
}
workspace.dispose();

console.log('pack smoke: ok');
`;

// The Creator's React half — checklist N4. **Compiled, deliberately not run.** Rendering
// needs a DOM this harness does not have, and what a consumer's build actually proves is
// that the export map resolves and the declarations are usable: a broken `exports` entry
// for `@kajay/creator-react`, or a `.d.ts` that references a type it did not ship, fails
// right here under every TypeScript in the matrix. The browser suite renders these;
// nothing else checks that they can be *installed*.
export const CREATOR_TSX = `import {
  CreatorStringDictionary,
  type CreatorConfiguration,
} from '@kajay/creator-core';
import {
  CreatorStringsProvider,
  DesignSurfacePanel,
  LogicPanel,
  PageNavigatorPanel,
  PreviewPanel,
  PropertyGridPanel,
  SurveyCreator,
  ThemeEditorPanel,
  ToolboxPanel,
  useCreatorDocument,
  useCreatorWorkspace,
  useDesignerPlacement,
  type CreatorTab,
  type SurveyCreatorProps,
} from '@kajay/creator-react';
import {
  defaultPageElementRenderers,
  type PageElementRendererRegistry,
  type PageElementRendererResolver,
  type SurveyProps,
} from '@kajay/react';
import { themeVariables, lightTheme } from '@kajay/themes';
import type { SurveyDefinition } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement } from 'react';

const definition = { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1' }] }] };
${RENDERER_EXTENSION_SMOKE}

/** The default assembly, configured and white-labelled — N1, N2 and N3 together. */
export function Assembled(props: SurveyCreatorProps): ReactElement {
  const strings = new CreatorStringDictionary();
  strings.register('en', { save: 'Publish' });
  const configuration: CreatorConfiguration = { allowedTypes: ['text', 'comment'] };
  const tabs: readonly CreatorTab[] = ['design', 'preview', 'json'];

  return (
    <SurveyCreator
      {...props}
      value={definition}
      tabs={tabs}
      configuration={configuration}
      strings={strings}
      renderers={rendererResolver}
      creatorTheme={themeVariables(lightTheme)}
      isAutoSave
      save={() => true}
    />
  );
}

/**
 * The same Creator arranged by hand — ADR-0021's actual claim.
 *
 * If the pieces were not really usable alone, this would not compile.
 */
export function ByHand(): ReactElement {
  const workspace = useCreatorWorkspace({ definition });
  const surface = workspace.surface;
  const toolbox = workspace.toolbox;
  const placement = useDesignerPlacement(surface);
  const [document, setDocument] = useState<SurveyDefinition>(() => surface.definition);
  useCreatorDocument({ surface, value: document, onChange: setDocument });

  return (
    <CreatorStringsProvider dictionary={new CreatorStringDictionary()} locale="en">
      <ToolboxPanel toolbox={toolbox} getItemProps={placement.getItemProps} />
      <PageNavigatorPanel surface={surface} placement={placement} />
      <DesignSurfacePanel surface={surface} placement={placement} />
      <PropertyGridPanel surface={surface} grid={{ hidden: ['visibleIf'] }} />
      <LogicPanel session={workspace.logic} />
      <PreviewPanel session={workspace.preview} />
      <ThemeEditorPanel session={workspace.themeEditor} />
    </CreatorStringsProvider>
  );
}
`;

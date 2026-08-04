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
  CURRENT_SCHEMA_VERSION,
  moveWithin,
  parseSurvey,
  serializeSurvey,
  globalRegistry,
  type SurveyDefinition,
} from '@kajay/core';
import {
  CreatorStringDictionary,
  DesignSurface,
  JsonEditorSession,
  LogicSession,
  SaveController,
  Toolbox,
  TranslationSession,
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
  pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1', keptUnknown: 'yes' }] }],
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
const toolbox = new Toolbox();
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
const designed = new DesignSurface({ definition });
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
const logic = new LogicSession(designed);
if (logic.rules.length !== 1 || logic.rules[0]?.condition === undefined) {
  throw new Error('The logic editor did not read the rule it just wrote.');
}

const translations = new TranslationSession(designed);
if (!translations.entries.some((entry) => entry.key.endsWith('/title'))) {
  throw new Error('The translation table found no strings.');
}

const json = new JsonEditorSession(designed);
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
  DesignSurface,
  LogicSession,
  PreviewSession,
  ThemeEditorSession,
  Toolbox,
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
  useDesignerPlacement,
  type CreatorTab,
  type SurveyCreatorProps,
} from '@kajay/creator-react';
import { themeVariables, lightTheme } from '@kajay/themes';
import type { ReactElement } from 'react';

const definition = { pages: [{ name: 'p1', elements: [{ type: 'text', name: 'q1' }] }] };

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
  const surface = new DesignSurface({ definition });
  const toolbox = new Toolbox();
  const placement = useDesignerPlacement(surface);

  return (
    <CreatorStringsProvider dictionary={new CreatorStringDictionary()} locale="en">
      <ToolboxPanel toolbox={toolbox} getItemProps={placement.getItemProps} />
      <PageNavigatorPanel surface={surface} placement={placement} />
      <DesignSurfacePanel surface={surface} placement={placement} />
      <PropertyGridPanel surface={surface} grid={{ hidden: ['visibleIf'] }} />
      <LogicPanel session={new LogicSession(surface)} />
      <PreviewPanel session={new PreviewSession(surface)} />
      <ThemeEditorPanel session={new ThemeEditorSession({ theme: { name: 'x' } })} />
    </CreatorStringsProvider>
  );
}
`;

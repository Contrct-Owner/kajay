import { MetadataRegistry, registerBuiltInTypes } from '@kajay/core';
import type { SurveyDefinition } from '@kajay/core';
import { DesignSurface, Toolbox } from '@kajay/creator-core';

/**
 * A survey holding one of every type the toolbox offers — checklist N5.
 *
 * **Built by driving the Creator**, not written out as JSON, which is the row's actual
 * demand: "covering every §C/§F/§G/§H type *in the Creator*". A hand-written definition
 * would prove the parser handles every type and say nothing about whether a designer can
 * produce one.
 *
 * The list of types is the toolbox's, so this fixture has no list of its own. That is what
 * makes the scenario an acceptance test rather than another feature test: a type registered
 * tomorrow is in this survey the same day, and the assertions that depend on knowing what
 * is in it fail until somebody has looked.
 */
export function registryWithBuiltIns(): MetadataRegistry {
  const registry = new MetadataRegistry();
  registerBuiltInTypes(registry);
  return registry;
}

const EMPTY: SurveyDefinition = {
  title: 'One of everything',
  pages: [{ name: 'p1', title: 'Every type' }],
};

export function buildEveryType(registry: MetadataRegistry): DesignSurface {
  const surface = new DesignSurface({ definition: EMPTY, registry });
  let index = 0;
  for (const item of new Toolbox({ registry }).items) {
    surface.place({ kind: 'new', item }, { list: { of: 'elements', container: 'p1' }, index });
    index += 1;
  }
  return surface;
}

/**
 * One answer per question type, in the shape that type stores.
 *
 * A table, unavoidably: only a person knows that a matrix wants a row *and* a column, and
 * deriving it from the model would be re-implementing every question's semantics in a test
 * to check the semantics. What is **not** left to a person is whether the table is complete
 * — `parity/N5-submit` compares its keys against the types the toolbox actually produced.
 *
 * The names are the ones the Creator minted (`dropdown1`, `matrix1`), and the values are
 * the starter content it minted with them, which is the point: this is the survey a
 * designer gets by dropping one of everything and changing nothing.
 */
export const ANSWERS: Readonly<Record<string, unknown>> = {
  boolean: true,
  checkbox: ['Item 1', 'Item 3'],
  comment: 'Rather more to say, over several lines.',
  dropdown: 'Item 2',
  fillintheblank: { blank1: 'capital', blank2: 'answered' },
  file: [{ name: 'note.txt', type: 'text/plain', size: 11, content: 'data:text/plain;base64,aGk=' }],
  imagepicker: 'Item 1',
  matrix: { 'Row 1': 'Column 1', 'Row 2': 'Column 3' },
  matrixcells: { 'Row 1': { column1: 'left' }, 'Row 2': { column1: 'right' } },
  matrixdynamic: [{ column1: 'first row' }, { column1: 'second row' }],
  multipletext: { item1: 'one', item2: 'two' },
  paneldynamic: [{ question1: 'in the first panel' }],
  radiogroup: 'Item 3',
  ranking: ['Item 3', 'Item 1', 'Item 2'],
  rating: 3,
  signaturepad: 'data:image/png;base64,iVBORw0KGgo=',
  tagbox: ['Item 1', 'Item 2'],
  text: 'A short answer',
};

/**
 * Question types nobody answers, because the survey answers them.
 *
 * `expression` is a question in every structural sense — it is on a page, it has a name,
 * it appears in the response — and a respondent can no more type into it than into a
 * total. Listing it here rather than filtering it out of the loop keeps the completeness
 * check total: every type is either answered or *said* to be computed.
 */
export const COMPUTED: readonly string[] = ['expression'];
